// forkK14LocalVoiceInputV2

import * as FileSystem from 'expo-file-system/legacy';

export const DEFAULT_VOICE_MODEL = {
  id: 'whisper-base-multilingual-q5',
  /**
   * K14 keeps the URL configurable. Do not silently fetch models at app start.
   * User activation/download UI should call ensureVoiceModel().
   */
  url: '',
  filename: 'ggml-base-q5_1.bin',
};

export interface VoiceModelSpec {
  id: string;
  url: string;
  filename: string;
}

export function voiceModelPath(spec: VoiceModelSpec = DEFAULT_VOICE_MODEL): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('No writable document directory.');
  return root + 'ljingle-models/' + spec.filename;
}

export async function hasVoiceModel(spec: VoiceModelSpec = DEFAULT_VOICE_MODEL): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(voiceModelPath(spec));
  return info.exists;
}

export async function ensureVoiceModel(spec: VoiceModelSpec): Promise<string> {
  if (!spec.url) {
    throw new Error('Voice model URL is not configured. Choose/download a model explicitly.');
  }

  const file = voiceModelPath(spec);
  const dir = file.slice(0, file.lastIndexOf('/') + 1);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const info = await FileSystem.getInfoAsync(file);
  if (info.exists) return file;

  const result = await FileSystem.downloadAsync(spec.url, file);
  if (result.status < 200 || result.status >= 300) {
    throw new Error('Voice model download failed: HTTP ' + result.status);
  }
  return result.uri;
}

export async function deleteVoiceModel(spec: VoiceModelSpec = DEFAULT_VOICE_MODEL): Promise<void> {
  const file = voiceModelPath(spec);
  const info = await FileSystem.getInfoAsync(file);
  if (info.exists) await FileSystem.deleteAsync(file, { idempotent: true });
}
