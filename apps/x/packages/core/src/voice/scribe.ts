import { isSignedIn } from '../account/account.js';
import { getAccessToken } from '../auth/tokens.js';
import { API_URL } from '../config/env.js';
import { getVoiceConfig } from './voice.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io';

async function resolveElevenLabsApiKey(): Promise<string> {
    const config = await getVoiceConfig();
    const apiKey = config.elevenlabs?.apiKey?.trim();
    if (apiKey) return apiKey;
    throw new Error('ElevenLabs API key not configured. Add it in Settings → Connections.');
}

async function fetchScribeTokenFromJobraker(): Promise<string | null> {
    const signedIn = await isSignedIn();
    if (!signedIn) return null;

    const accessToken = await getAccessToken();
    const response = await fetch(`${API_URL}/v1/single-use-token/realtime_scribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const data = await response.json() as { token?: string };
    return data.token?.trim() || null;
}

/** Single-use token for client-side Scribe v2 Realtime WebSocket connections. */
export async function createScribeRealtimeToken(): Promise<string> {
    const fromJobraker = await fetchScribeTokenFromJobraker();
    if (fromJobraker) return fromJobraker;

    const apiKey = await resolveElevenLabsApiKey();
    const response = await fetch(`${ELEVENLABS_API}/v1/single-use-token/realtime_scribe`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs Scribe token error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { token?: string };
    if (!data.token?.trim()) {
        throw new Error('ElevenLabs Scribe token response missing token');
    }
    return data.token;
}

function mimeToExtension(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    return 'audio';
}

/** Batch transcription with Scribe v2 for recorded voice memos. */
export async function transcribeAudioWithScribe(
    audioBase64: string,
    mimeType: string,
): Promise<string> {
    const apiKey = await resolveElevenLabsApiKey();
    const buffer = Buffer.from(audioBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `audio.${mimeToExtension(mimeType)}`);
    form.append('model_id', 'scribe_v2');
    form.append('language_code', 'eng');

    const response = await fetch(`${ELEVENLABS_API}/v1/speech-to-text`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form,
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs Scribe transcription error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { text?: string; transcripts?: Array<{ text?: string }> };
    if (typeof data.text === 'string' && data.text.trim()) {
        return data.text.trim();
    }
    if (Array.isArray(data.transcripts)) {
        const joined = data.transcripts
            .map((chunk) => chunk.text?.trim())
            .filter(Boolean)
            .join('\n');
        if (joined) return joined;
    }
    return '';
}
