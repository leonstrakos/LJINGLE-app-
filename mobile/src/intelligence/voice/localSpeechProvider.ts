// forkK14LocalVoiceInputV2

import { Platform, PermissionsAndroid } from 'react-native';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import type { VoiceTranscript } from './types';

let whisper: WhisperContext | null = null;
let loadedPath: string | null = null;

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'LJingle microphone',
        message: 'LJingle uses the microphone only while you hold the voice control.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return permission === PermissionsAndroid.RESULTS.GRANTED;
  }

  // iOS permission is requested by the native audio recorder / whisper integration.
  return true;
}

export async function loadLocalSpeechModel(modelPath: string): Promise<void> {
  if (whisper && loadedPath === modelPath) return;
  if (whisper) {
    try { await whisper.release(); } catch {}
    whisper = null;
  }
  whisper = await initWhisper({ filePath: modelPath });
  loadedPath = modelPath;
}

export async function unloadLocalSpeechModel(): Promise<void> {
  if (!whisper) return;
  try { await whisper.release(); } finally {
    whisper = null;
    loadedPath = null;
  }
}

/**
 * K14.0 receives an already-recorded local audio file.
 * Recording is intentionally separate from inference.
 */
export async function transcribeLocalAudio(
  audioPath: string,
  options: { language?: string; translate?: boolean } = {},
): Promise<VoiceTranscript> {
  if (!whisper) throw new Error('Local speech model is not loaded.');

  const started = Date.now();
  const { promise } = whisper.transcribe(audioPath, {
    language: options.language ?? 'auto',
    translate: options.translate ?? false,
    maxThreads: 4,
  });

  const result = await promise;
  return {
    text: String(result.result ?? '').trim(),
    detectedLanguage: (result as any).language,
    durationMs: Date.now() - started,
  };
}
