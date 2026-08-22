import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const STORAGE_KEY = 'tracking_app_catalogue_display_mode';
const DATABASE_NAME = 'life_catalogue.db';

export type CatalogueDisplayMode = 'rich' | 'compact';

function isMode(value: unknown): value is CatalogueDisplayMode {
  return value === 'rich' || value === 'compact';
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

function readStored(): CatalogueDisplayMode {
  try {
    if (Platform.OS === 'web') {
      const value = globalThis.localStorage?.getItem(STORAGE_KEY);
      return isMode(value) ? value : 'rich';
    }

    const row = database().getFirstSync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      STORAGE_KEY,
    );
    return isMode(row?.setting_value) ? row.setting_value : 'rich';
  } catch {
    return 'rich';
  }
}

let currentMode: CatalogueDisplayMode = readStored();
const listeners = new Set<() => void>();

export function getCatalogueDisplayMode(): CatalogueDisplayMode {
  return currentMode;
}

export function persistCatalogueDisplayMode(value: CatalogueDisplayMode) {
  if (!isMode(value)) throw new Error('Invalid catalogue display mode');

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } else {
    database().runSync(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
      STORAGE_KEY,
      value,
    );
  }

  currentMode = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCatalogueDisplayMode() {
  return useSyncExternalStore(
    subscribe,
    getCatalogueDisplayMode,
    getCatalogueDisplayMode,
  );
}
