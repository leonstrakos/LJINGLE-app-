const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  types: path.join(SRC, 'types', 'portablePackage.ts'),
  exportService: path.join(SRC, 'services', 'portableExport.ts'),
  importService: path.join(SRC, 'services', 'portableImport.ts'),
  importPanel: path.join(SRC, 'components', 'PortableImportPanel.tsx'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' + name + ': ' + path.relative(ROOT, file),
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-v2-core-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function backup(file) {
  fs.copyFileSync(
    file,
    path.join(backupDir, path.basename(file)),
  );
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

for (const file of Object.values(files)) backup(file);

// ============================================================================
// 1) PORTABLE TYPES V2 — backwards-compatible with V1 files.
// ============================================================================

write(
  files.types,
  `export type PortableEntityKind =
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

  // V2: stable identity survives repeated exports/imports.
  originId?: string | null;
};

export type PortableRelationship = {
  sourcePortableId: string;
  targetPortableId: string;
  relationType: string;
  note: string | null;
};

export type PortableProvenance = {
  sourceApp: 'LJingle';
  sourceKind: 'LOCAL_ARCHIVE';
  exportedAt: string;
  graphModel: 'DIRECTED_V1';
};

export type PortableVisualManifest = {
  style: 'ARCHIVE_CARD_V1';
  objectCount: number;
  relationshipCount: number;
  imageCount: number;
  audioCount: number;
  senderJingleCount: number;
};

export type LjinglePortablePackage = {
  format: 'ljingle';

  // V1 remains readable. New exports are V2.
  version: 1 | 2;

  packageId: string;
  createdAt: string;
  rootPortableId: string;
  title: string;
  kind: PortableEntityKind;
  objects: PortableObject[];
  relationships: PortableRelationship[];
  assets: PortableAsset[];

  provenance?: PortableProvenance;
  visual?: PortableVisualManifest;
};
`,
);

// ============================================================================
// 2) EXPORT V2
//    - stable origin IDs
//    - provenance
//    - visual manifest
//    - V1 reader compatibility
// ============================================================================

{
  let text = read(files.exportService);

  if (!text.includes('// portableV2StableOrigins')) {
    const packageBaseAnchor = 'function packageBase(';
    const index = text.indexOf(packageBaseAnchor);

    if (index < 0) {
      fail('portableExport packageBase anchor changed');
    }

    const helper = `// portableV2StableOrigins
async function ensurePortableOriginSchema(
  database: Awaited<ReturnType<typeof getDatabase>>,
) {
  await database.execAsync(\`
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
  \`);
}

async function stableOriginId(
  database: Awaited<ReturnType<typeof getDatabase>>,
  object: PortableObject,
) {
  const existing =
    await database.getFirstAsync<{ origin_id: string }>(
      \`SELECT origin_id
         FROM portable_entity_origins
        WHERE entity_type=?
          AND entity_id=?
        LIMIT 1\`,
      object.entityType,
      object.sourceId,
    );

  if (existing?.origin_id) {
    return String(existing.origin_id);
  }

  const originId = id('origin');

  await database.runAsync(
    \`INSERT OR IGNORE INTO portable_entity_origins
      (entity_type, entity_id, origin_id, first_seen_at)
     VALUES (?, ?, ?, ?)\`,
    object.entityType,
    object.sourceId,
    originId,
    new Date().toISOString(),
  );

  const stored =
    await database.getFirstAsync<{ origin_id: string }>(
      \`SELECT origin_id
         FROM portable_entity_origins
        WHERE entity_type=?
          AND entity_id=?
        LIMIT 1\`,
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
  await ensurePortableOriginSchema(database);

  for (const object of pack.objects) {
    object.originId =
      await stableOriginId(database, object);
  }

  pack.version = 2;

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

  return pack;
}

`;

    text =
      text.slice(0, index) +
      helper +
      text.slice(index);
  }

  // packageBase may still say version 1. New exports are finalized to V2,
  // but set it here too so the in-memory shape is already correct.
  text = text.replace(
    "    version: 1,\n",
    "    version: 2,\n",
  );

  // Every builder has `database` in scope and ends in return pack.
  const returnCount = (text.match(/  return pack;\n}/g) || []).length;

  if (returnCount < 3) {
    fail(
      'portableExport builder return shape changed; expected at least 3 return pack blocks',
    );
  }

  text = text.replace(
    /  return pack;\n}/g,
    '  return finalizePortablePackage(database, pack);\n}',
  );

  // V1 and V2 must both import.
  const oldInspect =
    "    value.version !== 1 ||";

  if (text.includes(oldInspect)) {
    text = text.replace(
      oldInspect,
      "    (value.version !== 1 && value.version !== 2) ||",
    );
  } else if (
    !text.includes(
      'value.version !== 1 && value.version !== 2',
    )
  ) {
    fail('portableExport inspect version guard changed');
  }

  write(files.exportService, text);
}

// ============================================================================
// 3) IMPORT V2
//    - stable origin duplicate detection
//    - package preview duplicate analysis
//    - provenance registration
//    - sender Jingles stay opt-in
// ============================================================================

{
  let text = read(files.importService);

  // Extend preview/result types.
  text = text.replace(
    `export type PortablePreview = {
  pack: LjinglePortablePackage;
  objectCounts: Record<string, number>;
  imageCount: number;
  audioCount: number;
  embeddedBytes: number;
};`,
    `export type PortableVisualEdge = {
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
};`,
  );

  text = text.replace(
    `export type PortableImportResult = {
  imported: number;
  reused: number;
  relationships: number;
  collectionId: string | null;
};`,
    `export type PortableJingleCandidate = {
  entityType: 'BOOK' | 'MEDIA' | 'GAME';
  entityId: string;
  title: string;
};

export type PortableImportResult = {
  imported: number;
  reused: number;
  relationships: number;
  collectionId: string | null;
  jingleCandidates: PortableJingleCandidate[];
};`,
  );

  if (!text.includes('// portableV2ImportProvenance')) {
    const scalarAnchor =
      'function scalar(value: unknown): string | number | null {';

    const scalarIndex = text.indexOf(scalarAnchor);

    if (scalarIndex < 0) {
      fail('portableImport scalar anchor changed');
    }

    const helper = `// portableV2ImportProvenance
async function ensurePortableOriginSchema(
  database: Database,
) {
  await database.execAsync(\`
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
  \`);
}

async function originDuplicate(
  database: Database,
  object: PortableObject,
) {
  if (!object.originId) return null;

  await ensurePortableOriginSchema(database);

  const row =
    await database.getFirstAsync<Row>(
      \`SELECT entity_type, entity_id
         FROM portable_entity_origins
        WHERE origin_id=?
        LIMIT 1\`,
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
    \`INSERT OR REPLACE INTO portable_entity_origins
      (entity_type, entity_id, origin_id, first_seen_at,
       source_package_id, source_portable_id)
     VALUES (?, ?, ?, ?, ?, ?)\`,
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

`;

    text =
      text.slice(0, scalarIndex) +
      helper +
      text.slice(scalarIndex);
  }

  // Origin is strongest duplicate key. Natural catalogue matching stays as fallback.
  const findDuplicateStart = `async function findDuplicate(
  database: Database,
  object: PortableObject,
): Promise<string | null> {
  const data = object.data;`;

  if (text.includes(findDuplicateStart)) {
    text = text.replace(
      findDuplicateStart,
      `async function findDuplicate(
  database: Database,
  object: PortableObject,
): Promise<string | null> {
  const byOrigin =
    await originDuplicate(database, object);

  if (byOrigin) return byOrigin;

  const data = object.data;`,
    );
  } else if (
    !text.includes(
      'const byOrigin =\n    await originDuplicate',
    )
  ) {
    fail('portableImport findDuplicate signature changed');
  }

  // Richer synchronous preview.
  const oldPreviewReturn = `  return {
    pack,
    objectCounts,
    imageCount: pack.assets.filter((asset) => asset.kind === 'IMAGE').length,
    audioCount: pack.assets.filter((asset) => asset.kind === 'AUDIO').length,
    embeddedBytes: pack.assets.reduce(
      (total, asset) => total + (asset.byteLength ?? 0),
      0,
    ),
  };
}`;

  if (text.includes(oldPreviewReturn)) {
    text = text.replace(
      oldPreviewReturn,
      `  return {
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
}`,
    );
  } else if (!text.includes('visualEdges: buildVisualEdges(pack)')) {
    fail('portableImport preview return changed');
  }

  // readPortablePackageFile becomes DB-aware for duplicate preflight.
  const oldRead = `export async function readPortablePackageFile(uri: string) {
  const file = new File(uri);
  return previewPortablePackage(await file.text());
}`;

  if (text.includes(oldRead)) {
    text = text.replace(
      oldRead,
      `export async function readPortablePackageFile(
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
}`,
    );
  } else if (!text.includes('duplicateCount += 1')) {
    fail('portableImport readPortablePackageFile changed');
  }

  // Ensure schema at start of import.
  const importStart = `): Promise<PortableImportResult> {
  const database = await getDatabase();`;

  if (text.includes(importStart)) {
    text = text.replace(
      importStart,
      `): Promise<PortableImportResult> {
  const database = await getDatabase();
  await ensurePortableOriginSchema(database);`,
    );
  }

  // Duplicate branch: register provenance + preserve importedCollectionId.
  const oldDuplicateBranch = `        if (duplicate) {
          localIds.set(object.portableId, duplicate);
          reused += 1;
          continue;
        }`;

  if (text.includes(oldDuplicateBranch)) {
    text = text.replace(
      oldDuplicateBranch,
      `        if (duplicate) {
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
        }`,
    );
  } else if (!text.includes('await registerPortableOrigin(')) {
    fail('portableImport duplicate branch changed');
  }

  // New insert: register origin.
  const oldInserted = `        localIds.set(object.portableId, localId);
        imported += 1;`;

  if (text.includes(oldInserted)) {
    text = text.replace(
      oldInserted,
      `        localIds.set(
          object.portableId,
          localId,
        );

        await registerPortableOrigin(
          transaction,
          pack,
          object,
          localId,
        );

        imported += 1;`,
    );
  }

  // Build opt-in Jingle candidates at end.
  const oldReturn = `  return {
    imported,
    reused,
    relationships: relationshipCount,
    collectionId: importedCollectionId,
  };
}`;

  if (text.includes(oldReturn)) {
    text = text.replace(
      oldReturn,
      `  const jingleCandidates =
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
}`,
    );
  } else if (!text.includes('addPortableImportsToJingles')) {
    fail('portableImport result return changed');
  }

  write(files.importService, text);
}

// ============================================================================
// 4) VISUAL IMPORT PREVIEW
//    This is deliberately a normal React Native card, so Portable V2's visual
//    grammar can later be captured/exported as an image without redesigning it.
// ============================================================================

write(
  files.importPanel,
  `import { useState } from 'react';
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
  addPortableImportsToJingles,
  importPortablePackage,
  readPortablePackageFile,
  type PortableImportResult,
  type PortablePreview,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function bytesLabel(value: number) {
  if (value < 1024) return value + ' B';

  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + ' KB';
  }

  return (
    (value / (1024 * 1024)).toFixed(1) +
    ' MB'
  );
}

export function PortableImportPanel() {
  const [preview, setPreview] =
    useState<PortablePreview | null>(null);

  const [lastImport, setLastImport] =
    useState<PortableImportResult | null>(
      null,
    );

  const [busy, setBusy] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const pick = async () => {
    if (busy) return;

    setBusy(true);
    setMessage(null);
    setLastImport(null);

    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: [
            'application/json',
            'text/plain',
            'application/octet-stream',
            '*/*',
          ],
        });

      if (result.canceled) return;

      const asset = result.assets[0];

      if (!asset) {
        throw new Error(
          'Nije odabrana datoteka.',
        );
      }

      setPreview(
        await readPortablePackageFile(
          asset.uri,
        ),
      );
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
      const result =
        await importPortablePackage(
          preview.pack,
        );

      setLastImport(result);

      setMessage(
        'Uvezeno ' +
          result.imported +
          ' · ponovno korišteno ' +
          result.reused +
          ' · veze ' +
          result.relationships,
      );

      setPreview(null);

      Alert.alert(
        'LJingle import gotov',
        'Paket je dodan u tvoju lokalnu arhivu.',
      );
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

  const addJingles = async () => {
    if (
      !lastImport?.jingleCandidates.length ||
      busy
    ) {
      return;
    }

    setBusy(true);

    try {
      await addPortableImportsToJingles(
        lastImport.jingleCandidates,
      );

      const count =
        lastImport.jingleCandidates.length;

      setLastImport({
        ...lastImport,
        jingleCandidates: [],
      });

      setMessage(
        count +
          (count === 1
            ? ' stvar dodana je u tvoje Jingles.'
            : ' stvari dodane su u tvoje Jingles.'),
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Jingle status nije spremljen.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.copyColumn}>
          <Text style={styles.title}>
            Import .ljingle
          </Text>

          <Text style={styles.copy}>
            Portable graph object · additive
            import · local-first.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void pick()}
          style={({ pressed }) => [
            styles.pickButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy && !preview ? (
            <ActivityIndicator
              color={colors.text}
              size="small"
            />
          ) : (
            <Text
              style={styles.pickButtonText}
            >
              ODABERI
            </Text>
          )}
        </Pressable>
      </View>

      {preview ? (
        <View style={styles.preview}>
          <View style={styles.archiveRail}>
            <Text style={styles.railMark}>
              LJ
            </Text>
          </View>

          <View style={styles.previewBody}>
            <View style={styles.previewTop}>
              <View style={styles.previewCopy}>
                <Text
                  style={styles.previewKicker}
                >
                  {preview.pack.kind} · LJINGLE V
                  {preview.pack.version}
                </Text>

                <Text
                  numberOfLines={2}
                  style={styles.previewTitle}
                >
                  {preview.pack.title}
                </Text>
              </View>

              <Text style={styles.previewSize}>
                {bytesLabel(
                  preview.embeddedBytes,
                )}
              </Text>
            </View>

            <Text style={styles.meta}>
              {preview.pack.objects.length}{' '}
              objects ·{' '}
              {
                preview.pack.relationships
                  .length
              }{' '}
              relations · {preview.imageCount}{' '}
              images · {preview.audioCount}{' '}
              audio
            </Text>

            {preview.pack.version >= 2 ? (
              <View style={styles.provenanceRow}>
                <Text
                  style={styles.provenanceDot}
                >
                  ◉
                </Text>

                <Text style={styles.provenance}>
                  Stable provenance · directed
                  graph
                </Text>
              </View>
            ) : (
              <Text style={styles.legacy}>
                Legacy V1 package · compatible
              </Text>
            )}

            {preview.duplicateCount > 0 ? (
              <Text
                style={styles.duplicateNotice}
              >
                {
                  preview.duplicateCount
                }{' '}
                already recognized locally —
                these will be reused.
              </Text>
            ) : null}

            {preview.visualEdges.length >
            0 ? (
              <View style={styles.graph}>
                <Text style={styles.graphLabel}>
                  CONNECTIONS
                </Text>

                {preview.visualEdges.map(
                  (edge, index) => (
                    <View
                      key={
                        edge.marker +
                        ':' +
                        edge.otherKind +
                        ':' +
                        edge.otherTitle +
                        ':' +
                        index
                      }
                      style={styles.edge}
                    >
                      <Text
                        style={styles.edgeMarker}
                      >
                        {edge.marker}
                      </Text>

                      <View
                        style={styles.edgeCopy}
                      >
                        <Text
                          numberOfLines={1}
                          style={
                            styles.edgeTitle
                          }
                        >
                          {edge.otherTitle}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={
                            styles.edgeMeaning
                          }
                        >
                          {edge.label} ·{' '}
                          {edge.otherKind}
                        </Text>

                        {edge.note ? (
                          <Text
                            numberOfLines={2}
                            style={
                              styles.edgeNote
                            }
                          >
                            {edge.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ),
                )}
              </View>
            ) : null}

            {preview.senderJingleCount >
            0 ? (
              <Text style={styles.jingleNotice}>
                {
                  preview.senderJingleCount
                }{' '}
                sender Jingle
                {preview.senderJingleCount ===
                1
                  ? ''
                  : 's'}{' '}
                included. They will not be
                added to your Jingles
                automatically.
              </Text>
            ) : null}

            <View
              style={styles.previewActions}
            >
              <Pressable
                disabled={busy}
                onPress={() =>
                  setPreview(null)
                }
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={styles.secondaryText}
                >
                  Odustani
                </Text>
              </Pressable>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void doImport()
                }
                style={({ pressed }) => [
                  styles.importButton,
                  pressed &&
                    styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    color={colors.white}
                    size="small"
                  />
                ) : (
                  <Text
                    style={styles.importText}
                  >
                    IMPORTIRAJ
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {lastImport?.jingleCandidates
        .length ? (
        <View style={styles.jingleAfterImport}>
          <View style={styles.jingleAfterCopy}>
            <Text
              style={styles.jingleAfterTitle}
            >
              Sender marked{' '}
              {
                lastImport
                  .jingleCandidates.length
              }{' '}
              as Jingle
            </Text>

            <Text
              style={styles.jingleAfterMeta}
            >
              Imported safely without changing
              your Jingles.
            </Text>
          </View>

          <Pressable
            disabled={busy}
            onPress={() =>
              void addJingles()
            }
            style={({ pressed }) => [
              styles.addJinglesButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text
              style={styles.addJinglesText}
            >
              ADD TO MY JINGLES
            </Text>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <Text style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
    marginBottom: 16,
  },
  headerRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copyColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  copy: {
    marginTop: 4,
    maxWidth: 520,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  pickButton: {
    minWidth: 92,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  pickButtonText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  preview: {
    marginTop: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  archiveRail: {
    width: 38,
    paddingTop: 15,
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  railMark: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
    padding: 14,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  previewSize: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  provenanceRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  provenanceDot: {
    color: colors.text,
    fontSize: 8,
  },
  provenance: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  legacy: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 9,
  },
  duplicateNotice: {
    marginTop: 10,
    padding: 9,
    borderRadius: 10,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  graph: {
    marginTop: 14,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  graphLabel: {
    marginTop: 10,
    marginBottom: 3,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  edge: {
    minHeight: 46,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  edgeMarker: {
    minWidth: 31,
    marginTop: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.45,
    textAlign: 'center',
  },
  edgeCopy: {
    flex: 1,
    minWidth: 0,
  },
  edgeTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  edgeMeaning: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  edgeNote: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
  },
  jingleNotice: {
    marginTop: 11,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  previewActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  importButton: {
    minWidth: 108,
    minHeight: 38,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  jingleAfterImport: {
    marginTop: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  jingleAfterCopy: {
    flex: 1,
    minWidth: 0,
  },
  jingleAfterTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  jingleAfterMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
  },
  addJinglesButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  addJinglesText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  message: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
`,
);

console.log('');
console.log('PORTABLE V2 CORE INSTALLED');
console.log('✓ new exports are .ljingle V2; V1 files remain readable');
console.log('✓ stable per-entity origin IDs added for provenance');
console.log('✓ re-importing the same entity can reuse it even across later exports');
console.log('✓ existing catalogue natural-key duplicate checks remain as fallback');
console.log('✓ package carries provenance + visual manifest');
console.log('✓ import preview shows graph direction, notes, media counts and provenance');
console.log('✓ duplicate preflight shows how many objects will be reused');
console.log('✓ sender Jingle state remains opt-in, never automatic');
console.log('✓ after import: ADD TO MY JINGLES for supported imported catalogue Jingles');
console.log('✓ visual preview card is now one reusable visual grammar for later image export / Bridge');
console.log('✓ no Spring/Flyway work; provenance table is local SQLite only');
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
  console.error('TYPESCRIPT HAS ERRORS');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
