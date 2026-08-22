import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const STORAGE_KEY = 'tracking_app_visual_skin';
const DATABASE_NAME = 'life_catalogue.db';

export type VisualSkinId = 'classic' | 'pixel' | 'aero';

export type VisualSkinDefinition = {
  id: VisualSkinId;
  name: string;
  shortName: string;
  description: string;
  specimen: string;
  tokens: {
    radius: 'current' | 'none' | 'bubble';
    typography: 'current' | 'pixel' | 'aero';
    shadow: 'soft' | 'hard' | 'glass';
    decoration: 'none' | 'dither' | 'sky';
  };
};

export const visualSkins: VisualSkinDefinition[] = [
  {
    id: 'classic',
    name: 'LJingle Classic',
    shortName: 'CLASSIC',
    description: 'Trenutačni izgled, accent wheel i mekane kartice.',
    specimen: '●  LJINGLE',
    tokens: { radius: 'current', typography: 'current', shadow: 'soft', decoration: 'none' },
  },
  {
    id: 'pixel',
    name: 'Pixel Mono',
    shortName: '8-BIT',
    description: 'Crno-bijelo, pravokutno, bitmap ritam i dithering.',
    specimen: '██████░░ 75%',
    tokens: { radius: 'none', typography: 'pixel', shadow: 'hard', decoration: 'dither' },
  },
  {
    id: 'aero',
    name: 'Frutiger Aero',
    shortName: 'AERO',
    description: 'Nebo, voda, staklo, sjaj i optimistični digitalni svijet.',
    specimen: '◉  BLUE_SKY',
    tokens: { radius: 'bubble', typography: 'aero', shadow: 'glass', decoration: 'sky' },
  },
];

function isVisualSkin(value: unknown): value is VisualSkinId {
  return value === 'classic' || value === 'pixel' || value === 'aero';
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

export function readVisualSkin(): VisualSkinId {
  try {
    if (Platform.OS === 'web') {
      const value = globalThis.localStorage?.getItem(STORAGE_KEY);
      return isVisualSkin(value) ? value : 'classic';
    }
    const row = database().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      STORAGE_KEY,
    );
    return isVisualSkin(row?.setting_value) ? row.setting_value : 'classic';
  } catch {
    return 'classic';
  }
}

export function persistVisualSkin(value: VisualSkinId) {
  if (!isVisualSkin(value)) throw new Error('Invalid visual skin');
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

export const activeVisualSkinId = readVisualSkin();
export const activeVisualSkin = visualSkins.find((skin) => skin.id === activeVisualSkinId) ?? visualSkins[0];
