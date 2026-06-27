import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  connectScribeRealtime,
  float32ToInt16,
  sendScribeAudioChunk,
  speakerFromScribeMessage,
  type ScribeServerMessage,
} from '@/lib/elevenlabs-scribe';
import { useJobrakerRecruiterAccount } from '@/hooks/useJobrakerRecruiterAccount';

export type MeetingTranscriptionState = 'idle' | 'connecting' | 'recording' | 'stopping';

const SYSTEM_AUDIO_GATE_THRESHOLD = 0.005;
const SILENCE_AUTO_STOP_MS = 2 * 60 * 1000;

async function detectHeadphones(): Promise<boolean> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        const defaultOutput = outputs.find(d => d.deviceId === 'default');
        const label = (defaultOutput?.label ?? '').toLowerCase();
        const headphonePatterns = ['headphone', 'airpod', 'earpod', 'earphone', 'earbud', 'bluetooth', 'bt_', 'jabra', 'bose', 'sony wh', 'sony wf'];
        return headphonePatterns.some(p => label.includes(p));
    } catch {
        return false;
    }
}

interface TranscriptEntry {
    speaker: string;
    text: string;
}

export interface CalendarEventMeta {
    summary?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
    location?: string
    htmlLink?: string
    conferenceLink?: string
    source?: string
}

function formatTranscript(entries: TranscriptEntry[], date: string, calendarEvent?: CalendarEventMeta): string {
    const noteTitle = calendarEvent?.summary || 'Meeting Notes';
    const lines = [
        '---',
        'type: meeting',
        'source: jobraker-recruiter',
        `title: ${noteTitle}`,
        `date: "${date}"`,
    ];
    if (calendarEvent) {
        const eventObj: Record<string, string> = {}
        if (calendarEvent.summary) eventObj.summary = calendarEvent.summary
        if (calendarEvent.start?.dateTime) eventObj.start = calendarEvent.start.dateTime
        else if (calendarEvent.start?.date) eventObj.start = calendarEvent.start.date
        if (calendarEvent.end?.dateTime) eventObj.end = calendarEvent.end.dateTime
        else if (calendarEvent.end?.date) eventObj.end = calendarEvent.end.date
        if (calendarEvent.location) eventObj.location = calendarEvent.location
        if (calendarEvent.htmlLink) eventObj.htmlLink = calendarEvent.htmlLink
        if (calendarEvent.conferenceLink) eventObj.conferenceLink = calendarEvent.conferenceLink
        if (calendarEvent.source) eventObj.source = calendarEvent.source
        lines.push(`calendar_event: '${JSON.stringify(eventObj).replace(/'/g, "''")}'`)
    }
    lines.push(
        '---',
        '',
        `# ${noteTitle}`,
        '',
    );
    const transcriptLines: string[] = [];
    for (let i = 0; i < entries.length; i++) {
        if (i > 0 && entries[i].speaker !== entries[i - 1].speaker) {
            transcriptLines.push('');
        }
        transcriptLines.push(`**${entries[i].speaker}:** ${entries[i].text}`);
        transcriptLines.push('');
    }
    const transcriptText = transcriptLines.join('\n').trim();
    const transcriptData = JSON.stringify({ transcript: transcriptText });
    lines.push('```transcript', transcriptData, '```');
    return lines.join('\n');
}

async function hasScribeAccess(
    refreshJobrakerRecruiterAccount: () => Promise<{ signedIn: boolean } | null>,
): Promise<boolean> {
    const account = await refreshJobrakerRecruiterAccount();
    if (account?.signedIn) return true;
    const config = await window.ipc.invoke('voice:getConfig', null);
    return !!config.elevenlabs;
}

async function openScribeConnections(): Promise<{ micWs: WebSocket; sysWs: WebSocket }> {
    const [micToken, sysToken] = await Promise.all([
        window.ipc.invoke('elevenlabs:createScribeToken', null),
        window.ipc.invoke('elevenlabs:createScribeToken', null),
    ]);
    const [micWs, sysWs] = await Promise.all([
        connectScribeRealtime(micToken.token),
        connectScribeRealtime(sysToken.token, { includeTimestamps: true }),
    ]);
    return { micWs, sysWs };
}

export function useMeetingTranscription(onAutoStop?: () => void) {
    const { refresh: refreshJobrakerRecruiterAccount } = useJobrakerRecruiterAccount();
    const [state, setState] = useState<MeetingTranscriptionState>('idle');
    const micWsRef = useRef<WebSocket | null>(null);
    const sysWsRef = useRef<WebSocket | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const systemStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const transcriptRef = useRef<TranscriptEntry[]>([]);
    const interimRef = useRef<Map<number, { speaker: string; text: string }>>(new Map());
    const notePathRef = useRef<string>('');
    const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onAutoStopRef = useRef(onAutoStop);
    onAutoStopRef.current = onAutoStop;
    const dateRef = useRef<string>('');
    const calendarEventRef = useRef<CalendarEventMeta | undefined>(undefined);

    const resetSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            console.log('[meeting] 2 minutes of silence — auto-stopping');
            onAutoStopRef.current?.();
        }, SILENCE_AUTO_STOP_MS);
    }, []);

    const writeTranscriptToFile = useCallback(async () => {
        if (!notePathRef.current) return;
        const entries = [...transcriptRef.current];
        for (const interim of interimRef.current.values()) {
            if (!interim.text) continue;
            if (entries.length > 0 && entries[entries.length - 1].speaker === interim.speaker) {
                entries[entries.length - 1] = { speaker: interim.speaker, text: entries[entries.length - 1].text + ' ' + interim.text };
            } else {
                entries.push({ speaker: interim.speaker, text: interim.text });
            }
        }
        if (entries.length === 0) return;
        const content = formatTranscript(entries, dateRef.current, calendarEventRef.current);
        try {
            await window.ipc.invoke('workspace:writeFile', {
                path: notePathRef.current,
                data: content,
                opts: { encoding: 'utf8' },
            });
        } catch (err) {
            console.error('[meeting] Failed to write transcript:', err);
        }
    }, []);

    const scheduleDebouncedWrite = useCallback(() => {
        if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        writeTimerRef.current = setTimeout(() => {
            void writeTranscriptToFile();
        }, 1000);
    }, [writeTranscriptToFile]);

    const handleScribeMessage = useCallback((streamKey: number, defaultSpeaker: string) => (event: MessageEvent) => {
        let data: ScribeServerMessage;
        try {
            data = JSON.parse(event.data as string) as ScribeServerMessage;
        } catch {
            return;
        }

        if (data.message_type === 'partial_transcript') {
            if (!data.text) return;
            resetSilenceTimer();
            interimRef.current.set(streamKey, { speaker: defaultSpeaker, text: data.text });
            scheduleDebouncedWrite();
            return;
        }

        if (
            data.message_type === 'committed_transcript'
            || data.message_type === 'committed_transcript_with_timestamps'
        ) {
            if (!data.text) return;
            resetSilenceTimer();
            interimRef.current.delete(streamKey);

            let speaker = defaultSpeaker;
            if (streamKey === 1) {
                const speakerId = speakerFromScribeMessage(data);
                speaker = speakerId ? `Speaker ${speakerId}` : 'Participant';
            }

            const entries = transcriptRef.current;
            if (entries.length > 0 && entries[entries.length - 1].speaker === speaker) {
                entries[entries.length - 1].text += ' ' + data.text;
            } else {
                entries.push({ speaker, text: data.text });
            }
            scheduleDebouncedWrite();
        }
    }, [resetSilenceTimer, scheduleDebouncedWrite]);

    const cleanup = useCallback(() => {
        if (writeTimerRef.current) {
            clearTimeout(writeTimerRef.current);
            writeTimerRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        if (systemStreamRef.current) {
            systemStreamRef.current.getTracks().forEach(t => t.stop());
            systemStreamRef.current = null;
        }
        for (const wsRef of [micWsRef, sysWsRef]) {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
        }
    }, []);

    const start = useCallback(async (calendarEvent?: CalendarEventMeta): Promise<string | null> => {
        if (state !== 'idle') return null;
        setState('connecting');

        const [headphoneResult, wsResult, micResult, systemResult] = await Promise.allSettled([
            detectHeadphones(),
            (async () => {
                const available = await hasScribeAccess(refreshJobrakerRecruiterAccount);
                if (!available) {
                    throw new Error('No ElevenLabs Scribe config available');
                }
                console.log('[meeting] Connecting ElevenLabs Scribe v2 Realtime');
                return openScribeConnections();
            })(),
            navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            }),
            (async () => {
                const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
                stream.getVideoTracks().forEach(t => t.stop());
                if (stream.getAudioTracks().length === 0) {
                    stream.getTracks().forEach(t => t.stop());
                    throw new Error('No audio track from getDisplayMedia');
                }
                console.log('[meeting] System audio captured');
                return stream;
            })(),
        ]);

        const failed = wsResult.status === 'rejected'
            || micResult.status === 'rejected'
            || systemResult.status === 'rejected';

        if (failed) {
            if (wsResult.status === 'rejected') {
                const reason = wsResult.reason;
                const missingScribe =
                    reason instanceof Error && reason.message === 'No ElevenLabs Scribe config available';
                if (missingScribe) {
                    toast.error('Meeting transcription unavailable', {
                        description:
                            'Sign in to Jobraker Recruiter or add an ElevenLabs API key in Settings → Connections.',
                    });
                } else {
                    toast.error('Could not start meeting transcription', {
                        description: reason instanceof Error ? reason.message : 'Please try again.',
                    });
                }
            }
            if (micResult.status === 'rejected') {
                toast.error('Microphone access denied', {
                    description: 'Allow microphone access to capture your side of the conversation.',
                });
            }
            if (systemResult.status === 'rejected') {
                toast.error('System audio capture failed', {
                    description: 'Allow screen or window sharing with audio to capture meeting participants.',
                });
            }
            if (wsResult.status === 'fulfilled') {
                wsResult.value.micWs.close();
                wsResult.value.sysWs.close();
            }
            if (micResult.status === 'fulfilled') { micResult.value.getTracks().forEach(t => t.stop()); }
            if (systemResult.status === 'fulfilled') { systemResult.value.getTracks().forEach(t => t.stop()); }
            cleanup();
            setState('idle');
            return null;
        }

        const usingHeadphones = headphoneResult.status === 'fulfilled' ? headphoneResult.value : false;
        console.log(`[meeting] Audio output mode: ${usingHeadphones ? 'headphones' : 'speakers'}`);

        const { micWs, sysWs } = wsResult.value;
        micWsRef.current = micWs;
        sysWsRef.current = sysWs;

        transcriptRef.current = [];
        interimRef.current = new Map();

        micWs.onmessage = handleScribeMessage(0, 'You');
        sysWs.onmessage = handleScribeMessage(1, 'Participant');

        micWs.onclose = () => { micWsRef.current = null; };
        sysWs.onclose = () => { sysWsRef.current = null; };

        const micStream = micResult.value;
        micStreamRef.current = micStream;

        const systemStream = systemResult.value;
        systemStreamRef.current = systemStream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const micSource = audioCtx.createMediaStreamSource(micStream);
        const systemSource = audioCtx.createMediaStreamSource(systemStream);
        const merger = audioCtx.createChannelMerger(2);

        micSource.connect(merger, 0, 0);
        systemSource.connect(merger, 0, 1);

        const processor = audioCtx.createScriptProcessor(4096, 2, 2);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            const micRaw = e.inputBuffer.getChannelData(0);
            const sysRaw = e.inputBuffer.getChannelData(1);

            let micOut: Float32Array;
            if (usingHeadphones) {
                micOut = micRaw;
            } else {
                let sysSum = 0;
                for (let i = 0; i < sysRaw.length; i++) sysSum += sysRaw[i] * sysRaw[i];
                const sysRms = Math.sqrt(sysSum / sysRaw.length);
                micOut = sysRms > SYSTEM_AUDIO_GATE_THRESHOLD
                    ? new Float32Array(micRaw.length)
                    : micRaw;
            }

            if (micWsRef.current?.readyState === WebSocket.OPEN) {
                sendScribeAudioChunk(micWsRef.current, float32ToInt16(micOut));
            }
            if (sysWsRef.current?.readyState === WebSocket.OPEN) {
                sendScribeAudioChunk(sysWsRef.current, float32ToInt16(sysRaw));
            }
        };

        merger.connect(processor);
        processor.connect(audioCtx.destination);

        const now = new Date();
        const dateStr = now.toISOString();
        dateRef.current = dateStr;
        const dateFolder = dateStr.split('T')[0];
        const timestamp = dateStr.replace(/:/g, '-').replace(/\.\d+Z$/, '');
        const filename = calendarEvent?.summary
            ? calendarEvent.summary.replace(/[\\/*?:"<>|]/g, '').replace(/\s+/g, '_').substring(0, 100).trim()
            : `meeting-${timestamp}`;
        const notePath = `knowledge/Meetings/jobraker-recruiter/${dateFolder}/${filename}.md`;
        notePathRef.current = notePath;
        calendarEventRef.current = calendarEvent;
        const initialContent = formatTranscript([], dateStr, calendarEvent);
        await window.ipc.invoke('workspace:writeFile', {
            path: notePath,
            data: initialContent,
            opts: { encoding: 'utf8', mkdirp: true },
        });

        setState('recording');
        return notePath;
    }, [state, cleanup, handleScribeMessage, refreshJobrakerRecruiterAccount]);

    const stop = useCallback(async () => {
        if (state !== 'recording') return;
        setState('stopping');

        cleanup();
        interimRef.current = new Map();
        await writeTranscriptToFile();

        setState('idle');
    }, [state, cleanup, writeTranscriptToFile]);

    return { state, start, stop };
}
