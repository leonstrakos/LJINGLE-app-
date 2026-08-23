import { Platform } from 'react-native';

import { getDatabaseConnection } from '../storage/databaseConnection';

const STORAGE_KEY = 'tracking_app_aero_background';

export type AeroBackgroundId = 'meadow' | 'ocean';

export const aeroBackgrounds: Array<{
  id: AeroBackgroundId;
  name: string;
  description: string;
}> = [
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Zelena brda, magla i otvoreno nebo.',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Plavi Frutiger svijet s morem i oblacima.',
  },
];

function isAeroBackgroundId(value: unknown): value is AeroBackgroundId {
  return value === 'meadow' || value === 'ocean';
}

function database() {
  const db = getDatabaseConnection();
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);
  return db;
}

export function readAeroBackground(): AeroBackgroundId {
  try {
    if (Platform.OS === 'web') {
      const value = globalThis.localStorage?.getItem(STORAGE_KEY);
      return isAeroBackgroundId(value) ? value : 'meadow';
    }

    const row = database().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      STORAGE_KEY,
    );

    return isAeroBackgroundId(row?.setting_value) ? row.setting_value : 'meadow';
  } catch {
    return 'meadow';
  }
}

export function persistAeroBackground(value: AeroBackgroundId) {
  if (!isAeroBackgroundId(value)) {
    throw new Error('Invalid Aero background');
  }

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
    return;
  }

  database().runSync(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    STORAGE_KEY,
    value,
  );
}

export const activeAeroBackgroundId = readAeroBackground();
