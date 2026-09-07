// ljingleCoverAssetsMobileR2
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import {
  downloadApiArtworkFromServer,
  localCoverUriExists,
  mirrorApiArtworkToServer,
} from './coverAssetServer';

const DIRECTORY_NAME = 'api-artwork-cache';
const MAX_BYTES = 10 * 1024 * 1024;
const pending = new Map<string, Promise<string>>();
const memory = new Map<string, string>();

type ArtworkRow = {
  cache_key: string;
  local_uri: string;
  source_url: string;
  saved_at: string;
};

async function database() {
  const db = await getDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS api_artwork_cache (' +
      'cache_key TEXT PRIMARY KEY NOT NULL,' +
      'local_uri TEXT NOT NULL,' +
      'source_url TEXT NOT NULL,' +
      'saved_at TEXT NOT NULL' +
    ');'
  );
  return db;
}

function randomName(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + '.img';
}

async function blobToDataUri(blob: Blob) {
  if (!blob.size || blob.size > MAX_BYTES || !blob.type.startsWith('image/')) return null;
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function downloadProvider(sourceUrl: string) {
  if (!/^https:\/\//i.test(sourceUrl)) return null;

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(sourceUrl, { headers: { Accept: 'image/*' } });
      if (!response.ok) return null;
      return blobToDataUri(await response.blob());
    } catch {
      return null;
    }
  }

  if (!FileSystem.documentDirectory) return null;
  const directory = FileSystem.documentDirectory + DIRECTORY_NAME + '/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const finalUri = directory + randomName('provider');
  const temporary = finalUri + '.part';

  try {
    const result = await FileSystem.downloadAsync(sourceUrl, temporary, {
      headers: { Accept: 'image/*' },
    });
    if (result.status < 200 || result.status >= 300) return null;
    const info = await FileSystem.getInfoAsync(temporary);
    if (!info.exists || info.isDirectory || info.size <= 0 || info.size > MAX_BYTES) return null;
    await FileSystem.moveAsync({ from: temporary, to: finalUri });
    return finalUri;
  } catch {
    return null;
  } finally {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
  }
}

async function saveRow(key: string, uri: string, sourceUrl: string) {
  memory.set(key, uri);
  if (Platform.OS === 'web') return;
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO api_artwork_cache (cache_key, local_uri, source_url, saved_at) VALUES (?, ?, ?, ?)',
    key, uri, sourceUrl, new Date().toISOString(),
  );
}

async function resolveInternal(key: string, sourceUrl: string) {
  const inMemory = memory.get(key);
  if (inMemory && (await localCoverUriExists(inMemory))) {
    void mirrorApiArtworkToServer(key, sourceUrl).catch(() => undefined);
    return inMemory;
  }

  if (Platform.OS !== 'web') {
    const db = await database();
    const row = await db.getFirstAsync<ArtworkRow>(
      'SELECT cache_key, local_uri, source_url, saved_at FROM api_artwork_cache WHERE cache_key = ?',
      key,
    );
    if (row?.local_uri && (await localCoverUriExists(row.local_uri))) {
      memory.set(key, row.local_uri);
      void mirrorApiArtworkToServer(key, sourceUrl).catch(() => undefined);
      return row.local_uri;
    }
    if (row) await db.runAsync('DELETE FROM api_artwork_cache WHERE cache_key = ?', key);
  }

  const serverUri = await downloadApiArtworkFromServer(
    key,
    DIRECTORY_NAME,
    'server',
  ).catch(() => null);
  if (serverUri) {
    await saveRow(key, serverUri, sourceUrl);
    return serverUri;
  }

  const providerUri = await downloadProvider(sourceUrl);
  if (providerUri) {
    await saveRow(key, providerUri, sourceUrl);
    void mirrorApiArtworkToServer(key, sourceUrl).catch(() => undefined);
    return providerUri;
  }

  return sourceUrl;
}

export function resolveApiArtwork(key: string, sourceUrl: string) {
  const cleanKey = key.trim();
  const cleanUrl = sourceUrl.trim();
  if (!cleanKey || !/^https:\/\//i.test(cleanUrl)) return Promise.resolve(cleanUrl);

  const existing = pending.get(cleanKey);
  if (existing) return existing;
  const task = resolveInternal(cleanKey, cleanUrl).finally(() => pending.delete(cleanKey));
  pending.set(cleanKey, task);
  return task;
}
