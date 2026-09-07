import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import {
  deleteCustomCoverFromServer,
  downloadCustomCoverFromServer,
  localCoverUriExists,
  uploadCustomCoverToServer,
} from './coverAssetServer';
// ljingleCoverAssetsMobileR1

export type CatalogueCoverEntityType =
  | 'BOOK'
  | 'MOVIE'
  | 'SERIES'
  | 'GAME';

export type PendingCatalogueCover = {
  sourceUri: string;
  fileName: string | null;
  mimeType: string | null;
};

type CoverRow = {
  entity_type: CatalogueCoverEntityType;
  entity_id: string;
  local_uri: string;
  source_filename: string | null;
  mime_type: string | null;
  created_at: string;
  modified_at: string;
};

type Listener = (
  entityType: CatalogueCoverEntityType,
  entityId: string,
  uri: string | null,
) => void;

const DIRECTORY_NAME = 'catalogue-cover-overrides';

const cache = new Map<string, string | null>();
const listeners = new Set<Listener>();

function cacheKey(
  entityType: CatalogueCoverEntityType,
  entityId: string,
) {
  return entityType + ':' + entityId;
}

async function databaseWithCoverOverrides() {
  const database = await getDatabase();

  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS catalogue_cover_overrides (' +
      'entity_type TEXT NOT NULL,' +
      'entity_id TEXT NOT NULL,' +
      'local_uri TEXT NOT NULL,' +
      'source_filename TEXT,' +
      'mime_type TEXT,' +
      'created_at TEXT NOT NULL,' +
      'modified_at TEXT NOT NULL,' +
      'PRIMARY KEY (entity_type, entity_id)' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_catalogue_cover_overrides_entity ' +
      'ON catalogue_cover_overrides(entity_type, entity_id);'
  );

  return database;
}

function emit(
  entityType: CatalogueCoverEntityType,
  entityId: string,
  uri: string | null,
) {
  cache.set(cacheKey(entityType, entityId), uri);

  for (const listener of listeners) {
    listener(entityType, entityId, uri);
  }
}

export function subscribeCatalogueCoverOverrides(
  listener: Listener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function peekCatalogueCoverOverride(
  entityType: CatalogueCoverEntityType,
  entityId: string,
) {
  return cache.get(cacheKey(entityType, entityId));
}

export async function getCatalogueCoverOverride(
  entityType: CatalogueCoverEntityType,
  entityId: string,
) {
  const key = cacheKey(entityType, entityId);

  if (cache.has(key)) {
    const cached = cache.get(key) ?? null;
    if (cached && await localCoverUriExists(cached)) {
      void uploadCustomCoverToServer(
        entityType,
        entityId,
        cached,
        null,
        null,
      ).catch(() => undefined);
      return cached;
    }
    if (cached) cache.delete(key);
  }

  const database = await databaseWithCoverOverrides();
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS catalogue_cover_remote_deletes (' +
      'entity_type TEXT NOT NULL,' +
      'entity_id TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'PRIMARY KEY (entity_type, entity_id)' +
    ');'
  );

  const tombstone = await database.getFirstAsync<{ created_at: string }>(
    'SELECT created_at FROM catalogue_cover_remote_deletes WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  if (tombstone) {
    const deleted = await deleteCustomCoverFromServer(entityType, entityId).catch(() => false);
    if (deleted) {
      await database.runAsync(
        'DELETE FROM catalogue_cover_remote_deletes WHERE entity_type = ? AND entity_id = ?',
        entityType,
        entityId,
      );
    }
    cache.set(key, null);
    return null;
  }

  const row = await database.getFirstAsync<CoverRow>(
    'SELECT * FROM catalogue_cover_overrides WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  const localUri = row?.local_uri ? String(row.local_uri) : null;
  if (localUri && await localCoverUriExists(localUri)) {
    cache.set(key, localUri);
    void uploadCustomCoverToServer(
      entityType,
      entityId,
      localUri,
      row?.mime_type ?? null,
      row?.source_filename ?? null,
    ).catch(() => undefined);
    return localUri;
  }

  if (localUri) {
    await database.runAsync(
      'DELETE FROM catalogue_cover_overrides WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId,
    );
  }

  const remote = await downloadCustomCoverFromServer(entityType, entityId).catch(() => null);
  if (!remote) {
    cache.set(key, null);
    return null;
  }

  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO catalogue_cover_overrides (' +
      'entity_type, entity_id, local_uri, source_filename, mime_type, created_at, modified_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(entity_type, entity_id) DO UPDATE SET ' +
      'local_uri=excluded.local_uri, source_filename=excluded.source_filename, ' +
      'mime_type=excluded.mime_type, modified_at=excluded.modified_at',
    entityType,
    entityId,
    remote.uri,
    row?.source_filename ?? 'server-restored-cover',
    remote.mimeType ?? row?.mime_type ?? null,
    row?.created_at ?? now,
    now,
  );

  cache.set(key, remote.uri);
  return remote.uri;
}

export async function pickCatalogueCover():
  Promise<PendingCatalogueCover | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0]!;

  return {
    sourceUri: asset.uri,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

function safeExtension(fileName: string | null) {
  if (!fileName) return '.jpg';

  const match = fileName.match(/\.([a-zA-Z0-9]{1,8})$/);

  return match
    ? '.' + match[1]!.toLowerCase()
    : '.jpg';
}

function identifier() {
  return (
    'cover-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));

    reader.onerror = () =>
      reject(
        reader.error ??
          new Error('Slika se nije mogla učitati.'),
      );

    reader.readAsDataURL(blob);
  });
}

async function persistCover(
  pending: PendingCatalogueCover,
) {
  if (Platform.OS === 'web') {
    if (pending.sourceUri.startsWith('data:')) {
      return pending.sourceUri;
    }

    const response = await fetch(pending.sourceUri);

    if (!response.ok) {
      throw new Error('Slika se nije mogla učitati.');
    }

    return blobToDataUri(await response.blob());
  }

  if (!FileSystem.documentDirectory) {
    throw new Error(
      'Lokalna mapa aplikacije nije dostupna.',
    );
  }

  const directory =
    FileSystem.documentDirectory +
    DIRECTORY_NAME +
    '/';

  await FileSystem.makeDirectoryAsync(directory, {
    intermediates: true,
  });

  const destination =
    directory +
    identifier() +
    safeExtension(pending.fileName);

  await FileSystem.copyAsync({
    from: pending.sourceUri,
    to: destination,
  });

  return destination;
}

async function deleteOwnedUri(uri: string) {
  if (Platform.OS === 'web') return;

  if (!FileSystem.documentDirectory) return;

  const prefix =
    FileSystem.documentDirectory +
    DIRECTORY_NAME +
    '/';

  if (!uri.startsWith(prefix)) return;

  await FileSystem.deleteAsync(uri, {
    idempotent: true,
  });
}

export async function saveCatalogueCoverOverride(
  entityType: CatalogueCoverEntityType,
  entityId: string,
  pending: PendingCatalogueCover,
) {
  const database = await databaseWithCoverOverrides();
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS catalogue_cover_remote_deletes (' +
      'entity_type TEXT NOT NULL,' +
      'entity_id TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'PRIMARY KEY (entity_type, entity_id)' +
    ');'
  );
  await database.runAsync(
    'DELETE FROM catalogue_cover_remote_deletes WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  const existing = await database.getFirstAsync<CoverRow>(
    'SELECT * FROM catalogue_cover_overrides WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  const persistedUri = await persistCover(pending);
  const now = new Date().toISOString();

  try {
    await database.runAsync(
      'INSERT INTO catalogue_cover_overrides (' +
        'entity_type, entity_id, local_uri, source_filename, mime_type, created_at, modified_at' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(entity_type, entity_id) DO UPDATE SET ' +
        'local_uri = excluded.local_uri, source_filename = excluded.source_filename, ' +
        'mime_type = excluded.mime_type, modified_at = excluded.modified_at',
      entityType,
      entityId,
      persistedUri,
      pending.fileName,
      pending.mimeType,
      existing?.created_at ?? now,
      now,
    );
  } catch (error) {
    await deleteOwnedUri(persistedUri).catch(() => undefined);
    throw error;
  }

  if (existing?.local_uri && existing.local_uri !== persistedUri) {
    await deleteOwnedUri(String(existing.local_uri)).catch(() => undefined);
  }

  emit(entityType, entityId, persistedUri);
  void uploadCustomCoverToServer(
    entityType,
    entityId,
    persistedUri,
    pending.mimeType,
    pending.fileName,
  ).catch(() => undefined);

  return persistedUri;
}

export async function deleteCatalogueCoverOverride(
  entityType: CatalogueCoverEntityType,
  entityId: string,
) {
  const database = await databaseWithCoverOverrides();
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS catalogue_cover_remote_deletes (' +
      'entity_type TEXT NOT NULL,' +
      'entity_id TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'PRIMARY KEY (entity_type, entity_id)' +
    ');'
  );

  const existing = await database.getFirstAsync<CoverRow>(
    'SELECT * FROM catalogue_cover_overrides WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  await database.runAsync(
    'INSERT OR REPLACE INTO catalogue_cover_remote_deletes (entity_type, entity_id, created_at) VALUES (?, ?, ?)',
    entityType,
    entityId,
    new Date().toISOString(),
  );

  await database.runAsync(
    'DELETE FROM catalogue_cover_overrides WHERE entity_type = ? AND entity_id = ?',
    entityType,
    entityId,
  );

  if (existing?.local_uri) {
    await deleteOwnedUri(String(existing.local_uri)).catch(() => undefined);
  }

  emit(entityType, entityId, null);

  const deleted = await deleteCustomCoverFromServer(entityType, entityId).catch(() => false);
  if (deleted) {
    await database.runAsync(
      'DELETE FROM catalogue_cover_remote_deletes WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId,
    );
  }
}
