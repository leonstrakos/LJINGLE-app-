import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import { sharePortableVisualCard } from './portableVisualShare';
import { sendPackageToSavedBridge } from './bridgeApi';
import { hydrateWebAudio } from '../audio/webAudioStore';

let shareProbeStage = 'idle';
let shareProbeDetail = '';

const shareProbe = (
  stage: string,
  detail?: unknown,
) => {
  shareProbeStage = stage;

  try {
    shareProbeDetail =
      detail === undefined
        ? ''
        : JSON.stringify(detail);
  } catch {
    shareProbeDetail =
      String(detail ?? '');
  }

  console.log(
    '[LJ SHARE]',
    stage,
    detail ?? '',
  );
};
// shareProbeSafeV21

import type {
  LjinglePortablePackage,
  PortableAsset,
  PortableEntityKind,
  PortableObject,
  PortableRelationship,
} from '../types/portablePackage';

import {
  requestPortableShareChoice,
} from './portableShareUi';

type Row = Record<string, string | number | null | undefined>;

function id(prefix: string) {
  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function safeName(value: string) {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return clean || 'ljingle';
}

function firstString(
  row: Row,
  keys: string[],
) {
  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value;
    }
  }

  return null;
}

async function tableExists(
  database: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
) {
  const row =
    await database.getFirstAsync<{ name: string }>(
      `SELECT name
         FROM sqlite_master
        WHERE type='table'
          AND name=?`,
      table,
    );

  return Boolean(row?.name);
}

function rowObject(
  entityType: Exclude<
    PortableEntityKind,
    'COLLECTION'
  >,
  row: Row,
): PortableObject {
  const sourceId =
    entityType === 'ENTRY'
      ? String(row.entry_id)
      : entityType === 'FREQUENCY'
        ? String(row.track_id)
        : entityType === 'BOOK'
          ? String(row.book_id)
          : entityType === 'MEDIA'
            ? String(row.media_id)
            : entityType === 'GAME'
              ? String(row.game_id)
              : String(row.topic_id);

  const title =
    entityType === 'ENTRY'
      ? String(
          row.title ||
            String(row.content || '')
              .replace(/\s+/g, ' ')
              .slice(0, 72) ||
            'Zapis',
        )
      : entityType === 'FREQUENCY'
        ? String(row.title || 'Frekvencija')
        : entityType === 'TOPIC'
          ? String(row.name || 'Tema')
          : String(row.title || entityType);

  const subtitle =
    entityType === 'BOOK'
      ? String(row.author || '') || null
      : entityType === 'FREQUENCY'
        ? String(row.artist || '') || null
        : entityType === 'GAME'
          ? String(row.platform || '') || null
          : entityType === 'MEDIA'
            ? String(row.media_type || '') || null
            : entityType === 'ENTRY'
              ? String(row.entry_type || '') || null
              : String(row.description || '') || null;

  return {
    portableId:
      entityType.toLowerCase() + ':' + sourceId,
    entityType,
    sourceId,
    title,
    subtitle,
    jingle:
      entityType === 'BOOK' ||
      entityType === 'MEDIA' ||
      entityType === 'GAME'
        ? Boolean(row.favourite)
        : false,
    data: { ...row },
    assetIds: [],
  };
}

async function loadEntity(
  database: Awaited<ReturnType<typeof getDatabase>>,
  entityType: string,
  entityId: string,
) {
  const specs: Record<
    string,
    [string, string, Exclude<PortableEntityKind, 'COLLECTION'>]
  > = {
    ENTRY: ['entries', 'entry_id', 'ENTRY'],
    FREQUENCY: ['audio_tracks', 'track_id', 'FREQUENCY'],
    BOOK: ['books', 'book_id', 'BOOK'],
    MEDIA: ['media_items', 'media_id', 'MEDIA'],
    GAME: ['games', 'game_id', 'GAME'],
    TOPIC: ['topics', 'topic_id', 'TOPIC'],
  };

  const spec = specs[entityType];
  if (!spec) return null;

  const [table, column, kind] = spec;

  const row = await database.getFirstAsync<Row>(
    `SELECT * FROM ${table} WHERE ${column}=?`,
    entityId,
  );

  return row ? rowObject(kind, row) : null;
}

let portableMetadataOnly = false;

async function assetFromUri(
  uri: string,
  kind: 'IMAGE' | 'AUDIO',
  name: string,
  mimeType: string | null,
): Promise<PortableAsset | null> {
  shareProbe('asset:start', {
    kind,
    name,
    uri: uri.slice(0, 96),
  });

  try {
    // portableMetadataOnlyV1
    // Visual cards only need graph/object metadata, not embedded binaries.
    if (portableMetadataOnly) {
      return null;
    }
    if (Platform.OS === 'web') {
      const response = await fetch(
      // portableWebAudioHydrationV2
      Platform.OS === 'web' &&
      uri.startsWith('ljingle-web-audio:')
        ? await hydrateWebAudio(uri)
        : uri,
    );
      const blob = await response.blob();
      // portableFileReaderBase64V1
      // Browser-native async conversion avoids freezing the JS thread on
      // large audio files.
      const base64 =
        await new Promise<string | null>(
          (resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () =>
              reject(
                reader.error ||
                  new Error(
                    'Browser could not read portable asset.',
                  ),
              );

            reader.onload = () => {
              const result =
                typeof reader.result === 'string'
                  ? reader.result
                  : '';

              const comma =
                result.indexOf(',');

              resolve(
                comma >= 0
                  ? result.slice(comma + 1)
                  : null,
              );
            };

            reader.readAsDataURL(blob);
          },
        );

      const byteLength = blob.size;

      return {
        assetId: id('asset'),
        kind,
        name,
        mimeType: mimeType || blob.type || null,
        byteLength,
        base64,
      };
    }

    const file = new File(uri);

    if (!file.exists) return null;

    return {
      assetId: id('asset'),
      kind,
      name: name || file.name,
      mimeType: mimeType || file.type || null,
      byteLength: file.size || null,
      base64: await file.base64(),
    };
  } catch {
    return null;
  }
}

async function attachEntryImages(
  database: Awaited<ReturnType<typeof getDatabase>>,
  entry: PortableObject,
  assets: PortableAsset[],
) {
  if (
    !(await tableExists(database, 'entry_images'))
  ) {
    return;
  }

  const rows =
    await database.getAllAsync<Row>(
      'SELECT * FROM entry_images WHERE entry_id=?',
      entry.sourceId,
    );

  for (const row of rows) {
    const uri = firstString(row, [
      'file_uri',
      'stored_uri',
      'image_uri',
      'uri',
      'local_uri',
    ]);

    if (!uri) continue;

    const name =
      firstString(row, [
        'original_name',
        'file_name',
        'name',
      ]) || 'image.jpg';

    const asset = await assetFromUri(
      uri,
      'IMAGE',
      name,
      firstString(row, ['mime_type', 'mimeType']),
    );

    if (!asset) continue;

    assets.push(asset);
    entry.assetIds.push(asset.assetId);
  }
}

async function attachFrequencyAudio(
  frequency: PortableObject,
  assets: PortableAsset[],
) {
  shareProbe('audio:attach:start', {
    id: frequency.sourceId,
    title: frequency.title,
  });
  const uri =
    typeof frequency.data.file_uri === 'string'
      ? frequency.data.file_uri
      : null;

  if (!uri) return;

  const asset = await assetFromUri(
    uri,
    'AUDIO',
    String(
      frequency.data.original_name ||
        frequency.title ||
        'frequency.mp3',
    ),
    typeof frequency.data.mime_type === 'string'
      ? frequency.data.mime_type
      : null,
  );

  if (!asset) return;

  assets.push(asset);
  frequency.assetIds.push(asset.assetId);
}

async function directEntrySoundtracks(
  database: Awaited<ReturnType<typeof getDatabase>>,
  entryId: string,
) {
  if (
    !(await tableExists(
      database,
      'entry_soundtracks',
    ))
  ) {
    return [] as Row[];
  }

  return database.getAllAsync<Row>(
    `SELECT
        l.*,
        t.title AS track_title,
        t.artist,
        t.file_uri,
        t.original_name,
        t.mime_type,
        t.waveform_seed,
        t.created_at AS track_created_at,
        t.modified_at AS track_modified_at
       FROM entry_soundtracks l
       JOIN audio_tracks t
         ON t.track_id=l.track_id
      WHERE l.entry_id=?
      ORDER BY l.created_at`,
    entryId,
  );
}

async function graphRelationships(
  database: Awaited<ReturnType<typeof getDatabase>>,
  objects: PortableObject[],
) {
  if (
    !(await tableExists(database, 'entity_links'))
  ) {
    return [] as PortableRelationship[];
  }

  const map = new Map(
    objects.map((object) => [
      object.entityType + ':' + object.sourceId,
      object.portableId,
    ]),
  );

  const rows =
    await database.getAllAsync<Row>(
      'SELECT * FROM entity_links ORDER BY created_at',
    );

  const relationships: PortableRelationship[] = [];

  for (const row of rows) {
    const sourceKey =
      String(row.source_type) +
      ':' +
      String(row.source_id);

    const targetKey =
      String(row.target_type) +
      ':' +
      String(row.target_id);

    const sourcePortableId = map.get(sourceKey);
    const targetPortableId = map.get(targetKey);

    if (!sourcePortableId || !targetPortableId) {
      continue;
    }

    relationships.push({
      sourcePortableId,
      targetPortableId,
      relationType:
        String(row.relation_type || 'RELATED'),
      note:
        typeof row.note === 'string'
          ? row.note
          : null,
    });
  }

  return relationships;
}

// portableV2StableOrigins
async function ensurePortableOriginSchema(
  database: Awaited<ReturnType<typeof getDatabase>>,
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

async function stableOriginId(
  database: Awaited<ReturnType<typeof getDatabase>>,
  object: PortableObject,
) {
  const existing =
    await database.getFirstAsync<{ origin_id: string }>(
      `SELECT origin_id
         FROM portable_entity_origins
        WHERE entity_type=?
          AND entity_id=?
        LIMIT 1`,
      object.entityType,
      object.sourceId,
    );

  if (existing?.origin_id) {
    return String(existing.origin_id);
  }

  const originId = id('origin');

  await database.runAsync(
    `INSERT OR IGNORE INTO portable_entity_origins
      (entity_type, entity_id, origin_id, first_seen_at)
     VALUES (?, ?, ?, ?)`,
    object.entityType,
    object.sourceId,
    originId,
    new Date().toISOString(),
  );

  const stored =
    await database.getFirstAsync<{ origin_id: string }>(
      `SELECT origin_id
         FROM portable_entity_origins
        WHERE entity_type=?
          AND entity_id=?
        LIMIT 1`,
      object.entityType,
      object.sourceId,
    );

  return stored?.origin_id
    ? String(stored.origin_id)
    : originId;
}

async function finalizePortablePackage(
  database: Awaited<ReturnType<typeof getDatabase>>,
  pack: LjinglePortablePackage,
) {
  shareProbe('finalize:entered', {
    objects: pack.objects.length,
    relationships: pack.relationships.length,
    assets: pack.assets.length,
  });

    shareProbe('finalize:await:0:before', 'ensurePortableOriginSchema');
await ensurePortableOriginSchema(database);

  for (const object of pack.objects) {
    shareProbe(
      'finalize:await:1:before',
      'stableOriginId',
    );

    object.originId =
      await stableOriginId(
        database,
        object,
      );
  }

  pack.version = 1;

  pack.provenance = {
    sourceApp: 'LJingle',
    sourceKind: 'LOCAL_ARCHIVE',
    exportedAt: pack.createdAt,
    graphModel: 'DIRECTED_V1',
  };

  pack.visual = {
    style: 'ARCHIVE_CARD_V1',
    objectCount: pack.objects.length,
    relationshipCount: pack.relationships.length,
    imageCount: pack.assets.filter(
      (asset) => asset.kind === 'IMAGE',
    ).length,
    audioCount: pack.assets.filter(
      (asset) => asset.kind === 'AUDIO',
    ).length,
    senderJingleCount: pack.objects.filter(
      (object) => object.jingle,
    ).length,
  };

  shareProbe('finalize:return');
  return pack;
}

function packageBase(
  title: string,
  kind: PortableEntityKind,
  rootPortableId: string,
): LjinglePortablePackage {
  return {
    format: 'ljingle',
    version: 1,
    packageId: id('package'),
    createdAt: new Date().toISOString(),
    rootPortableId,
    title,
    kind,
    objects: [],
    relationships: [],
    assets: [],
  };
}

export async function buildPortableEntryPackage(
  entryId: string,
) {
  shareProbe('entry:build:start', entryId);
  const database = await getDatabase();
  shareProbe('entry:db:ready');

  shareProbe('entry:loadEntity:start');

  const entry = await loadEntity(
    database,
    'ENTRY',
    entryId,
  );

  shareProbe('entry:loadEntity:done', {
    found: Boolean(entry),
  });

  if (!entry) {
    throw new Error('Zapis ne postoji.');
  }

  const pack = packageBase(
    entry.title,
    'ENTRY',
    entry.portableId,
  );

  pack.objects.push(entry);

  shareProbe('entry:images:start');

  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );

  shareProbe('entry:images:done', {
    assets: pack.assets.length,
  });

  shareProbe('entry:soundtracks:start');

  const soundtracks =
    await directEntrySoundtracks(
      database,
      entryId,
    );

  shareProbe('entry:soundtracks:done', {
    count: soundtracks.length,
  });

  for (const row of soundtracks) {
    const frequency = rowObject(
      'FREQUENCY',
      {
        track_id: row.track_id,
        title: row.track_title,
        artist: row.artist,
        file_uri: row.file_uri,
        original_name: row.original_name,
        mime_type: row.mime_type,
        waveform_seed: row.waveform_seed,
        created_at: row.track_created_at,
        modified_at: row.track_modified_at,
      },
    );

    pack.objects.push(frequency);
    await attachFrequencyAudio(
      frequency,
      pack.assets,
    );

    pack.relationships.push({
      sourcePortableId: entry.portableId,
      targetPortableId:
        frequency.portableId,
      relationType: 'REMEMBERED_WITH',
      note:
        typeof row.anchor_text === 'string'
          ? row.anchor_text
          : null,
    });
  }

  shareProbe('entry:graph:start', {
    objects: pack.objects.length,
  });

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  shareProbe('entry:graph:done', {
    relationships: pack.relationships.length,
  });

  shareProbe('entry:finalize:start', {
    objects: pack.objects.length,
    relationships: pack.relationships.length,
    assets: pack.assets.length,
  });

  const entryFinalized =
    await finalizePortablePackage(
      database,
      pack,
    );

  shareProbe('entry:finalize:done');

  return entryFinalized;
}

export async function buildPortableFrequencyPackage(
  trackId: string,
) {
  shareProbe('frequency:build:start', trackId);
  const database = await getDatabase();
  shareProbe('frequency:db:ready');

  const frequency = await loadEntity(
    database,
    'FREQUENCY',
    trackId,
  );

  if (!frequency) {
    throw new Error('Frekvencija ne postoji.');
  }

  const pack = packageBase(
    frequency.title,
    'FREQUENCY',
    frequency.portableId,
  );

  pack.objects.push(frequency);

  await attachFrequencyAudio(
    frequency,
    pack.assets,
  );

  if (
    await tableExists(
      database,
      'entry_soundtracks',
    )
  ) {
    const links =
      await database.getAllAsync<Row>(
        `SELECT *
           FROM entry_soundtracks
          WHERE track_id=?
          ORDER BY created_at`,
        trackId,
      );

    for (const link of links) {
      const entry = await loadEntity(
        database,
        'ENTRY',
        String(link.entry_id),
      );

      if (!entry) continue;

      if (
        !pack.objects.some(
          (item) =>
            item.portableId ===
            entry.portableId,
        )
      ) {
        pack.objects.push(entry);

        await attachEntryImages(
          database,
          entry,
          pack.assets,
        );
      }

      pack.relationships.push({
        sourcePortableId:
          frequency.portableId,
        targetPortableId:
          entry.portableId,
        relationType: 'REMEMBERED_WITH',
        note:
          typeof link.anchor_text === 'string'
            ? link.anchor_text
            : null,
      });
    }
  }

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}

export async function buildPortableCollectionPackage(
  collectionId: string,
) {
  shareProbe('collection:build:start', collectionId);
  const database = await getDatabase();
  shareProbe('collection:db:ready');

  const collection =
    await database.getFirstAsync<Row>(
      'SELECT * FROM collections WHERE collection_id=?',
      collectionId,
    );

  if (!collection) {
    throw new Error('Collection ne postoji.');
  }

  const root: PortableObject = {
    portableId:
      'collection:' + collectionId,
    entityType: 'COLLECTION',
    sourceId: collectionId,
    title: String(collection.name),
    subtitle:
      typeof collection.description === 'string'
        ? collection.description
        : null,
    jingle: false,
    data: { ...collection },
    assetIds: [],
  };

  const pack = packageBase(
    root.title,
    'COLLECTION',
    root.portableId,
  );

  pack.objects.push(root);

  const items =
    await database.getAllAsync<Row>(
      `SELECT *
         FROM collection_items
        WHERE collection_id=?
        ORDER BY position, created_at`,
      collectionId,
    );

  for (const item of items) {
    const object = await loadEntity(
      database,
      String(item.entity_type),
      String(item.entity_id),
    );

    if (!object) continue;

    if (
      !pack.objects.some(
        (current) =>
          current.portableId ===
          object.portableId,
      )
    ) {
      pack.objects.push(object);
    }

    pack.relationships.push({
      sourcePortableId: root.portableId,
      targetPortableId:
        object.portableId,
      relationType: 'CONTAINS',
      note: null,
    });

    if (object.entityType === 'ENTRY') {
      await attachEntryImages(
        database,
        object,
        pack.assets,
      );

      const soundtracks =
        await directEntrySoundtracks(
          database,
          object.sourceId,
        );

      for (const row of soundtracks) {
        const frequency = rowObject(
          'FREQUENCY',
          {
            track_id: row.track_id,
            title: row.track_title,
            artist: row.artist,
            file_uri: row.file_uri,
            original_name: row.original_name,
            mime_type: row.mime_type,
            waveform_seed: row.waveform_seed,
            created_at:
              row.track_created_at,
            modified_at:
              row.track_modified_at,
          },
        );

        if (
          !pack.objects.some(
            (current) =>
              current.portableId ===
              frequency.portableId,
          )
        ) {
          pack.objects.push(frequency);
          await attachFrequencyAudio(
            frequency,
            pack.assets,
          );
        }

        pack.relationships.push({
          sourcePortableId:
            object.portableId,
          targetPortableId:
            frequency.portableId,
          relationType: 'REMEMBERED_WITH',
          note:
            typeof row.anchor_text ===
            'string'
              ? row.anchor_text
              : null,
        });
      }
    }

    if (
      object.entityType === 'FREQUENCY'
    ) {
      await attachFrequencyAudio(
        object,
        pack.assets,
      );
    }
  }

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}

async function webPortableShareChoice(
  pack: LjinglePortablePackage,
) {
  // portableWebDialogV1
  // Use the browser top-layer <dialog> instead of a hand-made fixed overlay.
  // This cannot disappear behind React Navigation's aria-hidden screens.
  if (
    typeof document === 'undefined'
  ) {
    throw new Error(
      'Web share menu nije dostupan.',
    );
  }

  return new Promise<string | null>(
    (resolve) => {
      const dialog =
        document.createElement('dialog');

      dialog.setAttribute(
        'aria-label',
        'Share from LJingle',
      );

      dialog.style.width =
        'min(480px, calc(100vw - 32px))';
      dialog.style.maxWidth = '480px';
      dialog.style.border =
        '1px solid rgba(30,30,30,0.14)';
      dialog.style.borderRadius = '22px';
      dialog.style.padding = '0';
      dialog.style.background = '#F2EEE5';
      dialog.style.color = '#111111';
      dialog.style.boxShadow =
        '0 24px 90px rgba(0,0,0,0.28)';
      dialog.style.fontFamily =
        'Arial, Helvetica, sans-serif';

      const shell =
        document.createElement('div');

      shell.style.padding = '20px';

      const kicker =
        document.createElement('div');

      kicker.textContent =
        'SHARE FROM LJINGLE';
      kicker.style.fontSize = '10px';
      kicker.style.fontWeight = '800';
      kicker.style.letterSpacing = '1.4px';
      kicker.style.opacity = '0.55';

      const title =
        document.createElement('div');

      title.textContent = pack.title;
      title.style.marginTop = '7px';
      title.style.fontFamily =
        'Georgia, Times New Roman, serif';
      title.style.fontSize = '24px';
      title.style.fontWeight = '700';

      const copy =
        document.createElement('div');

      copy.textContent =
        'Choose how this LJingle object should leave your archive.';
      copy.style.marginTop = '7px';
      copy.style.fontSize = '12px';
      copy.style.lineHeight = '18px';
      copy.style.opacity = '0.62';

      const actions =
        document.createElement('div');

      actions.style.display = 'grid';
      actions.style.gap = '9px';
      actions.style.marginTop = '18px';

      let finished = false;

      const finish = (
        value: string | null,
      ) => {
        if (finished) return;
        finished = true;

        try {
          dialog.close();
        } catch {}

        dialog.remove();

        resolve(value);
      };

      const button = (
        label: string,
        value: string | null,
        primary = false,
      ) => {
        const item =
          document.createElement('button');

        item.type = 'button';
        item.textContent = label;
        item.style.width = '100%';
        item.style.minHeight = '46px';
        item.style.borderRadius = '13px';
        item.style.border =
          primary
            ? '1px solid #111111'
            : '1px solid rgba(30,30,30,0.14)';
        item.style.background =
          primary
            ? '#111111'
            : '#FBF8F1';
        item.style.color =
          primary
            ? '#FFFFFF'
            : '#111111';
        item.style.fontSize = '11px';
        item.style.fontWeight = '800';
        item.style.letterSpacing = '0.45px';
        item.style.cursor = 'pointer';

        item.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          finish(value);
        };

        return item;
      };

      actions.appendChild(
        button(
          'SHARE VISUAL GRAPH · PNG',
          'visual',
        ),
      );

      actions.appendChild(
        button(
          'BRIDGE · .LJINGLE',
          'bridge',
          true,
        ),
      );

      actions.appendChild(
        button(
          'SHARE .LJINGLE',
          'portable',
        ),
      );

      actions.appendChild(
        button(
          'CANCEL',
          null,
        ),
      );

      shell.appendChild(kicker);
      shell.appendChild(title);
      shell.appendChild(copy);
      shell.appendChild(actions);
      dialog.appendChild(shell);
      document.body.appendChild(dialog);

      dialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();
          finish(null);
        },
      );

      dialog.addEventListener(
        'close',
        () => {
          if (!finished) {
            finish(null);
          }
        },
      );

      try {
        dialog.showModal();
      } catch (caught) {
        dialog.remove();

        throw caught;
      }
    },
  );
}

async function choosePortableShareUnlocked(
  pack: LjinglePortablePackage,
) {
  const choice =
    await requestPortableShareChoice(
      pack.title,
    );

  if (choice === 'visual') {
    return sharePortableVisualCard(
      pack,
    );
  }

  if (choice === 'bridge') {
    const sent =
      await sendPackageToSavedBridge(
        pack,
      );

    Alert.alert(
      'Sent through Bridge',
      'Delivered to ' +
        sent.toBridgeId +
        '.',
    );

    return sent.messageId;
  }

  if (choice === 'portable') {
    return sharePackage(pack);
  }

  return null;
}

let portableShareInFlight = false;

async function choosePortableShare(
  pack: LjinglePortablePackage,
) {
  if (portableShareInFlight) {
    return null;
  }

  portableShareInFlight = true;

  try {
    return await choosePortableShareUnlocked(
      pack,
    );
  } finally {
    portableShareInFlight = false;
  }
}

async function sharePackage(
  pack: LjinglePortablePackage,
) {
  const filename =
    safeName(pack.title) +
    '.ljingle';

  const text =
    JSON.stringify(
      pack,
      null,
      2,
    );

  if (Platform.OS === 'web') {
    const web =
      globalThis as unknown as {
        Blob?: typeof Blob;
        File?: new (
          bits: BlobPart[],
          name: string,
          options?: FilePropertyBag,
        ) => globalThis.File;
        URL?: typeof URL;
        document?: Document;
        navigator?: Navigator & {
          canShare?: (
            data: ShareData,
          ) => boolean;
        };
      };

    if (!web.Blob) {
      throw new Error(
        'Web .ljingle export nije dostupan.',
      );
    }

    // Generic binary/document MIME is intentional.
    // The .ljingle extension + package contents remain canonical.
    // This exposes more messaging/document share targets than
    // application/x-ljingle+json.
    const blob =
      new web.Blob(
        [text],
        {
          type:
            'application/octet-stream',
        },
      );

    if (
      web.File &&
      web.navigator?.share &&
      web.navigator.canShare
    ) {
      const file =
        new web.File(
          [blob],
          filename,
          {
            type:
              'application/octet-stream',
          },
        );

      const data: ShareData = {
        title:
          pack.title +
          ' · .ljingle',
        files: [file],
      };

      if (
        web.navigator.canShare(
          data,
        )
      ) {
        await web.navigator.share(
          data,
        );

        return filename;
      }
    }

    if (
      !web.URL ||
      !web.document
    ) {
      throw new Error(
        'Web download nije dostupan.',
      );
    }

    const href =
      web.URL.createObjectURL(
        blob,
      );

    const anchor =
      web.document.createElement(
        'a',
      );

    anchor.href = href;
    anchor.download = filename;
    anchor.click();

    web.URL.revokeObjectURL(
      href,
    );

    return filename;
  }

  const file =
    new File(
      Paths.cache,
      filename,
    );

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(text);

  const available =
    await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error(
      'System share nije dostupan na ovom uređaju.',
    );
  }

  await Sharing.shareAsync(
    file.uri,
    {
      dialogTitle:
        'Share .ljingle file',
      // Generic document transport on purpose:
      // WhatsApp and other messaging apps often ignore custom MIME types.
      mimeType:
        'application/octet-stream',
      UTI:
        'public.data',
    },
  );

  return filename;
}


let portableLazyWebInFlight = false;

async function sharePortableLazyWeb(
  build: () => Promise<LjinglePortablePackage>,
) {
  if (portableLazyWebInFlight) {
    return null;
  }

  portableLazyWebInFlight = true;

  try {
    const preview = {
      title: 'LJingle object',
    } as LjinglePortablePackage;

    const choice =
      await webPortableShareChoice(preview);

    if (!choice) {
      return null;
    }

    if (choice === 'visual') {
      portableMetadataOnly = true;

      try {
        const pack = await build();

        return await sharePortableVisualCard(
          pack,
        );
      } finally {
        portableMetadataOnly = false;
      }
    }

    // Bridge and .ljingle intentionally build the complete canonical package.
    // Put a hard timeout around that work so a broken asset can never leave
    // the whole app permanently stuck in "sharing".
    const pack =
      await Promise.race([
        build(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  'Portable package build timed out after 20s. Last stage: ' +
                  shareProbeStage +
                  (shareProbeDetail
                    ? ' ' + shareProbeDetail
                    : ''),
                ),
              ),
            20000,
          );
        }),
      ]);

    if (choice === 'bridge') {
      const sent =
        await sendPackageToSavedBridge(
          pack,
        );

      if (
        typeof window !== 'undefined'
      ) {
        window.alert(
          'Sent through Bridge to ' +
            sent.toBridgeId +
            '.',
        );
      }

      return sent.messageId;
    }

    if (choice === 'portable') {
      return sharePackage(pack);
    }

    return null;
  } finally {
    portableMetadataOnly = false;
    portableLazyWebInFlight = false;
  }
}

async function sharePortableLazy(
  build: () => Promise<LjinglePortablePackage>,
) {
  if (Platform.OS === 'web') {
    return sharePortableLazyWeb(build);
  }

  return choosePortableShare(
    await build(),
  );
}

export async function sharePortableEntry(
  entryId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableEntryPackage(
        entryId,
      ),
  );
}

// forkBFrequencyShareV1
export type PortableFrequencyShareMode =
  | 'visual'
  | 'bridge'
  | 'portable';

export async function sharePortableFrequencyAs(
  trackId: string,
  mode: PortableFrequencyShareMode,
): Promise<{
  mode: PortableFrequencyShareMode;
  toBridgeId?: string;
}> {
  if (mode === 'visual') {
    portableMetadataOnly = true;

    try {
      const pack =
        await buildPortableFrequencyPackage(
          trackId,
        );

      await sharePortableVisualCard(pack);
      return { mode };
    } finally {
      portableMetadataOnly = false;
    }
  }

  const pack =
    await Promise.race([
      buildPortableFrequencyPackage(trackId),
      new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                'Portable package build timed out after 20s. Last stage: ' +
                  shareProbeStage +
                  (shareProbeDetail
                    ? ' ' + shareProbeDetail
                    : ''),
              ),
            ),
          20000,
        );
      }),
    ]);

  if (mode === 'bridge') {
    const sent =
      await sendPackageToSavedBridge(pack);

    return {
      mode,
      toBridgeId: sent.toBridgeId,
    };
  }

  await sharePackage(pack);
  return { mode };
}

export async function sharePortableFrequency(
  trackId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableFrequencyPackage(
        trackId,
      ),
  );
}

export async function sharePortableCollection(
  collectionId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableCollectionPackage(
        collectionId,
      ),
  );
}

export async function buildPortableTopicPackage(
  topicId: string,
) {
  const database = await getDatabase();

  const topic = await loadEntity(
    database,
    'TOPIC',
    topicId,
  );

  if (!topic) {
    throw new Error('Tema ne postoji.');
  }

  const pack = packageBase(
    topic.title,
    'TOPIC',
    topic.portableId,
  );

  pack.objects.push(topic);

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return finalizePortablePackage(database, pack);
}

export async function sharePortableTopic(
  topicId: string,
) {
  return sharePortableLazy(
    () =>
      buildPortableTopicPackage(
        topicId,
      ),
  );
}

export async function buildPortableEntityPackage(
  entityType: Exclude<
    PortableEntityKind,
    'COLLECTION'
  >,
  entityId: string,
) {
  if (entityType === 'ENTRY') {
    return buildPortableEntryPackage(entityId);
  }

  if (entityType === 'FREQUENCY') {
    return buildPortableFrequencyPackage(entityId);
  }

  if (entityType === 'TOPIC') {
    return buildPortableTopicPackage(entityId);
  }

  const database = await getDatabase();

  const root = await loadEntity(
    database,
    entityType,
    entityId,
  );

  if (!root) {
    throw new Error(
      'Stavka za dijeljenje ne postoji.',
    );
  }

  const pack = packageBase(
    root.title,
    entityType,
    root.portableId,
  );

  pack.objects.push(root);

  pack.relationships.push(
    ...(
      await graphRelationships(
        database,
        pack.objects,
      )
    ),
  );

  return finalizePortablePackage(
    database,
    pack,
  );
}

export async function sharePortableEntity(
  entityType: Exclude<
    PortableEntityKind,
    'COLLECTION'
  >,
  entityId: string,
) {
  if (entityType === 'ENTRY') {
    return sharePortableEntry(entityId);
  }

  if (entityType === 'FREQUENCY') {
    return sharePortableFrequency(entityId);
  }

  if (entityType === 'TOPIC') {
    return sharePortableTopic(entityId);
  }

  return sharePortableLazy(
    () =>
      buildPortableEntityPackage(
        entityType,
        entityId,
      ),
  );
}

export function inspectPortablePackage(
  text: string,
) {
  const value =
    JSON.parse(text) as Partial<LjinglePortablePackage>;

  if (
    value.format !== 'ljingle' ||
    value.version !== 1 ||
    !Array.isArray(value.objects) ||
    !Array.isArray(value.relationships) ||
    !Array.isArray(value.assets)
  ) {
    throw new Error(
      'Datoteka nije valjani LJingle paket.',
    );
  }

  return value as LjinglePortablePackage;
}

// sharingVisualGraphPortableFinalV1_1

// sharingSimpleGraphCardV1_1
