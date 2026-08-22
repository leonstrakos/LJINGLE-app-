import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const STORAGE_KEY = 'tracking_app_radio_theme';
const DATABASE_NAME = 'life_catalogue.db';

export type RadioThemeId = 'original' | 'inverted';

export const radioThemes: {
  id: RadioThemeId;
  name: string;
  description: string;
}[] = [
  {
    id: 'original',
    name: 'Original',
    description: 'Obojeno kućište, svijetli ekran i kontrola.',
  },
  {
    id: 'inverted',
    name: 'Inverted',
    description: 'Svijetlo kućište, obojeni ekran i kontrola.',
  },
];

function isRadioTheme(value: unknown): value is RadioThemeId {
  return value === 'original' || value === 'inverted';
}

function database() {
  const db = SQLite.openDatabaseSync(DATABASE_NAME);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);

  return db;
}

export function readRadioTheme(): RadioThemeId {
  try {
    if (Platform.OS === 'web') {
      const value = globalThis.localStorage?.getItem(STORAGE_KEY);
      return isRadioTheme(value) ? value : 'original';
    }

    const row = database().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      STORAGE_KEY,
    );

    return isRadioTheme(row?.setting_value)
      ? row.setting_value
      : 'original';
  } catch {
    return 'original';
  }
}

export function persistRadioTheme(value: RadioThemeId) {
  if (!isRadioTheme(value)) {
    throw new Error('Invalid radio theme');
  }

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
    return;
  }

  database().runSync(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON CONFLICT(setting_key)
     DO UPDATE SET setting_value = excluded.setting_value`,
    STORAGE_KEY,
    value,
  );
}

export const activeRadioThemeId = readRadioTheme();
