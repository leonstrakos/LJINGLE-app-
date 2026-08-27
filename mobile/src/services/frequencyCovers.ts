// forkBFrequencyCoverStorageV1
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';

const COVER_DIRECTORY_NAME = 'frequency-covers';

export type FrequencyCover = {
  trackId: string;
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  createdAt: string;
  modifiedAt: string;
};

export type PendingFrequencyCover = {
  sourceUri: string;
  fileName: string | null;
  mimeType: string | null;
};

type CoverRow = {
  track_id: string;
  uri: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
  modified_at: string;
};

function identifier() {
  return (
    'cover-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

async function databaseWithFrequencyCovers() {
  const database = await getDatabase();

  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS frequency_cover_attachments (' +
      'track_id TEXT PRIMARY KEY NOT NULL,' +
      'uri TEXT NOT NULL,' +
      'file_name TEXT,' +
      'mime_type TEXT,' +
      'created_at TEXT NOT NULL,' +
      'modified_at TEXT NOT NULL,' +
      'FOREIGN KEY (track_id) REFERENCES audio_tracks(track_id) ON DELETE CASCADE' +
    ');'
  );

  return database;
}

function mapRow(row: CoverRow): FrequencyCover {
  return {
    trackId: String(row.track_id),
    uri: String(row.uri),
    fileName: row.file_name ?? null,
    mimeType: row.mime_type ?? null,
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
  };
}

export async function pickFrequencyCover(): Promise<PendingFrequencyCover | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  return {
    sourceUri: asset.uri,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

function safeExtension(fileName: string | null) {
  if (!fileName) return '.jpg';
  const match = fileName.match(/\.([a-zA-Z0-9]{1,8})$/);
  return match?.[1] ? '.' + match[1].toLowerCase() : '.jpg';
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Cover se nije mogao učitati.'));
    reader.readAsDataURL(blob);
  });
}

async function persistCover(pending: PendingFrequencyCover) {
  if (Platform.OS === 'web') {
    if (pending.sourceUri.startsWith('data:')) return pending.sourceUri;

    const response = await fetch(pending.sourceUri);
    if (!response.ok) throw new Error('Cover se nije mogao učitati.');
    return blobToDataUri(await response.blob());
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('Lokalna mapa aplikacije nije dostupna.');
  }

  const directory = FileSystem.documentDirectory + COVER_DIRECTORY_NAME + '/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const destination =
    directory + identifier() + safeExtension(pending.fileName);

  await FileSystem.copyAsync({
    from: pending.sourceUri,
    to: destination,
  });

  return destination;
}

async function deleteOwnedUri(uri: string) {
  if (Platform.OS === 'web') return;
  if (!FileSystem.documentDirectory) return;

  const prefix = FileSystem.documentDirectory + COVER_DIRECTORY_NAME + '/';
  if (!uri.startsWith(prefix)) return;

  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function getFrequencyCover(trackId: string) {
  const database = await databaseWithFrequencyCovers();
  const row = await database.getFirstAsync<CoverRow>(
    'SELECT * FROM frequency_cover_attachments WHERE track_id = ? LIMIT 1',
    trackId,
  );
  return row ? mapRow(row) : null;
}

export async function getFrequencyCoverMap(trackIds: string[]) {
  const ids = Array.from(new Set(trackIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, string>;

  const database = await databaseWithFrequencyCovers();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await database.getAllAsync<CoverRow>(
    'SELECT * FROM frequency_cover_attachments WHERE track_id IN (' + placeholders + ')',
    ...ids,
  );

  return rows.reduce<Record<string, string>>((result, row) => {
    result[String(row.track_id)] = String(row.uri);
    return result;
  }, {});
}

export async function saveFrequencyCover(
  trackId: string,
  pending: PendingFrequencyCover,
) {
  const database = await databaseWithFrequencyCovers();
  const previous = await getFrequencyCover(trackId);
  const uri = await persistCover(pending);
  const now = new Date().toISOString();

  try {
    await database.runAsync(
      'INSERT INTO frequency_cover_attachments ' +
        '(track_id, uri, file_name, mime_type, created_at, modified_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(track_id) DO UPDATE SET ' +
        'uri=excluded.uri, file_name=excluded.file_name, mime_type=excluded.mime_type, modified_at=excluded.modified_at',
      trackId,
      uri,
      pending.fileName,
      pending.mimeType,
      previous?.createdAt ?? now,
      now,
    );
  } catch (error) {
    await deleteOwnedUri(uri).catch(() => undefined);
    throw error;
  }

  if (previous?.uri && previous.uri !== uri) {
    await deleteOwnedUri(previous.uri).catch(() => undefined);
  }

  return getFrequencyCover(trackId);
}

export async function removeFrequencyCover(trackId: string) {
  const database = await databaseWithFrequencyCovers();
  const previous = await getFrequencyCover(trackId);

  await database.runAsync(
    'DELETE FROM frequency_cover_attachments WHERE track_id = ?',
    trackId,
  );

  if (previous?.uri) {
    await deleteOwnedUri(previous.uri).catch(() => undefined);
  }
}

export async function cleanupFrequencyCoverAfterDelete(
  trackId: string,
  knownUri?: string | null,
) {
  const database = await databaseWithFrequencyCovers();
  await database.runAsync(
    'DELETE FROM frequency_cover_attachments WHERE track_id = ?',
    trackId,
  );

  if (knownUri) {
    await deleteOwnedUri(knownUri).catch(() => undefined);
  }
}
