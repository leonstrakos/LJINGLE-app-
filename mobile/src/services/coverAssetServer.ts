// ljingleCoverAssetsMobileR1
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getAuthToken } from '../auth/sessionStore';

const BASE = (
  process.env.EXPO_PUBLIC_LJINGLE_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
  'https://heraldsofthelion.org/ljingle-api'
).replace(/\/+$/, '') + '/cover-assets';

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const apiMirrored = new Set<string>();
const customMirrored = new Set<string>();
const apiPending = new Map<string, Promise<boolean>>();
const customPending = new Map<string, Promise<boolean>>();

function token() {
  return getAuthToken()?.trim() || '';
}

function authHeaders(json = false) {
  const value = token();
  if (!value) return null;
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + value,
    Accept: json ? 'application/json' : 'image/*',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function customKey(entityType: string, entityId: string) {
  return entityType + ':' + entityId;
}

function guessImageMime(uri: string) {
  const data = uri.match(/^data:(image\/[^;,]+)/i)?.[1];
  if (data) return data.toLowerCase();
  const clean = uri.toLowerCase().split('?')[0] ?? '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.avif')) return 'image/avif';
  if (clean.endsWith('.heic')) return 'image/heic';
  if (clean.endsWith('.heif')) return 'image/heif';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function customUrl(entityType: string, entityId: string) {
  return (
    BASE + '/custom/' +
    encodeURIComponent(entityType) + '/' +
    encodeURIComponent(entityId)
  );
}

function randomName(prefix: string) {
  return (
    prefix + '-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 10) + '.img'
  );
}

async function fetchTimed(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, Math.min(index + step, bytes.length)),
    );
  }
  const encoder = (globalThis as unknown as { btoa?: (value: string) => string }).btoa;
  if (!encoder) throw new Error('Base64 encoder unavailable.');
  return encoder(binary);
}

async function blobToDataUri(blob: Blob) {
  if (!blob.size || blob.size > MAX_BYTES || !blob.type.startsWith('image/')) {
    throw new Error('Invalid cover image.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Image read failed.'));
    reader.readAsDataURL(blob);
  });
}

async function downloadAuthenticatedImage(
  url: string,
  directoryName: string,
  prefix: string,
): Promise<{ uri: string; mimeType: string | null } | null> {
  const headers = authHeaders(false);
  if (!headers) return null;

  if (Platform.OS === 'web') {
    const response = await fetchTimed(url, { headers });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const blob = await response.blob();
    return { uri: await blobToDataUri(blob), mimeType: blob.type || null };
  }

  if (!FileSystem.documentDirectory) return null;
  const directory = FileSystem.documentDirectory + directoryName + '/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const name = randomName(prefix);
  const finalUri = directory + name;
  const temporary = finalUri + '.part';
  const download = FileSystem.createDownloadResumable(url, temporary, { headers });
  const timer = setTimeout(() => {
    void download.cancelAsync().catch(() => undefined);
  }, TIMEOUT_MS);

  try {
    const result = await download.downloadAsync();
    if (!result || result.status === 404) {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      return null;
    }
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      return null;
    }
    const info = await FileSystem.getInfoAsync(temporary);
    if (!info.exists || info.isDirectory || info.size <= 0 || info.size > MAX_BYTES) {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      return null;
    }
    await FileSystem.moveAsync({ from: temporary, to: finalUri });
    const responseHeaders = (result as unknown as { headers?: Record<string, string> }).headers;
    const mimeType = responseHeaders?.['Content-Type'] || responseHeaders?.['content-type'] || null;
    return { uri: finalUri, mimeType };
  } catch {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function localCoverUriExists(uri: string) {
  if (!uri) return false;
  if (/^data:image\//i.test(uri)) return true;
  if (Platform.OS === 'web') return true;
  if (!/^file:/i.test(uri)) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory && info.size > 0;
  } catch {
    return false;
  }
}

// ljingleCoverAssetsMobileR2
export async function downloadApiArtworkFromServer(
  key: string,
  directoryName = 'api-artwork-cache',
  prefix = 'server-artwork',
) {
  const result = await downloadAuthenticatedImage(
    BASE + '/api?key=' + encodeURIComponent(key),
    directoryName,
    prefix,
  );
  return result?.uri ?? null;
}

export function mirrorApiArtworkToServer(key: string, sourceUrl: string) {
  if (!/^https:\/\//i.test(sourceUrl) || apiMirrored.has(key)) {
    return Promise.resolve(false);
  }
  const existing = apiPending.get(key);
  if (existing) return existing;

  const task = (async () => {
    const headers = authHeaders(true);
    if (!headers) return false;
    try {
      const response = await fetchTimed(BASE + '/api', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, sourceUrl }),
      });
      if (!response.ok) return false;
      apiMirrored.add(key);
      return true;
    } catch {
      return false;
    }
  })();

  apiPending.set(key, task);
  void task.finally(() => apiPending.delete(key));
  return task;
}

export async function downloadApiBookCoverFromServer(key: string) {
  return downloadApiArtworkFromServer(key, 'book-cover-cache', 'server');
}

export function mirrorApiBookCoverToServer(key: string, sourceUrl: string) {
  return mirrorApiArtworkToServer(key, sourceUrl);
}

async function localUriBase64(uri: string) {
  if (Platform.OS !== 'web') {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma > 0 && /;base64/i.test(uri.slice(0, comma))) {
      return uri.slice(comma + 1);
    }
  }

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Custom cover could not be read.');
  const blob = await response.blob();
  if (!blob.size || blob.size > MAX_BYTES) throw new Error('Custom cover is too large.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return bytesToBase64(bytes);
}

export function uploadCustomCoverToServer(
  entityType: string,
  entityId: string,
  localUri: string,
  mimeType: string | null,
  fileName: string | null = null,
) {
  const key = customKey(entityType, entityId);
  if (customMirrored.has(key)) return Promise.resolve(true);
  const existing = customPending.get(key);
  if (existing) return existing;

  const task = (async () => {
    const headers = authHeaders(true);
    if (!headers || !(await localCoverUriExists(localUri))) return false;
    try {
      const base64 = await localUriBase64(localUri);
      if (!base64 || base64.length > Math.ceil(MAX_BYTES * 4 / 3) + 32) return false;
      const response = await fetchTimed(customUrl(entityType, entityId), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          base64,
          mimeType: mimeType || guessImageMime(localUri),
          fileName,
        }),
      });
      if (!response.ok) return false;
      customMirrored.add(key);
      return true;
    } catch {
      return false;
    }
  })();

  customPending.set(key, task);
  void task.finally(() => customPending.delete(key));
  return task;
}

export async function downloadCustomCoverFromServer(
  entityType: string,
  entityId: string,
) {
  const result = await downloadAuthenticatedImage(
    customUrl(entityType, entityId),
    'catalogue-cover-overrides',
    'server',
  );
  if (result) customMirrored.add(customKey(entityType, entityId));
  return result;
}

export async function deleteCustomCoverFromServer(
  entityType: string,
  entityId: string,
) {
  const headers = authHeaders(true);
  const key = customKey(entityType, entityId);
  customMirrored.delete(key);
  if (!headers) return false;
  try {
    const response = await fetchTimed(customUrl(entityType, entityId), {
      method: 'DELETE',
      headers,
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
