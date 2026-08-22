import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getDatabase } from '../storage/database';

const IMAGE_DIRECTORY_NAME = 'entry-images';

export type EntryImageAttachment = {
  attachmentId: string;
  entryId: string;
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  createdAt: string;
};

export type PendingEntryImage = {
  tempId: string;
  sourceUri: string;
  fileName: string | null;
  mimeType: string | null;
};

type ImageRow = {
  attachment_id: string;
  entry_id: string;
  uri: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
};

function identifier() {
  return (
    'img-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

async function databaseWithEntryImages() {
  const database = await getDatabase() /* sqliteSingleConnectionV1 */;

  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS entry_image_attachments (' +
      'attachment_id TEXT PRIMARY KEY NOT NULL,' +
      'entry_id TEXT NOT NULL,' +
      'uri TEXT NOT NULL,' +
      'file_name TEXT,' +
      'mime_type TEXT,' +
      'created_at TEXT NOT NULL,' +
      'FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_entry_image_attachments_entry ' +
      'ON entry_image_attachments(entry_id, created_at ASC);'
  );

  return database;
}

function mapRow(row: ImageRow): EntryImageAttachment {
  return {
    attachmentId: String(row.attachment_id),
    entryId: String(row.entry_id),
    uri: String(row.uri),
    fileName: row.file_name ?? null,
    mimeType: row.mime_type ?? null,
    createdAt: String(row.created_at),
  };
}

export async function pickEntryImages(): Promise<PendingEntryImage[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    tempId: identifier(),
    sourceUri: asset.uri,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
  }));
}

function safeExtension(fileName: string | null) {
  if (!fileName) return '.jpg';

  const match = fileName.match(/\.([a-zA-Z0-9]{1,8})$/);

  return match ? '.' + match[1]!.toLowerCase() : '.jpg';
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Slika se nije mogla u?itati.'));
    reader.readAsDataURL(blob);
  });
}

async function persistImage(pending: PendingEntryImage) {
  if (Platform.OS === 'web') {
    if (pending.sourceUri.startsWith('data:')) {
      return pending.sourceUri;
    }

    const response = await fetch(pending.sourceUri);

    if (!response.ok) {
      throw new Error('Slika se nije mogla u?itati.');
    }

    return blobToDataUri(await response.blob());
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('Lokalna mapa aplikacije nije dostupna.');
  }

  const directory =
    FileSystem.documentDirectory +
    IMAGE_DIRECTORY_NAME +
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

  const ownedPrefix =
    FileSystem.documentDirectory +
    IMAGE_DIRECTORY_NAME +
    '/';

  if (!uri.startsWith(ownedPrefix)) return;

  await FileSystem.deleteAsync(uri, {
    idempotent: true,
  });
}

export async function getEntryImages(entryId: string) {
  const database = await databaseWithEntryImages();

  const rows = await database.getAllAsync<ImageRow>(
    'SELECT * FROM entry_image_attachments ' +
      'WHERE entry_id = ? ORDER BY created_at ASC',
    entryId,
  );

  return rows.map(mapRow);
}

export async function getEntryImagePreviews(entryIds: string[]) {
  const ids = Array.from(new Set(entryIds.filter(Boolean)));

  if (ids.length === 0) {
    return {} as Record<string, string[]>;
  }

  const database = await databaseWithEntryImages();
  const placeholders = ids.map(() => '?').join(', ');

  const rows = await database.getAllAsync<{
    entry_id: string;
    uri: string;
  }>(
    'SELECT entry_id, uri FROM entry_image_attachments ' +
      'WHERE entry_id IN (' + placeholders + ') ' +
      'ORDER BY created_at ASC',
    ...ids,
  );

  return rows.reduce<Record<string, string[]>>((result, row) => {
    const id = String(row.entry_id);

    if (!result[id]) result[id] = [];

    result[id]!.push(String(row.uri));

    return result;
  }, {});
}

export async function saveEntryImageChanges(
  entryId: string,
  pending: PendingEntryImage[],
  removedAttachmentIds: string[],
) {
  const database = await databaseWithEntryImages();

  for (const attachmentId of removedAttachmentIds) {
    const existing = await database.getFirstAsync<{
      uri: string;
    }>(
      'SELECT uri FROM entry_image_attachments ' +
        'WHERE attachment_id = ? AND entry_id = ?',
      attachmentId,
      entryId,
    );

    await database.runAsync(
      'DELETE FROM entry_image_attachments ' +
        'WHERE attachment_id = ? AND entry_id = ?',
      attachmentId,
      entryId,
    );

    if (existing?.uri) {
      await deleteOwnedUri(String(existing.uri)).catch(() => undefined);
    }
  }

  for (const image of pending) {
    const uri = await persistImage(image);
    const now = new Date().toISOString();

    await database.runAsync(
      'INSERT INTO entry_image_attachments ' +
        '(attachment_id, entry_id, uri, file_name, mime_type, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
      identifier(),
      entryId,
      uri,
      image.fileName,
      image.mimeType,
      now,
    );
  }
}

export async function getEntryImageUris(entryId: string) {
  const images = await getEntryImages(entryId);
  return images.map((image) => image.uri);
}

export async function cleanupEntryImagesAfterDelete(
  entryId: string,
  knownUris: string[],
) {
  const database = await databaseWithEntryImages();

  await database.runAsync(
    'DELETE FROM entry_image_attachments WHERE entry_id = ?',
    entryId,
  );

  await Promise.all(
    knownUris.map((uri) =>
      deleteOwnedUri(uri).catch(() => undefined)
    ),
  );
}
