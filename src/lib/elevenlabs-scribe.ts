export const SCRIBE_REALTIME_MODEL = 'scribe_v2_realtime';
export const SCRIBE_SAMPLE_RATE = 16000;

export type ScribeServerMessage = {
  message_type: string;
  text?: string;
  error?: string;
  words?: Array<{ speaker_id?: string | null }>;
};

export function float32ToInt16(samples: Float32Array): Int16Array {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function pcm16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function sendScribeAudioChunk(ws: WebSocket, int16: Int16Array, sampleRate = SCRIBE_SAMPLE_RATE): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    message_type: 'input_audio_chunk',
    audio_base_64: pcm16ToBase64(int16),
    sample_rate: sampleRate,
    commit: false,
  }));
}

export function buildScribeRealtimeUrl(token: string, includeTimestamps = false): string {
  const params = new URLSearchParams({
    model_id: SCRIBE_REALTIME_MODEL,
    token,
    commit_strategy: 'vad',
    audio_format: 'pcm_16000',
    language_code: 'en',
  });
  if (includeTimestamps) {
    params.set('include_timestamps', 'true');
  }
  return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
}

export async function connectScribeRealtime(
  token: string,
  options?: { includeTimestamps?: boolean },
): Promise<WebSocket> {
  const ws = new WebSocket(buildScribeRealtimeUrl(token, options?.includeTimestamps ?? false));

  await new Promise<void>((resolve, reject) => {
    let opened = false;
    let started = false;

    const tryResolve = () => {
      if (opened && started) resolve();
    };

    const timeout = window.setTimeout(() => {
      reject(new Error('Scribe connection timed out'));
    }, 10000);

    const fail = (message: string) => {
      window.clearTimeout(timeout);
      reject(new Error(message));
    };

    ws.onopen = () => {
      opened = true;
      tryResolve();
    };

    ws.onmessage = (event) => {
      let data: ScribeServerMessage;
      try {
        data = JSON.parse(event.data as string) as ScribeServerMessage;
      } catch {
        return;
      }

      if (data.message_type === 'session_started') {
        started = true;
        window.clearTimeout(timeout);
        tryResolve();
        return;
      }

      if (
        data.message_type === 'auth_error'
        || data.message_type === 'error'
        || data.message_type === 'quota_exceeded'
      ) {
        fail(data.error ?? 'Scribe authentication failed');
      }
    };

    ws.onerror = () => {
      fail('Scribe WebSocket error');
    };
  });

  ws.onmessage = null;
  return ws;
}

export function speakerFromScribeMessage(data: ScribeServerMessage): string | undefined {
  if (!Array.isArray(data.words)) return undefined;
  for (const word of data.words) {
    if (word.speaker_id) return word.speaker_id;
  }
  return undefined;
}
