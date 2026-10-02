// Voice in and out. Sarvam AI (via the backend) when configured, on-device speech otherwise.
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useCallback, useState } from 'react';

import { api } from './api';

let current: AudioPlayer | null = null;

export function stopSpeaking() {
  Speech.stop();
  if (current) {
    current.remove();
    current = null;
  }
}

/**
 * Reads text aloud in the given language. Uses Sarvam's natural Indian voices when the
 * backend has a key (replies are cached server-side), and the phone's TTS otherwise.
 */
export async function speak(text: string, languageCode: string, useSarvam: boolean): Promise<void> {
  stopSpeaking();
  if (useSarvam) {
    try {
      const { audioBase64 } = await api.synthesize(text, languageCode);
      const file = new File(Paths.cache, `reply-${Date.now()}.mp3`);
      file.write(audioBase64, { encoding: 'base64' });
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const player = createAudioPlayer(file.uri);
      current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish && current === player) stopSpeaking();
      });
      player.play();
      return;
    } catch {
      // Fall through to on-device speech.
    }
  }
  Speech.speak(text, { language: languageCode, rate: 0.95 });
}

export type RecorderState = 'idle' | 'recording' | 'transcribing';

/** Tap to start, tap again to stop and transcribe with Sarvam speech-to-text. */
export function useVoiceInput(
  onText: (text: string, languageCode: string) => void,
  languageCode: string,
) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Microphone permission is needed for voice input.');
      return;
    }
    stopSpeaking();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState('recording');
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) {
      setState('idle');
      return;
    }
    setState('transcribing');
    try {
      const audio = await new File(uri).base64();
      // Let Sarvam auto-detect the language when the user picked English: people code-mix.
      const hint = languageCode === 'en-IN' ? undefined : languageCode;
      const result = await api.transcribe(audio, 'audio/m4a', hint);
      if (result.text.trim()) onText(result.text.trim(), result.languageCode);
      else setError("I didn't catch that. Try again?");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState('idle');
    }
  }, [recorder, languageCode, onText]);

  return { state, error, start, stop };
}
