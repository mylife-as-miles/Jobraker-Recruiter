import { useCallback, useRef, useState } from 'react';
import posthog from 'posthog-js';
import * as analytics from '@/lib/analytics';
import {
  connectScribeRealtime,
  float32ToInt16,
  sendScribeAudioChunk,
  type ScribeServerMessage,
} from '@/lib/elevenlabs-scribe';
import { useJobrakerRecruiterAccount } from '@/hooks/useJobrakerRecruiterAccount';

export type VoiceState = 'idle' | 'connecting' | 'listening';

export function useVoiceMode() {
    const { refresh: refreshJobrakerRecruiterAccount } = useJobrakerRecruiterAccount();
    const [state, setState] = useState<VoiceState>('idle');
    const [interimText, setInterimText] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const transcriptBufferRef = useRef('');
    const interimRef = useRef('');
    const audioBufferRef = useRef<Int16Array[]>([]);
    const scribeReadyRef = useRef(false);

    const refreshAuth = useCallback(async (): Promise<boolean> => {
        const account = await refreshJobrakerRecruiterAccount();
        if (account?.signedIn) return true;
        const config = await window.ipc.invoke('voice:getConfig', null);
        return !!config.elevenlabs;
    }, [refreshJobrakerRecruiterAccount]);

    const connectWs = useCallback(async () => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const available = await refreshAuth();
        if (!available) return;

        setState('connecting');
        scribeReadyRef.current = false;

        try {
            const { token } = await window.ipc.invoke('elevenlabs:createScribeToken', null);
            const ws = await connectScribeRealtime(token);
            wsRef.current = ws;
            scribeReadyRef.current = true;

            ws.onmessage = (event) => {
                let data: ScribeServerMessage;
                try {
                    data = JSON.parse(event.data as string) as ScribeServerMessage;
                } catch {
                    return;
                }

                if (data.message_type === 'partial_transcript' && data.text) {
                    interimRef.current = data.text;
                    setInterimText(
                        transcriptBufferRef.current
                            + (transcriptBufferRef.current ? ' ' : '')
                            + data.text,
                    );
                    return;
                }

                if (
                    (data.message_type === 'committed_transcript'
                        || data.message_type === 'committed_transcript_with_timestamps')
                    && data.text
                ) {
                    transcriptBufferRef.current += (transcriptBufferRef.current ? ' ' : '') + data.text;
                    interimRef.current = '';
                    setInterimText(transcriptBufferRef.current);
                }
            };

            const buffered = audioBufferRef.current;
            audioBufferRef.current = [];
            for (const chunk of buffered) {
                sendScribeAudioChunk(ws, chunk);
            }

            ws.onerror = () => {
                console.error('[voice] Scribe WebSocket error');
                scribeReadyRef.current = false;
            };

            ws.onclose = () => {
                console.log('[voice] Scribe WebSocket closed');
                wsRef.current = null;
                scribeReadyRef.current = false;
            };
        } catch (error) {
            console.error('[voice] Failed to connect Scribe:', error);
            scribeReadyRef.current = false;
            setState('idle');
        }
    }, [refreshAuth]);

    const stopAudioCapture = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        audioBufferRef.current = [];
        scribeReadyRef.current = false;
        setInterimText('');
        transcriptBufferRef.current = '';
        interimRef.current = '';
        setState('idle');
    }, []);

    const start = useCallback(async () => {
        if (state !== 'idle') return;

        transcriptBufferRef.current = '';
        interimRef.current = '';
        setInterimText('');
        audioBufferRef.current = [];

        setState('listening');
        analytics.voiceInputStarted();
        posthog.people.set_once({ has_used_voice: true });

        const [stream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
                console.error('Microphone access denied:', err);
                return null;
            }),
            connectWs(),
        ]);

        if (!stream) {
            stopAudioCapture();
            return;
        }

        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            const int16 = float32ToInt16(e.inputBuffer.getChannelData(0));
            const ws = wsRef.current;
            if (ws?.readyState === WebSocket.OPEN && scribeReadyRef.current) {
                sendScribeAudioChunk(ws, int16);
            } else {
                audioBufferRef.current.push(int16);
            }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
    }, [state, connectWs, stopAudioCapture]);

    const submit = useCallback((): string => {
        let text = transcriptBufferRef.current;
        if (interimRef.current) {
            text += (text ? ' ' : '') + interimRef.current;
        }
        text = text.trim();
        stopAudioCapture();
        return text;
    }, [stopAudioCapture]);

    const cancel = useCallback(() => {
        stopAudioCapture();
    }, [stopAudioCapture]);

    const warmup = useCallback(() => {
        refreshAuth().catch(() => {});
    }, [refreshAuth]);

    return { state, interimText, start, submit, cancel, warmup };
}
