import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_KEY = 'ljingle_ui_sound_effects_enabled';
const FILE_NAME = 'ljingle-ui-sound-preference.json';

let cachedValue: boolean | null = null;

export async function getUiSoundEffectsEnabled(): Promise<boolean> {
  if (cachedValue !== null) return cachedValue;

  try {
    if (Platform.OS === 'web') {
      const raw = (globalThis as any).localStorage?.getItem(WEB_KEY);
      cachedValue = raw === null || raw === undefined ? true : raw !== 'false';
      return cachedValue;
    }

    const file = new File(Paths.document, FILE_NAME);
    const raw = await file.text();
    const parsed = JSON.parse(raw) as { enabled?: unknown };
    cachedValue = parsed.enabled !== false;
    return cachedValue;
  } catch {
    cachedValue = true;
    return true;
  }
}

export async function setUiSoundEffectsEnabled(value: boolean): Promise<void> {
  cachedValue = value;

  if (Platform.OS === 'web') {
    (globalThis as any).localStorage?.setItem(WEB_KEY, String(value));
    return;
  }

  const file = new File(Paths.document, FILE_NAME);
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify({ enabled: value }));
}
