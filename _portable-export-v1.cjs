const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const entryForm = path.join(SRC, 'screens', 'EntryFormScreen.tsx');
const radioScreen = path.join(SRC, 'screens', 'MemoryRadioScreen.tsx');
const packageJson = path.join(MOBILE, 'package.json');

for (const file of [entryForm, radioScreen, packageJson]) {
  if (!fs.existsSync(file)) {
    throw new Error('SAFE STOP - missing ' + file);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-export-v1-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });

function backup(file) {
  fs.copyFileSync(
    file,
    path.join(backupDir, path.basename(file)),
  );
}

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function must(value, message) {
  if (!value) {
    throw new Error('SAFE STOP - ' + message);
  }
}

backup(entryForm);
backup(radioScreen);
backup(packageJson);

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

const typeFile = path.join(SRC, 'types', 'portablePackage.ts');

const typeSource = `export type PortableEntityKind =
  | 'ENTRY'
  | 'FREQUENCY'
  | 'COLLECTION'
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC';

export type PortableAsset = {
  assetId: string;
  kind: 'IMAGE' | 'AUDIO';
  name: string;
  mimeType: string | null;
  byteLength: number | null;
  base64: string | null;
};

export type PortableObject = {
  portableId: string;
  entityType: PortableEntityKind;
  sourceId: string;
  title: string;
  subtitle: string | null;
  jingle: boolean;
  data: Record<string, unknown>;
  assetIds: string[];
};

export type PortableRelationship = {
  sourcePortableId: string;
  targetPortableId: string;
  relationType: string;
  note: string | null;
};

export type LjinglePortablePackage = {
  format: 'ljingle';
  version: 1;
  packageId: string;
  createdAt: string;
  rootPortableId: string;
  title: string;
  kind: PortableEntityKind;
  objects: PortableObject[];
  relationships: PortableRelationship[];
  assets: PortableAsset[];
};
`;

write(typeFile, typeSource);

// ------------------------------------------------------------
// Portable export engine
// ------------------------------------------------------------

const serviceFile = path.join(
  SRC,
  'services',
  'portableExport.ts',
);

const serviceSource = `import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';
import type {
  LjinglePortablePackage,
  PortableAsset,
  PortableEntityKind,
  PortableObject,
  PortableRelationship,
} from '../types/portablePackage';

type Row = Record<string, string | number | null>;

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
    .replace(/[\\u0300-\\u036f]/g, '')
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
      \`SELECT name
         FROM sqlite_master
        WHERE type='table'
          AND name=?\`,
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
              .replace(/\\s+/g, ' ')
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
    [string, string, PortableEntityKind]
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
    \`SELECT * FROM \${table} WHERE \${column}=?\`,
    entityId,
  );

  return row ? rowObject(kind, row) : null;
}

async function assetFromUri(
  uri: string,
  kind: 'IMAGE' | 'AUDIO',
  name: string,
  mimeType: string | null,
): Promise<PortableAsset | null> {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let binary = '';
      const step = 0x8000;

      for (
        let index = 0;
        index < bytes.length;
        index += step
      ) {
        binary += String.fromCharCode(
          ...bytes.subarray(
            index,
            Math.min(index + step, bytes.length),
          ),
        );
      }

      const base64 =
        (globalThis as unknown as {
          btoa?: (value: string) => string;
        }).btoa?.(binary) ?? null;

      return {
        assetId: id('asset'),
        kind,
        name,
        mimeType: mimeType || blob.type || null,
        byteLength: bytes.length,
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
    \`SELECT
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
      ORDER BY l.created_at\`,
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
  const database = await getDatabase();

  const entry = await loadEntity(
    database,
    'ENTRY',
    entryId,
  );

  if (!entry) {
    throw new Error('Zapis ne postoji.');
  }

  const pack = packageBase(
    entry.title,
    'ENTRY',
    entry.portableId,
  );

  pack.objects.push(entry);

  await attachEntryImages(
    database,
    entry,
    pack.assets,
  );

  const soundtracks =
    await directEntrySoundtracks(
      database,
      entryId,
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

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return pack;
}

export async function buildPortableFrequencyPackage(
  trackId: string,
) {
  const database = await getDatabase();

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
        \`SELECT *
           FROM entry_soundtracks
          WHERE track_id=?
          ORDER BY created_at\`,
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

  return pack;
}

export async function buildPortableCollectionPackage(
  collectionId: string,
) {
  const database = await getDatabase();

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
      \`SELECT *
         FROM collection_items
        WHERE collection_id=?
        ORDER BY position, created_at\`,
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

  return pack;
}

async function sharePackage(
  pack: LjinglePortablePackage,
) {
  const filename =
    safeName(pack.title) + '.ljingle';

  const text = JSON.stringify(
    pack,
    null,
    2,
  );

  if (Platform.OS === 'web') {
    const web = globalThis as unknown as {
      Blob?: typeof Blob;
      URL?: typeof URL;
      document?: Document;
    };

    if (
      !web.Blob ||
      !web.URL ||
      !web.document
    ) {
      throw new Error(
        'Web download nije dostupan.',
      );
    }

    const blob = new web.Blob(
      [text],
      {
        type:
          'application/x-ljingle+json',
      },
    );

    const href =
      web.URL.createObjectURL(blob);

    const anchor =
      web.document.createElement('a');

    anchor.href = href;
    anchor.download = filename;
    anchor.click();

    web.URL.revokeObjectURL(href);

    return filename;
  }

  const file = new File(
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
      dialogTitle: 'Share LJingle',
      mimeType:
        'application/x-ljingle+json',
      UTI: 'public.data',
    },
  );

  return filename;
}

export async function sharePortableEntry(
  entryId: string,
) {
  return sharePackage(
    await buildPortableEntryPackage(
      entryId,
    ),
  );
}

export async function sharePortableFrequency(
  trackId: string,
) {
  return sharePackage(
    await buildPortableFrequencyPackage(
      trackId,
    ),
  );
}

export async function sharePortableCollection(
  collectionId: string,
) {
  return sharePackage(
    await buildPortableCollectionPackage(
      collectionId,
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
`;

write(serviceFile, serviceSource);

// ------------------------------------------------------------
// ENTRY share button
// ------------------------------------------------------------

{
  let text = read(entryForm);

  const importAnchor =
    "import { ApiError, entryApi } from '../services/entryApi';";

  must(
    text.includes(importAnchor),
    'EntryForm entryApi import anchor changed',
  );

  if (
    !text.includes(
      "from '../services/portableExport'",
    )
  ) {
    text = text.replace(
      importAnchor,
      `${importAnchor}
import { sharePortableEntry } from '../services/portableExport';`,
    );
  }

  if (!text.includes('const shareEntry = async')) {
    const submitAnchor =
      '  const save = async () => {';

    must(
      text.includes(submitAnchor),
      'EntryForm submit anchor changed',
    );

    const handler = `  const shareEntry = async () => {
    if (!entryId || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      await sharePortableEntry(entryId);
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setSaving(false);
    }
  };

`;

    text = text.replace(
      submitAnchor,
      handler + submitAnchor,
    );
  }

  if (!text.includes('SHARE .LJINGLE')) {
    const actionsAnchor =
      '          <View style={styles.actions}>';

    must(
      text.includes(actionsAnchor),
      'EntryForm actions anchor changed',
    );

    const shareButton = `          {editing && entryId ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void shareEntry()}
              style={({ pressed }) => [
                {
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.separator,
                  backgroundColor: colors.surface,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                SHARE .LJINGLE
              </Text>
            </Pressable>
          ) : null}

`;

    text = text.replace(
      actionsAnchor,
      shareButton + actionsAnchor,
    );
  }

  write(entryForm, text);
}

// ------------------------------------------------------------
// FREQUENCY share action
// ------------------------------------------------------------

{
  let text = read(radioScreen);

  const importAnchor =
    "import { memoryRadioApi, pickLocalAudio } from '../services/memoryRadioApi';";

  must(
    text.includes(importAnchor),
    'MemoryRadio API import anchor changed',
  );

  if (
    !text.includes(
      "from '../services/portableExport'",
    )
  ) {
    text = text.replace(
      importAnchor,
      `${importAnchor}
import { sharePortableFrequency } from '../services/portableExport';`,
    );
  }

  if (
    !text.includes(
      'const shareFrequency = async',
    )
  ) {
    const marker =
      '  const shuffle = () => {';

    must(
      text.includes(marker),
      'MemoryRadio shuffle anchor changed',
    );

    const handler = `  const shareFrequency = async (
    memory: MemoryTrack,
  ) => {
    if (busyTrackId) return;

    setBusyTrackId(memory.trackId);
    setError(null);

    try {
      await sharePortableFrequency(
        memory.trackId,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setBusyTrackId(null);
    }
  };

`;

    text = text.replace(
      marker,
      handler + marker,
    );
  }

  if (!text.includes('>SHARE</Text>')) {
    const rowActionsAnchor =
      '                    <View style={styles.rowActions}>';

    must(
      text.includes(rowActionsAnchor),
      'MemoryRadio rowActions anchor changed',
    );

    const button = `                    <View style={styles.rowActions}>
                      <Pressable
                        disabled={busy}
                        onPress={() =>
                          void shareFrequency(memory)
                        }
                        style={({ pressed }) => [
                          styles.rowAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.rowActionText}>SHARE</Text>
                      </Pressable>`;

    text = text.replace(
      rowActionsAnchor,
      button,
    );
  }

  write(radioScreen, text);
}

// ------------------------------------------------------------
// Collection export helper note
// ------------------------------------------------------------

console.log('');
console.log('PORTABLE EXPORT V1 INSTALLED');
console.log('');
console.log('✓ .ljingle portable JSON format');
console.log('✓ Zapis export');
console.log('✓ Zapis images included when available');
console.log('✓ linked frequency/audio included');
console.log('✓ Frequency export + linked Zapisi');
console.log('✓ Collection / Memory Box export engine');
console.log('✓ graph relationships preserved');
console.log('✓ Jingle flag preserved for catalogue items');
console.log('✓ native OS share sheet');
console.log('✓ web downloads .ljingle file');
console.log('');
console.log('UI:');
console.log('  ✓ existing Zapis -> SHARE .LJINGLE');
console.log('  ✓ Memory Radio frequency -> SHARE');
console.log('  ○ Collection button comes in V1B');
console.log('');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync('npx tsc --noEmit', {
    cwd: MOBILE,
    stdio: 'inherit',
  });

  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error('TYPESCRIPT FAILED');
  console.error(
    'Restore originals from:',
  );
  console.error(backupDir);
  process.exitCode = 1;
}
