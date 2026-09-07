// memoryCapsuleBoxedV1
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import type {
  MemoryCapsule,
  MemoryCapsuleCollection,
  MemoryCapsuleDetail,
  MemoryCapsuleImage,
  MemoryCapsuleInput,
} from '../types/memoryCapsule';

type Row = Record<string, string | number | null | undefined>;
type Database = Awaited<ReturnType<typeof getDatabase>>;

const IMAGE_DIRECTORY_NAME = 'memory-capsule-images';

function identifier(prefix: string) {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function requiredTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Naslov Memory Capsule je obavezan.');
  return trimmed;
}

function cleanDescription(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  return trimmed || null;
}

export function normalizeMemoryCapsuleDate(
  value: string | null | undefined,
) {
  const raw = value?.trim() || '';
  if (!raw) return null;

  let year: number;
  let month: number;
  let day: number;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (local) {
    day = Number(local[1]);
    month = Number(local[2]);
    year = Number(local[3]);
  } else {
    throw new Error('Datum upiši kao 14.10.2026 ili 2026-10-14.');
  }

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    throw new Error('Datum otvaranja nije valjan.');
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function todayKey(now = new Date()) {
  return [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isMemoryCapsuleSealed(
  capsule: Pick<MemoryCapsule, 'sealedAt'>,
) {
  return Boolean(capsule.sealedAt);
}

export function isMemoryCapsuleLocked(
  capsule: Pick<MemoryCapsule, 'openOn' | 'sealedAt'>,
  now = new Date(),
) {
  return Boolean(
    capsule.sealedAt &&
      capsule.openOn &&
      capsule.openOn > todayKey(now),
  );
}

export function memoryCapsuleDateLabel(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[3])}.${Number(match[2])}.${match[1]}.`;
}

function mapCapsule(row: Row): MemoryCapsule {
  return {
    capsuleId: String(row.capsule_id),
    backingCollectionId: String(row.backing_collection_id),
    title: String(row.title),
    description:
      row.description == null ? null : String(row.description),
    openOn: row.open_on == null ? null : String(row.open_on),
    sealedAt: row.sealed_at == null ? null : String(row.sealed_at),
    openedAt: row.opened_at == null ? null : String(row.opened_at),
    createdAt: String(row.created_at),
    modifiedAt: String(row.modified_at),
    itemCount: Number(row.item_count ?? 0),
    imageCount: Number(row.image_count ?? 0),
    collectionCount: Number(row.collection_count ?? 0),
  };
}

function mapImage(row: Row): MemoryCapsuleImage {
  return {
    imageId: String(row.image_id),
    capsuleId: String(row.capsule_id),
    uri: String(row.uri),
    fileName: row.file_name == null ? null : String(row.file_name),
    mimeType: row.mime_type == null ? null : String(row.mime_type),
    caption: row.caption == null ? null : String(row.caption),
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at),
  };
}

function mapCollection(row: Row): MemoryCapsuleCollection {
  return {
    collectionId: String(row.collection_id),
    name: String(row.name),
    description:
      row.description == null ? null : String(row.description),
    symbol: row.symbol == null ? null : String(row.symbol),
    itemCount: Number(row.item_count ?? 0),
    position: Number(row.position ?? 0),
  };
}

// ljingleMemoryCapsuleTrueSealR8:schema
let memoryCapsuleSealSchemaPromise: Promise<void> | null = null;

async function ensureMemoryCapsuleSealSchema(
  database: Database,
) {
  if (!memoryCapsuleSealSchemaPromise) {
    memoryCapsuleSealSchemaPromise = (async () => {
      const columns = await database.getAllAsync<{ name: string }>(
        'PRAGMA table_info(memory_capsules)',
      );

      if (!columns.some((column) => column.name === 'sealed_at')) {
        await database.execAsync(
          'ALTER TABLE memory_capsules ADD COLUMN sealed_at TEXT;',
        );
      }

      // Old capsules that were already opened must remain immutable.
      // Unopened legacy capsules stay unsealed so the user explicitly
      // finishes packing them under the new state model.
      await database.runAsync(
        `UPDATE memory_capsules
            SET sealed_at = COALESCE(opened_at, created_at)
          WHERE opened_at IS NOT NULL
            AND sealed_at IS NULL`,
      );
    })().catch((error) => {
      memoryCapsuleSealSchemaPromise = null;
      throw error;
    });
  }

  await memoryCapsuleSealSchemaPromise;
}

async function requireEditableMemoryCapsule(
  capsuleId: string,
) {
  const current = await getMemoryCapsule(capsuleId);

  if (current.sealedAt) {
    throw new Error(
      'Ova Memory Capsule je zapečaćena i više se ne može mijenjati.',
    );
  }

  if (current.openedAt) {
    throw new Error(
      'Otvorena Memory Capsule ostaje read-only arhiv.',
    );
  }

  return current;
}

const CAPSULE_SELECT = `
  SELECT
    mc.*,
    (SELECT COUNT(*)
       FROM collection_items ci
      WHERE ci.collection_id = mc.backing_collection_id) AS item_count,
    (SELECT COUNT(*)
       FROM memory_capsule_images mci
      WHERE mci.capsule_id = mc.capsule_id) AS image_count,
    (SELECT COUNT(*)
       FROM memory_capsule_collection_links mcl
      WHERE mcl.capsule_id = mc.capsule_id) AS collection_count
  FROM memory_capsules mc
`;

export async function getMemoryCapsules() {
  const database = await getDatabase();
  await ensureMemoryCapsuleSealSchema(database);
  const rows = await database.getAllAsync<Row>(
    CAPSULE_SELECT + ' ORDER BY mc.created_at DESC',
  );
  return rows.map(mapCapsule);
}

export async function getMemoryCapsule(capsuleId: string) {
  const database = await getDatabase();
  await ensureMemoryCapsuleSealSchema(database);
  const row = await database.getFirstAsync<Row>(
    CAPSULE_SELECT + ' WHERE mc.capsule_id = ?',
    capsuleId,
  );
  if (!row) throw new Error('Memory Capsule ne postoji.');

  const [images, collections] = await Promise.all([
    database.getAllAsync<Row>(
      `SELECT *
         FROM memory_capsule_images
        WHERE capsule_id=?
        ORDER BY position, created_at`,
      capsuleId,
    ),
    database.getAllAsync<Row>(
      `SELECT
         c.collection_id,
         c.name,
         c.description,
         c.symbol,
         mcl.position,
         (SELECT COUNT(*)
            FROM collection_items ci
           WHERE ci.collection_id=c.collection_id) AS item_count
       FROM memory_capsule_collection_links mcl
       JOIN collections c
         ON c.collection_id=mcl.collection_id
      WHERE mcl.capsule_id=?
      ORDER BY mcl.position, mcl.created_at`,
      capsuleId,
    ),
  ]);

  return {
    ...mapCapsule(row),
    images: images.map(mapImage),
    collections: collections.map(mapCollection),
  } satisfies MemoryCapsuleDetail;
}

async function transaction(
  database: Database,
  task: (db: Database) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await task(database);
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

export async function createMemoryCapsule(
  input: MemoryCapsuleInput,
) {
  const database = await getDatabase();
  await ensureMemoryCapsuleSealSchema(database);
  const now = new Date().toISOString();
  const capsuleId = identifier('capsule');
  const backingCollectionId = identifier('capsule-box');
  const title = requiredTitle(input.title);
  const description = cleanDescription(input.description);
  const openOn = normalizeMemoryCapsuleDate(input.openOn);
  const hiddenName =
    'Memory Capsule · ' +
    title +
    ' · ' +
    capsuleId.slice(-6);

  await transaction(database, async (db) => {
    await db.runAsync(
      `INSERT INTO collections
        (collection_id, name, description, symbol, position, created_at, modified_at)
       VALUES (
         ?, ?, ?, '✦',
         (SELECT COALESCE(MAX(position) + 1, 0) FROM collections),
         ?, ?
       )`,
      backingCollectionId,
      hiddenName,
      'LJINGLE Memory Capsule backing box',
      now,
      now,
    );

    await db.runAsync(
      `INSERT INTO memory_capsules
        (capsule_id, backing_collection_id, title, description,
         open_on, opened_at, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      capsuleId,
      backingCollectionId,
      title,
      description,
      openOn,
      now,
      now,
    );
  });

  return getMemoryCapsule(capsuleId);
}

export async function updateMemoryCapsule(
  capsuleId: string,
  input: MemoryCapsuleInput,
) {
  const database = await getDatabase();
  const current = await getMemoryCapsule(capsuleId);

  if (current.sealedAt) {
    throw new Error(
      'Zapečaćena Memory Capsule više se ne može uređivati.',
    );
  }

  const title = requiredTitle(input.title);
  const description = cleanDescription(input.description);
  const openOn = normalizeMemoryCapsuleDate(input.openOn);
  const now = new Date().toISOString();

  await transaction(database, async (db) => {
    await db.runAsync(
      `UPDATE memory_capsules
          SET title=?, description=?, open_on=?, modified_at=?
        WHERE capsule_id=?`,
      title,
      description,
      openOn,
      now,
      capsuleId,
    );

    await db.runAsync(
      `UPDATE collections
          SET name=?, description=?, modified_at=?
        WHERE collection_id=?`,
      'Memory Capsule · ' + title + ' · ' + capsuleId.slice(-6),
      'LJINGLE Memory Capsule backing box',
      now,
      current.backingCollectionId,
    );
  });

  return getMemoryCapsule(capsuleId);
}

// ljingleMemoryCapsuleTrueSealR8:seal
export async function sealMemoryCapsule(capsuleId: string) {
  const database = await getDatabase();
  await ensureMemoryCapsuleSealSchema(database);

  const current = await getMemoryCapsule(capsuleId);

  if (current.openedAt) {
    throw new Error(
      'Otvorena Memory Capsule više se ne može ponovno pakirati.',
    );
  }

  if (current.sealedAt) {
    return current;
  }

  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE memory_capsules
        SET sealed_at=?, modified_at=?
      WHERE capsule_id=?`,
    now,
    now,
    capsuleId,
  );

  return getMemoryCapsule(capsuleId);
}

export async function markMemoryCapsuleOpened(capsuleId: string) {
  const database = await getDatabase();
  const current = await getMemoryCapsule(capsuleId);

  if (!current.sealedAt) {
    throw new Error(
      'Najprije završi pakiranje i zapečati Memory Capsule.',
    );
  }

  if (isMemoryCapsuleLocked(current)) {
    throw new Error('Ova Memory Capsule još je zapečaćena.');
  }
  if (current.openedAt) return current;

  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE memory_capsules
        SET opened_at=?, modified_at=?
      WHERE capsule_id=?`,
    now,
    now,
    capsuleId,
  );
  return getMemoryCapsule(capsuleId);
}

async function deleteOwnedImage(uri: string) {
  if (Platform.OS === 'web') return;
  if (!FileSystem.documentDirectory) return;

  const prefix =
    FileSystem.documentDirectory +
    IMAGE_DIRECTORY_NAME +
    '/';

  if (!uri.startsWith(prefix)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function deleteMemoryCapsule(capsuleId: string) {
  const database = await getDatabase();
  const current = await getMemoryCapsule(capsuleId);
  const imageUris = current.images.map((image) => image.uri);

  await transaction(database, async (db) => {
    // Explicit child cleanup also keeps the delete safe if a restored
    // database ever has foreign_keys temporarily disabled.
    await db.runAsync(
      'DELETE FROM memory_capsule_images WHERE capsule_id=?',
      capsuleId,
    );
    await db.runAsync(
      'DELETE FROM memory_capsule_collection_links WHERE capsule_id=?',
      capsuleId,
    );
    await db.runAsync(
      'DELETE FROM memory_capsules WHERE capsule_id=?',
      capsuleId,
    );
    await db.runAsync(
      'DELETE FROM collections WHERE collection_id=?',
      current.backingCollectionId,
    );
  });

  await Promise.all(
    imageUris.map((uri) =>
      deleteOwnedImage(uri).catch(() => undefined),
    ),
  );
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
    reader.onerror = () =>
      reject(reader.error ?? new Error('Slika se nije mogla učitati.'));
    reader.readAsDataURL(blob);
  });
}

async function persistPickedImage(
  sourceUri: string,
  fileName: string | null,
) {
  if (Platform.OS === 'web') {
    if (sourceUri.startsWith('data:')) return sourceUri;
    const response = await fetch(sourceUri);
    if (!response.ok) throw new Error('Slika se nije mogla učitati.');
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
    identifier('capsule-img') +
    safeExtension(fileName);

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destination,
  });

  return destination;
}

export async function pickAndAddMemoryCapsuleImages(
  capsuleId: string,
) {
  await requireEditableMemoryCapsule(capsuleId);

  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return getMemoryCapsule(capsuleId);

  const database = await getDatabase();
  const current = await getMemoryCapsule(capsuleId);
  let position = current.images.length;

  for (const asset of result.assets) {
    const uri = await persistPickedImage(
      asset.uri,
      asset.name ?? null,
    );
    const now = new Date().toISOString();

    try {
      await database.runAsync(
        `INSERT INTO memory_capsule_images
          (image_id, capsule_id, uri, file_name, mime_type,
           caption, position, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        identifier('capsule-img-row'),
        capsuleId,
        uri,
        asset.name ?? null,
        asset.mimeType ?? null,
        position,
        now,
        now,
      );
      position += 1;
    } catch (error) {
      await deleteOwnedImage(uri).catch(() => undefined);
      throw error;
    }
  }

  return getMemoryCapsule(capsuleId);
}

export async function removeMemoryCapsuleImage(
  capsuleId: string,
  imageId: string,
) {
  await requireEditableMemoryCapsule(capsuleId);

  const database = await getDatabase();
  const row = await database.getFirstAsync<Row>(
    `SELECT uri
       FROM memory_capsule_images
      WHERE capsule_id=? AND image_id=?`,
    capsuleId,
    imageId,
  );

  await database.runAsync(
    `DELETE FROM memory_capsule_images
      WHERE capsule_id=? AND image_id=?`,
    capsuleId,
    imageId,
  );

  if (row?.uri) {
    await deleteOwnedImage(String(row.uri)).catch(() => undefined);
  }

  return getMemoryCapsule(capsuleId);
}

export async function addCollectionToMemoryCapsule(
  capsuleId: string,
  collectionId: string,
) {
  await requireEditableMemoryCapsule(capsuleId);

  const database = await getDatabase();
  const current = await getMemoryCapsule(capsuleId);

  if (collectionId === current.backingCollectionId) {
    throw new Error('Memory Capsule ne može sadržavati samu sebe.');
  }

  const target = await database.getFirstAsync<Row>(
    'SELECT collection_id FROM collections WHERE collection_id=?',
    collectionId,
  );
  if (!target) throw new Error('Kolekcija ne postoji.');

  const position = await database.getFirstAsync<{ next_position: number }>(
    `SELECT COALESCE(MAX(position) + 1, 0) AS next_position
       FROM memory_capsule_collection_links
      WHERE capsule_id=?`,
    capsuleId,
  );
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT OR IGNORE INTO memory_capsule_collection_links
      (capsule_id, collection_id, position, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    capsuleId,
    collectionId,
    Number(position?.next_position ?? 0),
    now,
    now,
  );

  return getMemoryCapsule(capsuleId);
}

export async function removeCollectionFromMemoryCapsule(
  capsuleId: string,
  collectionId: string,
) {
  await requireEditableMemoryCapsule(capsuleId);

  const database = await getDatabase();
  await database.runAsync(
    `DELETE FROM memory_capsule_collection_links
      WHERE capsule_id=? AND collection_id=?`,
    capsuleId,
    collectionId,
  );
  return getMemoryCapsule(capsuleId);
}
