const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const collectionScreen = path.join(SRC, 'screens', 'CollectionDetailsScreen.tsx');
const settingsScreen = path.join(SRC, 'screens', 'ThemePickerScreen.tsx');
const portableExport = path.join(SRC, 'services', 'portableExport.ts');
const portableTypes = path.join(SRC, 'types', 'portablePackage.ts');
const packageJson = path.join(MOBILE, 'package.json');

for (const file of [collectionScreen, settingsScreen, portableExport, portableTypes, packageJson]) {
  if (!fs.existsSync(file)) throw new Error('SAFE STOP - missing ' + path.relative(ROOT, file));
}

const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
if (!((pkg.dependencies && pkg.dependencies['expo-document-picker']) ||
      (pkg.devDependencies && pkg.devDependencies['expo-document-picker']))) {
  throw new Error(
    'SAFE STOP - expo-document-picker nije instaliran. Iz mobile foldera pokreni: npx expo install expo-document-picker'
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '_recovery', 'portable-v1b-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}
function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}
function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

backup(collectionScreen);
backup(settingsScreen);

const importServicePath = path.join(SRC, 'services', 'portableImport.ts');
const importPanelPath = path.join(SRC, 'components', 'PortableImportPanel.tsx');

const importService = String.raw`import { Directory, File, Paths } from 'expo-file-system';
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

export type PortablePreview = {
  pack: LjinglePortablePackage;
  objectCounts: Record<string, number>;
  imageCount: number;
  audioCount: number;
  embeddedBytes: number;
};

export type PortableImportResult = {
  imported: number;
  reused: number;
  relationships: number;
  collectionId: string | null;
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

function scalar(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

async function findDuplicate(
  database: Database,
  object: PortableObject,
): Promise<string | null> {
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
    imageCount: pack.assets.filter((asset) => asset.kind === 'IMAGE').length,
    audioCount: pack.assets.filter((asset) => asset.kind === 'AUDIO').length,
    embeddedBytes: pack.assets.reduce(
      (total, asset) => total + (asset.byteLength ?? 0),
      0,
    ),
  };
}

export async function readPortablePackageFile(uri: string) {
  const file = new File(uri);
  return previewPortablePackage(await file.text());
}

export async function importPortablePackage(
  pack: LjinglePortablePackage,
): Promise<PortableImportResult> {
  const database = await getDatabase();
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
          localIds.set(object.portableId, duplicate);
          reused += 1;
          continue;
        }

        const localId = id(kind.toLowerCase());
        await insertDynamic(
          transaction,
          object,
          localId,
          assetUris,
        );

        localIds.set(object.portableId, localId);
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
          \`INSERT OR IGNORE INTO collection_items
           (item_id, collection_id, entity_type, entity_id, position, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)\`,
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
          \`INSERT OR IGNORE INTO entry_soundtracks
           (link_id, entry_id, track_id, anchor_text, clip_start_seconds, clip_end_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)\`,
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
          \`INSERT OR IGNORE INTO entity_links
           (link_id, source_type, source_id, target_type, target_id,
            relation_type, note, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
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

  return {
    imported,
    reused,
    relationships: relationshipCount,
    collectionId: importedCollectionId,
  };
}
`;

const importPanel = String.raw`import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  importPortablePackage,
  readPortablePackageFile,
  type PortablePreview,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function bytesLabel(value: number) {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

export function PortableImportPanel() {
  const [preview, setPreview] = useState<PortablePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async () => {
    if (busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/json', 'text/plain', 'application/octet-stream', '*/*'],
      });

      if (result.canceled) return;

      setPreview(await readPortablePackageFile(result.assets[0].uri));
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'LJingle paket se nije mogao otvoriti.',
      );
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview || busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const result = await importPortablePackage(preview.pack);
      setMessage(
        'Uvezeno: ' +
          result.imported +
          ' · postojeće ponovno korišteno: ' +
          result.reused +
          ' · veze: ' +
          result.relationships,
      );
      setPreview(null);
      Alert.alert('LJingle import gotov', 'Paket je dodan u tvoju lokalnu arhivu.');
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Import nije uspio.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Portable archive</Text>
      <Text style={styles.title}>Import .ljingle</Text>
      <Text style={styles.copy}>
        Otvori Zapis, frekvenciju ili Memory Box koji ti je netko poslao.
        Import je additive — ne briše postojeće podatke.
      </Text>

      <Pressable
        disabled={busy}
        onPress={() => void pick()}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}
      >
        {busy && !preview ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>ODABERI .LJINGLE</Text>
        )}
      </Pressable>

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewKicker}>Preview</Text>
          <Text style={styles.previewTitle}>{preview.pack.title}</Text>
          <Text style={styles.meta}>
            {preview.pack.kind} · {preview.pack.objects.length} objekata ·{' '}
            {preview.imageCount} slika · {preview.audioCount} audio ·{' '}
            {bytesLabel(preview.embeddedBytes)}
          </Text>

          <View style={styles.counts}>
            {Object.entries(preview.objectCounts).map(([kind, count]) => (
              <Text key={kind} style={styles.count}>
                {kind}: {count}
              </Text>
            ))}
          </View>

          <Pressable
            disabled={busy}
            onPress={() => void doImport()}
            style={({ pressed }) => [
              styles.importButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.importText}>IMPORTIRAJ U LJINGLE</Text>
            )}
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => setPreview(null)}
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Odustani</Text>
          </Pressable>
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    padding: 17,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    minHeight: 48,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  buttonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  preview: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  counts: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  importButton: {
    minHeight: 46,
    marginTop: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  cancel: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  message: {
    marginTop: 12,
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});
`;

write(importServicePath, importService);
write(importPanelPath, importPanel);

// ============================================================
// CollectionDetails -> SHARE .LJINGLE
// ============================================================
{
  let text = read(collectionScreen);

  if (!text.includes('sharePortableCollection')) {
    const importRe =
      /^import\s+\{\s*collectionApi\s*\}\s+from\s+['"]\.\.\/services\/collectionApi['"];\s*$/m;
    const match = importRe.exec(text);
    if (!match) fail('CollectionDetails collectionApi import not found');

    text =
      text.slice(0, match.index + match[0].length) +
      "\nimport { sharePortableCollection } from '../services/portableExport';" +
      text.slice(match.index + match[0].length);
  }

  if (!text.includes('const shareCollection = async')) {
    const markerRe = /^  const openPicker = async \(\) => \{/m;
    const match = markerRe.exec(text);
    if (!match) fail('CollectionDetails openPicker handler not found');

    const handler = `  const shareCollection = async () => {
    if (!collection || deleting) return;

    setError(null);
    try {
      await sharePortableCollection(collectionId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    }
  };

`;

    text = text.slice(0, match.index) + handler + text.slice(match.index);
  }

  if (!text.includes('SHARE MEMORY BOX')) {
    const addButtonRe =
      /^ {12}<Pressable onPress=\{\(\) => void openPicker\(\)\}/m;
    const match = addButtonRe.exec(text);
    if (!match) fail('CollectionDetails add button anchor not found');

    const button = `            <Pressable
              onPress={() => void shareCollection()}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.shareButtonText}>SHARE MEMORY BOX</Text>
            </Pressable>

`;

    text = text.slice(0, match.index) + button + text.slice(match.index);
  }

  if (!text.includes('shareButton: {')) {
    const stylesMarker = "  addButton: {";
    const index = text.indexOf(stylesMarker);
    if (index < 0) fail('CollectionDetails addButton style not found');

    const style = `  shareButton: {
    minHeight: 46,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
`;

    text = text.slice(0, index) + style + text.slice(index);
  }

  write(collectionScreen, text);
}

// ============================================================
// Settings -> PortableImportPanel
// ============================================================
{
  let text = read(settingsScreen);

  if (!text.includes("from '../components/PortableImportPanel'")) {
    const importLines = [...text.matchAll(/^import .*;$/gm)];
    if (!importLines.length) fail('ThemePicker imports not found');
    const last = importLines[importLines.length - 1];
    const insertAt = last.index + last[0].length;

    text =
      text.slice(0, insertAt) +
      "\nimport { PortableImportPanel } from '../components/PortableImportPanel';" +
      text.slice(insertAt);
  }

  if (!text.includes('<PortableImportPanel />')) {
    const markerCandidates = [
      '{/* settingsJsonDownloadV2',
      '{/* settingsJsonImportV1',
      "saving ? 'Pripremam backup",
      "saving ? \"Pripremam backup",
    ];

    let index = -1;
    for (const marker of markerCandidates) {
      index = text.indexOf(marker);
      if (index >= 0) break;
    }

    if (index < 0) fail('ThemePicker JSON backup section anchor not found');

    const lineStart = text.lastIndexOf('\n', index) + 1;
    text =
      text.slice(0, lineStart) +
      '        <PortableImportPanel />\n\n' +
      text.slice(lineStart);
  }

  write(settingsScreen, text);
}

console.log('');
console.log('PORTABLE V1B INSTALLED');
console.log('✓ Collection / Memory Box SHARE .LJINGLE');
console.log('✓ Settings -> Import .ljingle picker');
console.log('✓ Preview before import');
console.log('✓ additive import + local ID remap');
console.log('✓ catalogue duplicate reuse');
console.log('✓ Entry/Frequency/Collection import');
console.log('✓ embedded images/audio restored when present');
console.log('✓ collection membership + graph relationships rebuilt');
console.log('✓ sender Jingle does NOT auto-favourite receiver copy');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync('npx tsc --noEmit', {
    cwd: MOBILE,
    stdio: 'inherit',
    shell: true,
  });
  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error('TYPESCRIPT FAILED');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
