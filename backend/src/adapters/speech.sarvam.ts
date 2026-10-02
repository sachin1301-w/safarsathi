import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SpeechAdapter } from './types';

const BASE_URL = 'https://api.sarvam.ai';
const TTS_MAX_CHARS = 2500; // bulbul:v3 limit
const CACHE_DIR = join(import.meta.dirname, '..', '..', '.cache', 'tts');

/**
 * Sarvam AI speech: saaras:v4 speech-to-text (23 languages, auto-detect) and
 * bulbul:v3 text-to-speech (11 languages). TTS results are cached on disk because
 * the demo key has very few credits and the same replies get spoken repeatedly.
 */
export class SarvamSpeechAdapter implements SpeechAdapter {
  readonly available = true;

  constructor(private apiKey: string) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  async transcribe(audio: Buffer, mimeType: string, languageCode?: string) {
    const form = new FormData();
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'm4a';
    // Android records .m4a and labels it audio/m4a, which Sarvam rejects; audio/mp4 is accepted.
    const type = /^audio\/(x-)?m4a\b/.test(mimeType) ? 'audio/mp4' : mimeType;
    form.append('file', new Blob([new Uint8Array(audio)], { type }), `speech.${ext}`);
    form.append('model', 'saaras:v4');
    form.append('mode', 'transcribe');
    form.append('language_code', languageCode ?? 'unknown');

    const res = await fetch(`${BASE_URL}/speech-to-text`, {
      method: 'POST',
      headers: { 'api-subscription-key': this.apiKey },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok)
      throw new Error(`Sarvam speech-to-text failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { transcript: string; language_code: string | null };
    return { text: body.transcript, languageCode: body.language_code ?? languageCode ?? 'en-IN' };
  }

  async synthesize(text: string, languageCode: string) {
    const input = text.slice(0, TTS_MAX_CHARS);
    const key = createHash('sha256').update(`${languageCode}\n${input}`).digest('hex');
    const cacheFile = join(CACHE_DIR, `${key}.json`);
    try {
      return JSON.parse(readFileSync(cacheFile, 'utf8')) as {
        audioBase64: string;
        mimeType: string;
      };
    } catch {
      // not cached yet
    }

    const res = await fetch(`${BASE_URL}/text-to-speech`, {
      method: 'POST',
      headers: { 'api-subscription-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input,
        language_code: languageCode,
        model: 'bulbul:v3',
        speaker: 'priya',
        output_audio_codec: 'mp3',
        speech_sample_rate: 22050,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok)
      throw new Error(`Sarvam text-to-speech failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { audios: string[] };
    const result = { audioBase64: body.audios.join(''), mimeType: 'audio/mpeg' };
    writeFileSync(cacheFile, JSON.stringify(result));
    return result;
  }
}

/** Used when no SARVAM_API_KEY is set: the app falls back to on-device speech. */
export class NoSpeechAdapter implements SpeechAdapter {
  readonly available = false;

  async transcribe(): Promise<never> {
    throw new Error('Speech-to-text is not configured (set SARVAM_API_KEY)');
  }

  async synthesize(): Promise<never> {
    throw new Error('Text-to-speech is not configured (set SARVAM_API_KEY)');
  }
}
