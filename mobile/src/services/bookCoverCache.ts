import * as FileSystem from 'expo-file-system/legacy';
import { Image, Platform } from 'react-native';
import { getDatabase } from '../storage/database';
import { downloadApiBookCoverFromServer, mirrorApiBookCoverToServer } from './coverAssetServer';
// ljingleCoverAssetsMobileR1

// ljingleOfflineBookCoversV1: SQL metadata + durable image files, shared across sizes.
type CoverRow = { local_path: string; remote_url: string };
const pending = new Map<string, Promise<string>>();
let active = 0;
const waiting: Array<() => void> = [];
async function slot() {
  if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  return () => { const next = waiting.shift(); if (next) next(); else active--; };
}
export function bookCoverCacheKey(isbn: string, title: string, author?: string) {
  const id = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  return id ? 'isbn:' + id : JSON.stringify([title.trim().toLowerCase(), (author || '').trim().toLowerCase()]);
}
async function database() {
  const db = await getDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS book_cover_cache (
    cache_key TEXT PRIMARY KEY NOT NULL,
    local_path TEXT NOT NULL,
    remote_url TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );`);
  return db;
}
function directory() {
  if (!FileSystem.documentDirectory) throw new Error('Local image storage unavailable');
  return FileSystem.documentDirectory + 'book-cover-cache/';
}
export async function getCachedBookCover(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<CoverRow>(
    'SELECT local_path, remote_url FROM book_cover_cache WHERE cache_key = ?',
    key,
  );

  if (row) {
    if (Platform.OS === 'web') {
      if (row.local_path.startsWith('data:image/')) {
        if (/^https:\/\//i.test(row.remote_url)) {
          void mirrorApiBookCoverToServer(key, row.remote_url).catch(() => undefined);
        }
        return row.local_path;
      }
    } else if (/^[a-zA-Z0-9-]+\.img$/.test(row.local_path)) {
      const uri = directory() + row.local_path;
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory && info.size > 0) {
        if (/^https:\/\//i.test(row.remote_url)) {
          void mirrorApiBookCoverToServer(key, row.remote_url).catch(() => undefined);
        }
        return uri;
      }
    }

    await db.runAsync(
      'DELETE FROM book_cover_cache WHERE cache_key = ?',
      key,
    );
  }

  const restored = await downloadApiBookCoverFromServer(key).catch(() => null);
  if (!restored) return null;

  const storedPath = Platform.OS === 'web'
    ? restored
    : restored.slice(restored.lastIndexOf('/') + 1);

  await db.runAsync(
    'INSERT OR REPLACE INTO book_cover_cache (cache_key, local_path, remote_url, saved_at) VALUES (?, ?, ?, ?)',
    key,
    storedPath,
    'ljingle-server:' + key,
    new Date().toISOString(),
  );

  return restored;
}
export async function forgetBrokenBookCover(key: string, uri: string) {
  const db = await database();
  const localPath = Platform.OS === 'web' ? uri : uri.slice(uri.lastIndexOf('/') + 1);
  await db.runAsync('DELETE FROM book_cover_cache WHERE cache_key = ? AND local_path = ?', key, localPath);
  if (Platform.OS !== 'web' && uri.startsWith(directory())) await FileSystem.deleteAsync(uri, { idempotent: true });
}
function validateImage(uri: string) {
  return new Promise<void>((resolve, reject) => Image.getSize(uri,
    (width, height) => width > 1 && height > 1 ? resolve() : reject(new Error('Empty cover')),
    reject));
}
export function persistBookCover(key: string, remoteUrl: string): Promise<string> {
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const cached = await getCachedBookCover(key);
    if (cached) return cached;
    if (!/^https:\/\//i.test(remoteUrl)) throw new Error('Expected HTTPS cover URL');
    const release = await slot();
    let temporary: string | null = null;
    let finalUri: string | null = null;
    let committed = false;
    try {
      const db = await database();
      let storedPath: string;
      if (Platform.OS === 'web') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(remoteUrl, { signal: controller.signal });
          if (!response.ok) throw new Error('Cover download failed');
          const blob = await response.blob();
          if (!blob.type.startsWith('image/') || !blob.size || blob.size > 8 * 1024 * 1024) throw new Error('Invalid cover');
          storedPath = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          await validateImage(storedPath);
        } finally { clearTimeout(timeout); }
      } else {
        const folder = directory();
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
        storedPath = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '.img';
        temporary = folder + storedPath + '.part';
        const download = FileSystem.createDownloadResumable(remoteUrl, temporary);
        const timeout = setTimeout(() => { void download.cancelAsync().catch(() => undefined); }, 20000);
        try {
          const result = await download.downloadAsync();
          if (!result || result.status < 200 || result.status >= 300) throw new Error('Cover download failed');
        } finally { clearTimeout(timeout); }
        const info = await FileSystem.getInfoAsync(temporary);
        if (!info.exists || info.isDirectory || info.size <= 0 || info.size > 8 * 1024 * 1024) throw new Error('Invalid cover size');
        await validateImage(temporary);
        finalUri = folder + storedPath;
        await FileSystem.moveAsync({ from: temporary, to: finalUri });
        temporary = null;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO book_cover_cache (cache_key, local_path, remote_url, saved_at) VALUES (?, ?, ?, ?)',
        key,
        storedPath,
        remoteUrl,
        new Date().toISOString(),
      );
      committed = true;
      void mirrorApiBookCoverToServer(key, remoteUrl).catch(() => undefined);
      return Platform.OS === 'web' ? storedPath : finalUri!;
    } finally {
      if (temporary) await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      if (finalUri && !committed) await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => undefined);
      release();
    }
  })();
  pending.set(key, task);
  void task.then(() => pending.delete(key), () => pending.delete(key));
  return task;
}
