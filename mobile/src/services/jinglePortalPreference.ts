import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_KEY = 'ljingle_jingle_portal_enabled';
const FILE_NAME = 'ljingle-jingle-portal-preference.json';

let cachedValue: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

export async function getJinglePortalEnabled(): Promise<boolean> {
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

export async function setJinglePortalEnabled(value: boolean): Promise<void> {
  cachedValue = value;

  if (Platform.OS === 'web') {
    (globalThis as any).localStorage?.setItem(WEB_KEY, String(value));
  } else {
    const file = new File(Paths.document, FILE_NAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify({ enabled: value }));
  }

  listeners.forEach((listener) => listener(value));
}

export function subscribeJinglePortalEnabled(
  listener: (value: boolean) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
