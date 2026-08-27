import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import { inspectPortablePackage } from './portableExport';
import type {
  LjinglePortablePackage,
  PortableAsset,
  PortableEntityKind,
  PortableObject,
} from '../types/portablePackage';

type Database = Awaited<ReturnType<typeof getDatabase>>;
type Row = Record<string, string | number | null | undefined>;
type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export type PortableVisualEdge = {
  marker: 'TO' | 'FROM' | '↔';
  label: string;
  otherTitle: string;
  otherKind: PortableEntityKind;
  note: string | null;
};

export type PortablePreview = {
  pack: LjinglePortablePackage;
  objectCounts: Record<string, number>;
  imageCount: number;
  audioCount: number;
  embeddedBytes: number;
  duplicateCount: number;
  senderJingleCount: number;
  visualEdges: PortableVisualEdge[];
};

export type PortableJingleCandidate = {
  entityType: 'BOOK' | 'MEDIA' | 'GAME';
  entityId: string;
  title: string;
};

export type PortableImportResult = {
  imported: number;
  reused: number;
  relationships: number;
  collectionId: string | null;
  rootEntityType: PortableEntityKind | null;
  rootEntityId: string | null;
  jingleCandidates: PortableJingleCandidate[];
};

function id(prefix = 'imp') {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function safeFilename(value: string) {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'asset.bin';
}

function base64Bytes(value: string) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const out: number[] = [];

  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index] || 'A');
    const b = alphabet.indexOf(clean[index + 1] || 'A');
    const cChar = clean[index + 2];
    const dChar = clean[index + 3];
    const c = cChar === '=' ? 0 : alphabet.indexOf(cChar || 'A');
    const d = dChar === '=' ? 0 : alphabet.indexOf(dChar || 'A');

    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    out.push((triple >> 16) & 255);
    if (cChar && cChar !== '=') out.push((triple >> 8) & 255);
    if (dChar && dChar !== '=') out.push(triple & 255);
  }

  return new Uint8Array(out);
}

async function columns(database: Database, table: string) {
  return database.getAllAsync<ColumnInfo>(
    'PRAGMA table_info(' + table + ')',
  );
}

async function tableExists(database: Database, table: string) {
  const row = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    table,
  );
  return Boolean(row?.name);
}

async function writeAtomically(
  database: Database,
  task: (transaction: Database) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await task(database);
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

function spec(kind: PortableEntityKind) {
  const map: Partial<
    Record<PortableEntityKind, { table: string; pk: string }>
  > = {
    ENTRY: { table: 'entries', pk: 'entry_id' },
    FREQUENCY: { table: 'audio_tracks', pk: 'track_id' },
    COLLECTION: { table: 'collections', pk: 'collection_id' },
    BOOK: { table: 'books', pk: 'book_id' },
    MEDIA: { table: 'media_items', pk: 'media_id' },
    GAME: { table: 'games', pk: 'game_id' },
    TOPIC: { table: 'topics', pk: 'topic_id' },
  };
  return map[kind] ?? null;
}

// portableV2ImportProvenance
async function ensurePortableOriginSchema(
  database: Database,
) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS portable_entity_origins (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      origin_id TEXT NOT NULL UNIQUE,
      first_seen_at TEXT NOT NULL,
      source_package_id TEXT,
      source_portable_id TEXT,
      PRIMARY KEY (entity_type, entity_id)
    );

    CREATE INDEX IF NOT EXISTS idx_portable_entity_origins_origin
      ON portable_entity_origins(origin_id);
  `);
}

async function originDuplicate(
  database: Database,
  object: PortableObject,
) {
  if (!object.originId) return null;

  await ensurePortableOriginSchema(database);

  const row =
    await database.getFirstAsync<Row>(
      `SELECT entity_type, entity_id
         FROM portable_entity_origins
        WHERE origin_id=?
        LIMIT 1`,
      object.originId,
    );

  if (!row?.entity_id) return null;

  const entity = spec(object.entityType);
  if (!entity) return null;

  const exists =
    await database.getFirstAsync<Row>(
      'SELECT ' +
        entity.pk +
        ' FROM ' +
        entity.table +
        ' WHERE ' +
        entity.pk +
        '=? LIMIT 1',
      String(row.entity_id),
    );

  return exists
    ? String(row.entity_id)
    : null;
}

async function registerPortableOrigin(
  database: Database,
  pack: LjinglePortablePackage,
  object: PortableObject,
  localId: string,
) {
  if (!object.originId) return;

  await ensurePortableOriginSchema(database);

  await database.runAsync(
    `INSERT OR REPLACE INTO portable_entity_origins
      (entity_type, entity_id, origin_id, first_seen_at,
       source_package_id, source_portable_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    object.entityType,
    localId,
    object.originId,
    new Date().toISOString(),
    pack.packageId,
    object.portableId,
  );
}

function visualRelationLabel(
  relationType: string,
  outgoing: boolean,
) {
  switch (relationType) {
    case 'CONTAINS':
      return outgoing ? 'Contains' : 'Inside collection';
    case 'INSPIRED_BY':
      return outgoing
        ? 'Inspirirano ovime'
        : 'Inspiriralo ovo';
    case 'ABOUT':
      return outgoing
        ? 'Govori o ovome'
        : 'O ovome govori';
    case 'REFERENCES':
      return outgoing
        ? 'Referencira ovo'
        : 'Ovo referencira ovu stavku';
    case 'ADAPTATION_OF':
      return outgoing
        ? 'Adaptirano prema ovome'
        : 'Adaptacija ovoga';
    case 'REMEMBERED_WITH':
      return 'Pamtim uz ovo';
    case 'RELATED':
      return 'Povezano';
    default:
      return relationType.replaceAll('_', ' ');
  }
}

function buildVisualEdges(
  pack: LjinglePortablePackage,
) {
  const symmetric =
    new Set(['RELATED', 'REMEMBERED_WITH']);

  return pack.relationships
    .filter(
      (relationship) =>
        relationship.sourcePortableId ===
          pack.rootPortableId ||
        relationship.targetPortableId ===
          pack.rootPortableId,
    )
    .slice(0, 5)
    .flatMap((relationship) => {
      const outgoing =
        relationship.sourcePortableId ===
        pack.rootPortableId;

      const otherId = outgoing
        ? relationship.targetPortableId
        : relationship.sourcePortableId;

      const other = pack.objects.find(
        (object) =>
          object.portableId === otherId,
      );

      if (!other) return [];

      return [
        {
          marker: symmetric.has(
            relationship.relationType,
          )
            ? ('↔' as const)
            : outgoing
              ? ('TO' as const)
              : ('FROM' as const),
          label: visualRelationLabel(
            relationship.relationType,
            outgoing,
          ),
          otherTitle: other.title,
          otherKind: other.entityType,
          note: relationship.note,
        },
      ];
    });
}

function scalar(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

async function findDuplicate(
  database: Database,
  object: PortableObject,
): Promise<string | null> {
  const byOrigin =
    await originDuplicate(database, object);

  if (byOrigin) return byOrigin;

  const data = object.data;

  if (object.entityType === 'TOPIC') {
    const name = typeof data.name === 'string' ? data.name.trim() : object.title.trim();
    if (!name) return null;
    const row = await database.getFirstAsync<Row>(
      'SELECT topic_id FROM topics WHERE lower(name)=lower(?) LIMIT 1',
      name,
    );
    return row?.topic_id ? String(row.topic_id) : null;
  }

  if (object.entityType === 'BOOK') {
    const isbn = typeof data.isbn === 'string' ? data.isbn.trim() : '';
    if (isbn) {
      const row = await database.getFirstAsync<Row>(
        'SELECT book_id FROM books WHERE isbn=? LIMIT 1',
        isbn,
      );
      if (row?.book_id) return String(row.book_id);
    }

    const title = typeof data.title === 'string' ? data.title : object.title;
    const author = typeof data.author === 'string' ? data.author : '';
    const row = await database.getFirstAsync<Row>(
      'SELECT book_id FROM books WHERE lower(title)=lower(?) AND lower(author)=lower(?) LIMIT 1',
      title,
      author,
    );
    return row?.book_id ? String(row.book_id) : null;
  }

  if (object.entityType === 'MEDIA') {
    const tmdb = scalar(data.tmdb_id);
    const mediaType = scalar(data.media_type);
    if (tmdb !== null && mediaType !== null) {
      const row = await database.getFirstAsync<Row>(
        'SELECT media_id FROM media_items WHERE tmdb_id=? AND media_type=? LIMIT 1',
        tmdb,
        mediaType,
      );
      if (row?.media_id) return String(row.media_id);
    }

    const title = typeof data.title === 'string' ? data.title : object.title;
    const year = scalar(data.release_year);
    const row = await database.getFirstAsync<Row>(
      'SELECT media_id FROM media_items WHERE lower(title)=lower(?) AND (release_year IS ? OR release_year=?) LIMIT 1',
      title,
      year,
      year,
    );
    return row?.media_id ? String(row.media_id) : null;
  }

  if (object.entityType === 'GAME') {
    const igdb = scalar(data.igdb_id);
    if (igdb !== null) {
      const row = await database.getFirstAsync<Row>(
        'SELECT game_id FROM games WHERE igdb_id=? LIMIT 1',
        igdb,
      );
      if (row?.game_id) return String(row.game_id);
    }

    const title = typeof data.title === 'string' ? data.title : object.title;
    const platform =
      typeof data.platform === 'string' ? data.platform : '';
    const row = await database.getFirstAsync<Row>(
      'SELECT game_id FROM games WHERE lower(title)=lower(?) AND lower(platform)=lower(?) LIMIT 1',
      title,
      platform,
    );
    return row?.game_id ? String(row.game_id) : null;
  }

  return null;
}

async function collisionSafeCollectionName(
  database: Database,
  wanted: string,
) {
  let name = wanted.trim() || 'Imported Memory Box';
  let suffix = 1;

  while (
    await database.getFirstAsync<Row>(
      'SELECT collection_id FROM collections WHERE lower(name)=lower(?) LIMIT 1',
      name,
    )
  ) {
    suffix += 1;
    name = wanted.trim() + ' (import' + (suffix > 2 ? ' ' + suffix : '') + ')';
  }

  return name;
}

async function persistAsset(
  pack: LjinglePortablePackage,
  asset: PortableAsset,
) {
  if (!asset.base64) return null;

  const root = new Directory(Paths.document, 'ljingle-imports');
  if (!root.exists) {
    root.create({ idempotent: true, intermediates: true });
  }

  const packageDir = new Directory(root, safeFilename(pack.packageId));
  if (!packageDir.exists) {
    packageDir.create({ idempotent: true, intermediates: true });
  }

  const file = new File(
    packageDir,
    id('asset') + '-' + safeFilename(asset.name),
  );

  file.create();
  file.write(base64Bytes(asset.base64));
  return file.uri;
}

async function insertDynamic(
  database: Database,
  object: PortableObject,
  localId: string,
  assetUris: Map<string, string>,
) {
  const entity = spec(object.entityType);
  if (!entity) return;

  const tableColumns = await columns(database, entity.table);
  const known = new Set(tableColumns.map((column) => column.name));
  const now = new Date().toISOString();
  const values: Record<string, string | number | null> = {};

  for (const [key, value] of Object.entries(object.data)) {
    if (known.has(key)) values[key] = scalar(value);
  }

  values[entity.pk] = localId;

  if (known.has('created_at')) values.created_at = now;
  if (known.has('modified_at')) values.modified_at = now;

  // Sender Jingle is provenance only. Never auto-favourite receiver data.
  if (known.has('favourite')) values.favourite = 0;

  // Never keep foreign IDs that only make sense in sender's database.
  for (const key of [
    'book_id',
    'topic_id',
    'activity_id',
    'playing_activity_id',
  ]) {
    if (known.has(key)) values[key] = null;
  }

  if (object.entityType === 'FREQUENCY' && known.has('file_uri')) {
    const audio = object.assetIds
      .map((assetId) => assetUris.get(assetId))
      .find(Boolean);
    if (!audio) {
      throw new Error(
        'Frekvencija "' +
          object.title +
          '" nema ugrađenu audio datoteku.',
      );
    }
    values.file_uri = audio;
    if (known.has('waveform_seed')) values.waveform_seed = localId;
  }

  if (object.entityType === 'COLLECTION' && known.has('name')) {
    values.name = await collisionSafeCollectionName(
      database,
      String(values.name || object.title),
    );
  }

  const names = tableColumns
    .map((column) => column.name)
    .filter((name) => Object.prototype.hasOwnProperty.call(values, name));

  const args = names.map((name) => values[name] ?? null);
  const placeholders = names.map(() => '?').join(', ');

  await database.runAsync(
    'INSERT INTO ' +
      entity.table +
      ' (' +
      names.join(', ') +
      ') VALUES (' +
      placeholders +
      ')',
    ...args,
  );
}

async function attachEntryImages(
  database: Database,
  pack: LjinglePortablePackage,
  object: PortableObject,
  localEntryId: string,
  assetUris: Map<string, string>,
) {
  if (!(await tableExists(database, 'entry_images'))) return;

  const info = await columns(database, 'entry_images');
  const names = new Set(info.map((column) => column.name));
  const idColumn =
    ['image_id', 'attachment_id', 'id'].find((name) => names.has(name)) ??
    null;
  const uriColumn =
    ['file_uri', 'stored_uri', 'image_uri', 'uri', 'local_uri'].find(
      (name) => names.has(name),
    ) ?? null;

  if (!names.has('entry_id') || !uriColumn) return;

  const now = new Date().toISOString();
  let position = 0;

  for (const assetId of object.assetIds) {
    const asset = pack.assets.find(
      (candidate) =>
        candidate.assetId === assetId && candidate.kind === 'IMAGE',
    );
    const uri = assetUris.get(assetId);
    if (!asset || !uri) continue;

    const values: Record<string, string | number | null> = {
      entry_id: localEntryId,
      [uriColumn]: uri,
    };

    if (idColumn) values[idColumn] = id('image');
    if (names.has('original_name')) values.original_name = asset.name;
    if (names.has('file_name')) values.file_name = asset.name;
    if (names.has('name')) values.name = asset.name;
    if (names.has('mime_type')) values.mime_type = asset.mimeType;
    if (names.has('position')) values.position = position;
    if (names.has('sort_order')) values.sort_order = position;
    if (names.has('created_at')) values.created_at = now;
    if (names.has('modified_at')) values.modified_at = now;

    const cols = info
      .map((column) => column.name)
      .filter((name) =>
        Object.prototype.hasOwnProperty.call(values, name),
      );

    await database.runAsync(
      'INSERT INTO entry_images (' +
        cols.join(', ') +
        ') VALUES (' +
        cols.map(() => '?').join(', ') +
        ')',
      ...cols.map((name) => values[name] ?? null),
    );

    position += 1;
  }
}

export function previewPortablePackage(
  text: string,
): PortablePreview {
  const pack = inspectPortablePackage(text);
  const objectCounts: Record<string, number> = {};

  for (const object of pack.objects) {
    objectCounts[object.entityType] =
      (objectCounts[object.entityType] ?? 0) + 1;
  }

  return {
    pack,
    objectCounts,
    imageCount: pack.assets.filter(
      (asset) => asset.kind === 'IMAGE',
    ).length,
    audioCount: pack.assets.filter(
      (asset) => asset.kind === 'AUDIO',
    ).length,
    embeddedBytes: pack.assets.reduce(
      (total, asset) =>
        total + (asset.byteLength ?? 0),
      0,
    ),
    duplicateCount: 0,
    senderJingleCount: pack.objects.filter(
      (object) => object.jingle,
    ).length,
    visualEdges: buildVisualEdges(pack),
  };
}

export async function readPortablePackageFile(
  uri: string,
) {
  const file = new File(uri);
  const preview =
    previewPortablePackage(await file.text());

  const database = await getDatabase();
  await ensurePortableOriginSchema(database);

  let duplicateCount = 0;

  for (const object of preview.pack.objects) {
    if (await findDuplicate(database, object)) {
      duplicateCount += 1;
    }
  }

  return {
    ...preview,
    duplicateCount,
  };
}

export async function importPortablePackage(
  pack: LjinglePortablePackage,
): Promise<PortableImportResult> {
  const database = await getDatabase();
  await ensurePortableOriginSchema(database);
  const assetUris = new Map<string, string>();

  for (const asset of pack.assets) {
    const uri = await persistAsset(pack, asset);
    if (uri) assetUris.set(asset.assetId, uri);
  }

  const localIds = new Map<string, string>();
  let imported = 0;
  let reused = 0;
  let relationshipCount = 0;
  let importedCollectionId: string | null = null;

  const order: PortableEntityKind[] = [
    'BOOK',
    'MEDIA',
    'GAME',
    'TOPIC',
    'ENTRY',
    'FREQUENCY',
    'COLLECTION',
  ];

  await writeAtomically(database, async (transaction) => {
    for (const kind of order) {
      for (const object of pack.objects.filter(
        (candidate) => candidate.entityType === kind,
      )) {
        const duplicate = await findDuplicate(transaction, object);

        if (duplicate) {
          localIds.set(
            object.portableId,
            duplicate,
          );

          await registerPortableOrigin(
            transaction,
            pack,
            object,
            duplicate,
          );

          reused += 1;

          if (kind === 'COLLECTION') {
            importedCollectionId =
              duplicate;
          }

          continue;
        }

        const localId = id(kind.toLowerCase());
        await insertDynamic(
          transaction,
          object,
          localId,
          assetUris,
        );

        localIds.set(
          object.portableId,
          localId,
        );

        await registerPortableOrigin(
          transaction,
          pack,
          object,
          localId,
        );

        imported += 1;

        if (kind === 'COLLECTION') importedCollectionId = localId;

        if (kind === 'ENTRY') {
          await attachEntryImages(
            transaction,
            pack,
            object,
            localId,
            assetUris,
          );
        }
      }
    }

    for (const relationship of pack.relationships) {
      const source = pack.objects.find(
        (object) =>
          object.portableId === relationship.sourcePortableId,
      );
      const target = pack.objects.find(
        (object) =>
          object.portableId === relationship.targetPortableId,
      );
      const sourceId = localIds.get(relationship.sourcePortableId);
      const targetId = localIds.get(relationship.targetPortableId);

      if (!source || !target || !sourceId || !targetId) continue;

      if (relationship.relationType === 'CONTAINS') {
        const collectionSide =
          source.entityType === 'COLLECTION'
            ? { collectionId: sourceId, item: target, itemId: targetId }
            : target.entityType === 'COLLECTION'
              ? { collectionId: targetId, item: source, itemId: sourceId }
              : null;

        if (!collectionSide) continue;

        await transaction.runAsync(
          `INSERT OR IGNORE INTO collection_items
           (item_id, collection_id, entity_type, entity_id, position, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id('collection-item'),
          collectionSide.collectionId,
          collectionSide.item.entityType,
          collectionSide.itemId,
          relationshipCount,
          new Date().toISOString(),
          new Date().toISOString(),
        );
        relationshipCount += 1;
        continue;
      }

      if (
        relationship.relationType === 'REMEMBERED_WITH' &&
        (
          (source.entityType === 'ENTRY' &&
            target.entityType === 'FREQUENCY') ||
          (source.entityType === 'FREQUENCY' &&
            target.entityType === 'ENTRY')
        )
      ) {
        const entryId =
          source.entityType === 'ENTRY' ? sourceId : targetId;
        const trackId =
          source.entityType === 'FREQUENCY' ? sourceId : targetId;

        await transaction.runAsync(
          `INSERT OR IGNORE INTO entry_soundtracks
           (link_id, entry_id, track_id, anchor_text, clip_start_seconds, clip_end_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id('soundtrack'),
          entryId,
          trackId,
          relationship.note,
          0,
          null,
          new Date().toISOString(),
        );
        relationshipCount += 1;
        continue;
      }

      if (
        source.entityType !== 'COLLECTION' &&
        target.entityType !== 'COLLECTION' &&
        (await tableExists(transaction, 'entity_links'))
      ) {
        await transaction.runAsync(
          `INSERT OR IGNORE INTO entity_links
           (link_id, source_type, source_id, target_type, target_id,
            relation_type, note, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id('link'),
          source.entityType,
          sourceId,
          target.entityType,
          targetId,
          relationship.relationType,
          relationship.note,
          new Date().toISOString(),
          new Date().toISOString(),
        );
        relationshipCount += 1;
      }
    }
  });

  const rootObject =
    pack.objects.find(
      (object) =>
        object.portableId ===
        pack.rootPortableId,
    ) ?? null;

  const rootEntityId = rootObject
    ? localIds.get(rootObject.portableId) ?? null
    : null;

  const jingleCandidates =
    pack.objects.flatMap((object) => {
      if (
        !object.jingle ||
        !(
          object.entityType === 'BOOK' ||
          object.entityType === 'MEDIA' ||
          object.entityType === 'GAME'
        )
      ) {
        return [];
      }

      const entityId =
        localIds.get(object.portableId);

      if (!entityId) return [];

      return [
        {
          entityType: object.entityType,
          entityId,
          title: object.title,
        },
      ];
    });

  return {
    imported,
    reused,
    relationships: relationshipCount,
    collectionId: importedCollectionId,
    rootEntityType:
      rootObject?.entityType ?? null,
    rootEntityId,
    jingleCandidates,
  };
}

export async function addPortableImportsToJingles(
  candidates: PortableJingleCandidate[],
) {
  const database = await getDatabase();

  for (const candidate of candidates) {
    const entity = spec(candidate.entityType);
    if (!entity) continue;

    const info = await columns(
      database,
      entity.table,
    );

    const hasFavourite =
      info.some(
        (column) =>
          column.name === 'favourite',
      );

    if (!hasFavourite) continue;

    await database.runAsync(
      'UPDATE ' +
        entity.table +
        ' SET favourite=1 WHERE ' +
        entity.pk +
        '=?',
      candidate.entityId,
    );
  }
}
