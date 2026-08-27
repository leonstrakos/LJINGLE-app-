import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_KEY = 'ljingle_jingle_background_enabled';
const FILE_NAME = 'ljingle-jingle-style-preference.json';

let cachedBackground: boolean | null = null;
const listeners = new Set<(enabled: boolean) => void>();

export async function getJingleBackgroundEnabled(): Promise<boolean> {
  if (cachedBackground !== null) return cachedBackground;

  try {
    if (Platform.OS === 'web') {
      const raw = (globalThis as any).localStorage?.getItem(WEB_KEY);
      cachedBackground = raw === null || raw === undefined ? false : raw === 'true';
      return cachedBackground;
    }

    const file = new File(Paths.document, FILE_NAME);
    const raw = await file.text();
    const parsed = JSON.parse(raw) as { backgroundEnabled?: unknown };
    cachedBackground = parsed.backgroundEnabled === true;
    return cachedBackground;
  } catch {
    cachedBackground = false;
    return false;
  }
}

export async function setJingleBackgroundEnabled(
  enabled: boolean,
): Promise<void> {
  cachedBackground = enabled;

  if (Platform.OS === 'web') {
    (globalThis as any).localStorage?.setItem(WEB_KEY, String(enabled));
  } else {
    const file = new File(Paths.document, FILE_NAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify({ backgroundEnabled: enabled }));
  }

  listeners.forEach((listener) => listener(enabled));
}

export function subscribeJingleBackgroundEnabled(
  listener: (enabled: boolean) => void,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
