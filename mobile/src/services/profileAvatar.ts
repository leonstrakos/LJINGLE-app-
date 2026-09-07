// ljinglePortalAvatarMobileR1
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { socialApi, socialImageSource } from './socialApi';
import type { SocialProfile } from '../types/social';

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export type PendingProfileAvatar = {
  sourceUri: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
};

// ljinglePortalAvatarDisplayR2
function avatarCacheKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ljinglePortalAvatarEndToEndR3
function avatarExtensionFromContentType(value: string | null | undefined) {
  const clean = String(value || '').split(';')[0]?.trim().toLowerCase();
  if (clean === 'image/jpeg' || clean === 'image/jpg') return '.jpg';
  if (clean === 'image/png') return '.png';
  if (clean === 'image/webp') return '.webp';
  if (clean === 'image/heic') return '.heic';
  if (clean === 'image/heif') return '.heif';
  return '.img';
}

function downloadedContentType(headers: Record<string, string> | undefined) {
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') return value;
  }
  return null;
}

// ljinglePortalAvatarFetchDataUriR4
function avatarMimeFromResponse(value: string | null | undefined) {
  const clean = String(value || '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();

  if (
    clean === 'image/jpeg' ||
    clean === 'image/jpg' ||
    clean === 'image/png' ||
    clean === 'image/webp' ||
    clean === 'image/heic' ||
    clean === 'image/heif'
  ) {
    return clean === 'image/jpg' ? 'image/jpeg' : clean;
  }

  return 'image/jpeg';
}

// ljinglePortalAvatarTypedCacheR5
type AvatarRasterKind =
  | { mimeType: 'image/jpeg'; extension: '.jpg' }
  | { mimeType: 'image/png'; extension: '.png' }
  | { mimeType: 'image/webp'; extension: '.webp' }
  | { mimeType: 'image/heic'; extension: '.heic' }
  | { mimeType: 'image/heif'; extension: '.heif' };

function avatarRasterKind(bytes: Uint8Array): AvatarRasterKind | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: '.png' };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: '.webp' };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp'
  ) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();

    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
      return { mimeType: 'image/heic', extension: '.heic' };
    }

    if (['heif', 'mif1', 'msf1'].includes(brand)) {
      return { mimeType: 'image/heif', extension: '.heif' };
    }
  }

  return null;
}

export async function resolveProfileAvatarUri(
  value: string | null | undefined,
): Promise<string | null> {
  const source = socialImageSource(value);
  if (!source) return null;

  if (Platform.OS === 'web' || !source.headers?.Authorization) {
    return source.uri;
  }

  // Authenticated GET works reliably; avoid native downloadAsync entirely.
  const response = await fetch(source.uri, {
    method: 'GET',
    headers: source.headers,
  });

  if (!response.ok) {
    throw new Error(
      'Avatar image request failed with HTTP ' +
        response.status +
        '.',
    );
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!bytes.length) {
    throw new Error('Avatar image response je prazan.');
  }

  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new Error('Avatar može imati najviše 4 MB.');
  }

  const kind = avatarRasterKind(bytes);

  if (!kind) {
    throw new Error(
      'Server je vratio format avatara koji aplikacija ne prepoznaje.',
    );
  }

  // Android RN preview can display HEIC through the picker/content provider,
  // while a later standalone RN Image decode may render it black.
  // Without adding a native transcoder, refuse that format explicitly.
  if (
    Platform.OS === 'android' &&
    (kind.mimeType === 'image/heic' || kind.mimeType === 'image/heif')
  ) {
    throw new Error(
      'Ova fotografija je HEIC/HEIF. Android build je može prikazati u pickeru, ' +
        'ali Portal avatar decoder je prikazuje crno. Odaberi JPEG, PNG ili WEBP sliku.',
    );
  }

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) {
    throw new Error('Avatar cache directory nije dostupan.');
  }

  const directory = cacheRoot + 'ljingle-portal-avatars/';
  await FileSystem.makeDirectoryAsync(directory, {
    intermediates: true,
  });

  const key = avatarCacheKey(source.uri);
  const destination = directory + key + kind.extension;

  // Remove all previous representations for this avatar URL, including R2/R3.
  for (const extension of [
    '.img',
    '.download',
    '.jpg',
    '.png',
    '.webp',
    '.heic',
    '.heif',
  ]) {
    const candidate = directory + key + extension;
    if (candidate === destination) continue;

    await FileSystem.deleteAsync(candidate, {
      idempotent: true,
    }).catch(() => undefined);
  }

  // R4 proved fetch() succeeds. Write those exact bytes ourselves instead of
  // asking expo-file-system's native downloader to perform the HTTP request.
  await FileSystem.writeAsStringAsync(
    destination,
    bytesToBase64(bytes),
    { encoding: FileSystem.EncodingType.Base64 },
  );

  const info = await FileSystem.getInfoAsync(destination);

  if (
    !info.exists ||
    info.isDirectory ||
    (info.size ?? 0) <= 0
  ) {
    await FileSystem.deleteAsync(destination, {
      idempotent: true,
    }).catch(() => undefined);

    throw new Error('Avatar cache nije valjan nakon spremanja.');
  }

  return destination;
}

export async function pickProfileAvatar(): Promise<PendingProfileAvatar | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  const size = typeof asset.size === 'number' ? asset.size : null;

  if (size != null && size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar može imati najviše 4 MB.');
  }

  return {
    sourceUri: asset.uri,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
    size,
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, Math.min(index + step, bytes.length)),
    );
  }
  const encode = (globalThis as unknown as { btoa?: (value: string) => string }).btoa;
  if (!encode) throw new Error('Base64 encoder nije dostupan.');
  return encode(binary);
}

async function avatarBase64(pending: PendingProfileAvatar) {
  if (Platform.OS !== 'web') {
    const base64 = await FileSystem.readAsStringAsync(pending.sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length > Math.ceil(MAX_AVATAR_BYTES * 4 / 3) + 64) {
      throw new Error('Avatar može imati najviše 4 MB.');
    }
    return base64;
  }

  const response = await fetch(pending.sourceUri);
  if (!response.ok) throw new Error('Avatar se nije mogao učitati.');
  const blob = await response.blob();
  if (!blob.size || blob.size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar može imati najviše 4 MB.');
  }
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

export async function saveProfileAvatar(
  pending: PendingProfileAvatar,
): Promise<SocialProfile> {
  const base64 = await avatarBase64(pending);
  const result = await socialApi.uploadAvatar({
    base64,
    mimeType: pending.mimeType,
    fileName: pending.fileName,
  });

  const avatarUrl = result.profile?.avatarUrl?.trim() || null;
  if (!avatarUrl) {
    throw new Error('Server je prihvatio avatar, ali nije vratio avatarUrl. Provjeri Portal avatar server patch.');
  }

  // Verify the complete path immediately: upload -> protected GET -> local cache.
  // This prevents a silent success followed by the initial fallback.
  try {
    const localUri = await resolveProfileAvatarUri(avatarUrl);
    if (!localUri) throw new Error('Avatar resolver returned no file.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error('Avatar je uploadan, ali ga aplikacija ne može preuzeti: ' + detail);
  }

  return result.profile;
}

export async function removeProfileAvatar(): Promise<SocialProfile> {
  const result = await socialApi.deleteAvatar();
  return result.profile;
}
