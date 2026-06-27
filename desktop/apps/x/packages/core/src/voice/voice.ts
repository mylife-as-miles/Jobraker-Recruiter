import * as fs from 'fs/promises';
import * as path from 'path';
import { isSignedIn } from '../account/account.js';
import { getAccessToken } from '../auth/tokens.js';
import { WorkDir } from '../config/config.js';
import { API_URL } from '../config/env.js';

export interface VoiceConfig {
    elevenlabs: { apiKey: string; voiceId?: string } | null;
}

async function readJsonConfig(filename: string): Promise<Record<string, unknown> | null> {
    try {
        const configPath = path.join(WorkDir, 'config', filename);
        const raw = await fs.readFile(configPath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function getVoiceConfig(): Promise<VoiceConfig> {
    const elConfig = await readJsonConfig('elevenlabs.json');

    return {
        elevenlabs: elConfig?.apiKey
            ? { apiKey: elConfig.apiKey as string, voiceId: elConfig.voiceId as string | undefined }
            : null,
    };
}

export type ElevenLabsVoiceOption = {
    voice_id: string;
    name: string;
};

function normalizeElevenLabsVoice(voice: unknown): ElevenLabsVoiceOption | null {
    if (!voice || typeof voice !== 'object') return null;
    const record = voice as Record<string, unknown>;
    const voiceId = typeof record.voice_id === 'string'
        ? record.voice_id
        : typeof record.id === 'string'
            ? record.id
            : null;
    const name = typeof record.name === 'string' ? record.name : null;
    if (!voiceId || !name) return null;
    return { voice_id: voiceId, name };
}

async function fetchElevenLabsJson<T>(apiKey: string, url: string): Promise<T> {
    const response = await fetch(url, {
        headers: {
            'xi-api-key': apiKey,
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
    }

    return response.json() as Promise<T>;
}

export async function listElevenLabsVoices(apiKeyOverride?: string): Promise<ElevenLabsVoiceOption[]> {
    const config = await getVoiceConfig();
    const apiKey = apiKeyOverride?.trim() || config.elevenlabs?.apiKey;
    if (!apiKey) {
        throw new Error('ElevenLabs API key not configured. Add it in Settings → Connections.');
    }

    const byId = new Map<string, ElevenLabsVoiceOption>();
    const addVoices = (voices: unknown[]) => {
        for (const voice of voices) {
            const normalized = normalizeElevenLabsVoice(voice);
            if (normalized) {
                byId.set(normalized.voice_id, normalized);
            }
        }
    };

    // v2 — paginated list (recommended; first page includes default voices per ElevenLabs docs)
    try {
        let nextPageToken: string | null | undefined = undefined;
        for (let page = 0; page < 20; page += 1) {
            const params = new URLSearchParams({
                page_size: '100',
                sort: 'name',
                sort_direction: 'asc',
            });
            if (nextPageToken) {
                params.set('next_page_token', nextPageToken);
            }

            const data = await fetchElevenLabsJson<{
                voices?: unknown[];
                has_more?: boolean;
                next_page_token?: string | null;
            }>(apiKey, `https://api.elevenlabs.io/v2/voices?${params.toString()}`);

            addVoices(data.voices ?? []);
            if (!data.has_more || !data.next_page_token) break;
            nextPageToken = data.next_page_token;
        }
    } catch (error) {
        console.warn('[elevenlabs] v2 voice list failed, trying v1:', error);
    }

    // v1 — include legacy premade voices (show_legacy defaults to false in current API)
    try {
        const legacy = await fetchElevenLabsJson<{ voices?: unknown[] }>(
            apiKey,
            'https://api.elevenlabs.io/v1/voices?show_legacy=true',
        );
        addVoices(legacy.voices ?? []);
    } catch (error) {
        console.warn('[elevenlabs] v1 legacy voice list failed:', error);
    }

    if (byId.size === 0) {
        throw new Error(
            'No voices returned for this API key. Verify the key is valid and has Text-to-Speech access in your ElevenLabs workspace.',
        );
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function synthesizeSpeech(text: string): Promise<{ audioBase64: string; mimeType: string }> {
    const config = await getVoiceConfig();
    const signedIn = await isSignedIn();

    let url: string;
    let headers: Record<string, string>;

    if (signedIn) {
        const voiceId = config.elevenlabs?.voiceId || 'UgBBYS2sOqTuMpoF3BR0';
        const accessToken = await getAccessToken();
        url = `${API_URL}/v1/voice/text-to-speech/${voiceId}`;
        headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };
        console.log('[voice] synthesizing speech via Jobraker Recruiter proxy, text length:', text.length, 'voiceId:', voiceId);
    } else {
        if (!config.elevenlabs) {
            throw new Error(`ElevenLabs not configured. Create ${path.join(WorkDir, 'config', 'elevenlabs.json')} with { "apiKey": "<your-key>" }`);
        }
        const voiceId = config.elevenlabs.voiceId || 'UgBBYS2sOqTuMpoF3BR0';
        url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        headers = {
            'xi-api-key': config.elevenlabs.apiKey,
            'Content-Type': 'application/json',
        };
        console.log('[voice] synthesizing speech via ElevenLabs, text length:', text.length, 'voiceId:', voiceId);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        console.error('[voice] TTS API error:', response.status, errText);
        throw new Error(`TTS API error ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    console.log('[voice] synthesized audio, base64 length:', audioBase64.length);
    return { audioBase64, mimeType: 'audio/mpeg' };
}
