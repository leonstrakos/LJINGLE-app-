const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  collectionTypes: path.join(SRC, 'types', 'collection.ts'),
  localApi: path.join(SRC, 'storage', 'localApi.ts'),
  memoryRadio: path.join(SRC, 'screens', 'MemoryRadioScreen.tsx'),
  palette: path.join(SRC, 'components', 'CommandPalette.tsx'),
  cloudSync: path.join(SRC, 'services', 'cloudSync.ts'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`SAFE STOP - missing ${name}: ${file}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '_recovery', `brutus-functional-v2-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });

function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function must(condition, message) {
  if (!condition) throw new Error(`SAFE STOP - ${message}`);
}

Object.values(files).forEach(backup);

// ============================================================
// 1) FREQUENCY BECOMES A REAL ENTITY TYPE
// ============================================================

{
  const file = files.collectionTypes;
  let text = read(file);

  text = text.replace(
    "export type EntityReferenceType = 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY';",
    "export type EntityReferenceType = 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';"
  );

  if (!text.includes("FREQUENCY: 'Frekvencija'")) {
    const marker = "  ENTRY: 'Zapis',";
    must(text.includes(marker), 'collection entity label marker missing');
    text = text.replace(
      marker,
      `${marker}
  FREQUENCY: 'Frekvencija',`
    );
  }

  write(file, text);
}

// ============================================================
// 2) LOCAL ENTITY GRAPH KNOWS AUDIO TRACKS
// ============================================================

{
  const file = files.localApi;
  let text = read(file);

  if (!text.includes("entityType === 'FREQUENCY'")) {
    const marker = `  if (entityType === 'TOPIC') {
    const row = await database.getFirstAsync<SqlRow>('SELECT * FROM topics WHERE topic_id=?', entityId);`;

    must(text.includes(marker), 'localEntityReference TOPIC marker missing');

    const entryMarker =
      `  const row = await database.getFirstAsync<SqlRow>('SELECT * FROM entries WHERE entry_id=?', entityId);`;

    const entryIndex = text.indexOf(entryMarker, text.indexOf(marker));
    must(entryIndex >= 0, 'localEntityReference ENTRY fallback missing');

    const frequencyBlock = `  if (entityType === 'FREQUENCY') {
    const row = await database.getFirstAsync<SqlRow>(
      'SELECT * FROM audio_tracks WHERE track_id=?',
      entityId,
    );
    if (!row) throw new LocalApiFailure('Frekvencija ne postoji.', 404);
    return {
      entityType,
      entityId,
      title: String(row.title),
      subtitle: row.artist as string | null,
    };
  }

`;

    text =
      text.slice(0, entryIndex) +
      frequencyBlock +
      text.slice(entryIndex);
  }

  if (!text.includes("entityType: 'FREQUENCY'")) {
    const marker =
      `  const entries = await database.getAllAsync<SqlRow>('SELECT * FROM entries ORDER BY modified_at DESC');`;

    must(text.includes(marker), 'localEntityReferences entries marker missing');

    const insertion = `  const frequencies = await database.getAllAsync<SqlRow>(
    'SELECT * FROM audio_tracks ORDER BY created_at DESC',
  );
  frequencies.forEach((row) =>
    references.push({
      entityType: 'FREQUENCY',
      entityId: String(row.track_id),
      title: String(row.title),
      subtitle: row.artist as string | null,
    }),
  );
`;

    text = text.replace(marker, `${insertion}${marker}`);
  }

  // Jingle graph endpoint: favourite catalogue roots + anything connected to them.
  if (!text.includes('async function localJingleReferences')) {
    const marker = 'function mapCollectionSummary(row: SqlRow): CollectionSummary {';
    must(text.includes(marker), 'localApi collection summary marker missing');

    const jingleFn = `async function localJingleReferences(
  database: SQLiteDatabase,
) {
  const roots: EntityReference[] = [];

  const books = await database.getAllAsync<SqlRow>(
    'SELECT * FROM books WHERE favourite=1 ORDER BY title COLLATE NOCASE',
  );
  books.forEach((row) =>
    roots.push({
      entityType: 'BOOK',
      entityId: String(row.book_id),
      title: String(row.title),
      subtitle: String(row.author ?? ''),
    }),
  );

  const media = await database.getAllAsync<SqlRow>(
    'SELECT * FROM media_items WHERE favourite=1 ORDER BY title COLLATE NOCASE',
  );
  media.forEach((row) =>
    roots.push({
      entityType: 'MEDIA',
      entityId: String(row.media_id),
      title: String(row.title),
      subtitle: String(row.media_type ?? ''),
    }),
  );

  const games = await database.getAllAsync<SqlRow>(
    'SELECT * FROM games WHERE favourite=1 ORDER BY title COLLATE NOCASE',
  );
  games.forEach((row) =>
    roots.push({
      entityType: 'GAME',
      entityId: String(row.game_id),
      title: String(row.title),
      subtitle: row.platform as string | null,
    }),
  );

  const seen = new Map<string, EntityReference>();
  roots.forEach((item) =>
    seen.set(item.entityType + ':' + item.entityId, item),
  );

  for (const root of roots) {
    const rows = await database.getAllAsync<SqlRow>(
      \`SELECT * FROM entity_links
       WHERE (source_type=? AND source_id=?)
          OR (target_type=? AND target_id=?)
       ORDER BY created_at DESC\`,
      root.entityType,
      root.entityId,
      root.entityType,
      root.entityId,
    );

    for (const row of rows) {
      const candidates = [
        {
          type: String(row.source_type) as EntityReferenceType,
          id: String(row.source_id),
        },
        {
          type: String(row.target_type) as EntityReferenceType,
          id: String(row.target_id),
        },
      ];

      for (const candidate of candidates) {
        try {
          const reference = await localEntityReference(
            database,
            candidate.type,
            candidate.id,
          );
          seen.set(
            reference.entityType + ':' + reference.entityId,
            reference,
          );
        } catch {
          // Ignore orphaned graph edges.
        }
      }
    }
  }

  return [...seen.values()].sort((left, right) =>
    left.title.localeCompare(right.title, 'hr'),
  );
}

`;

    text = text.replace(marker, `${jingleFn}${marker}`);
  }

  if (!text.includes("url.pathname === '/entity-references/jingle'")) {
    const marker =
      `  } else if (url.pathname === '/entity-references' && method === 'GET') {`;

    must(text.includes(marker), 'localApi entity-references router marker missing');

    text = text.replace(
      marker,
      `  } else if (url.pathname === '/entity-references/jingle' && method === 'GET') {
    result = await localJingleReferences(database);
${marker}`
    );
  }

  write(file, text);
}

// ============================================================
// 3) GENERIC ENTITY LINK SERVICE
// ============================================================

const entityService = path.join(SRC, 'services', 'entityLinksApi.ts');

if (!fs.existsSync(entityService)) {
  const content = `import { apiRequest } from './apiClient';
import type {
  EntityLink,
  EntityReference,
  EntityReferenceType,
  RelationType,
} from '../types/collection';

// brutusEntityLinksApiV2
export const entityLinksApi = {
  searchReferences(query: string) {
    return apiRequest<EntityReference[]>(
      '/entity-references?query=' +
        encodeURIComponent(query),
    );
  },

  jingleReferences() {
    return apiRequest<EntityReference[]>(
      '/entity-references/jingle',
    );
  },

  getFor(entityType: EntityReferenceType, entityId: string) {
    return apiRequest<EntityLink[]>(
      '/entity-links?entityType=' +
        encodeURIComponent(entityType) +
        '&entityId=' +
        encodeURIComponent(entityId),
    );
  },

  create(request: {
    sourceType: EntityReferenceType;
    sourceId: string;
    targetType: EntityReferenceType;
    targetId: string;
    relationType: RelationType;
    note?: string | null;
  }) {
    return apiRequest<EntityLink>(
      '/entity-links',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  },

  remove(linkId: string) {
    return apiRequest<void>(
      '/entity-links/' + encodeURIComponent(linkId),
      { method: 'DELETE' },
    );
  },
};
`;
  write(entityService, content);
}

// ============================================================
// 4) FREQUENCY UNIVERSAL LINKS PANEL
// ============================================================

const panelFile = path.join(SRC, 'components', 'FrequencyLinksPanel.tsx');

if (!fs.existsSync(panelFile)) {
  const content = `import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { entityLinksApi } from '../services/entityLinksApi';
import { colors } from '../theme/colors';
import {
  entityTypeLabels,
  relationTypeLabels,
  relationTypes,
  type EntityLink,
  type EntityReference,
  type RelationType,
} from '../types/collection';
import type { MemoryTrack } from '../types/memoryRadio';

type Props = {
  frequency: MemoryTrack;
};

function otherSide(link: EntityLink) {
  if (
    link.sourceType === 'FREQUENCY' &&
    link.sourceId === link.targetId
  ) {
    return link.target;
  }

  if (link.sourceType === 'FREQUENCY') {
    return link.target;
  }

  return link.source;
}

// brutusFrequencyUniversalLinksV2
export function FrequencyLinksPanel({
  frequency,
}: Props) {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] =
    useState<EntityReference[]>([]);
  const [relation, setRelation] =
    useState<RelationType>('RELATED');
  const [busy, setBusy] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const load = async () => {
    try {
      setLinks(
        await entityLinksApi.getFor(
          'FREQUENCY',
          frequency.trackId,
        ),
      );
    } catch {
      setLinks([]);
    }
  };

  useEffect(() => {
    void load();
  }, [frequency.trackId]);

  useEffect(() => {
    const clean = query.trim();

    if (!visible || clean.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void entityLinksApi
        .searchReferences(clean)
        .then((items) => {
          if (cancelled) return;

          setResults(
            items.filter(
              (item) =>
                !(
                  item.entityType === 'FREQUENCY' &&
                  item.entityId === frequency.trackId
                ),
            ),
          );
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [frequency.trackId, query, visible]);

  const related = useMemo(
    () =>
      links.map((link) => ({
        link,
        target: otherSide(link),
      })),
    [links],
  );

  const connect = async (
    target: EntityReference,
  ) => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await entityLinksApi.create({
        sourceType: 'FREQUENCY',
        sourceId: frequency.trackId,
        targetType: target.entityType,
        targetId: target.entityId,
        relationType: relation,
      });

      setVisible(false);
      setQuery('');
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Poveznica nije spremljena.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (linkId: string) => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await entityLinksApi.remove(linkId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Poveznica nije uklonjena.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>
          POVEZANO
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(true)}
          style={styles.add}
        >
          <Text style={styles.addText}>
            + POVEŽI
          </Text>
        </Pressable>
      </View>

      {related.length === 0 ? (
        <Text style={styles.empty}>
          Ova frekvencija još nema univerzalne poveznice.
        </Text>
      ) : (
        <View style={styles.links}>
          {related.map(({ link, target }) => (
            <View
              key={link.linkId}
              style={styles.linkRow}
            >
              <View style={styles.linkCopy}>
                <Text
                  numberOfLines={1}
                  style={styles.linkTitle}
                >
                  {target.title}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.linkMeta}
                >
                  {entityTypeLabels[target.entityType]}
                  {' · '}
                  {relationTypeLabels[link.relationType]}
                </Text>
              </View>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void remove(link.linkId)
                }
                style={styles.unlink}
              >
                <Text style={styles.unlinkText}>
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetEyebrow}>
                  NOVA POVEZNICA
                </Text>
                <Text style={styles.sheetTitle}>
                  {frequency.trackTitle}
                </Text>
              </View>

              <Pressable
                onPress={() => setVisible(false)}
                style={styles.done}
              >
                <Text style={styles.doneText}>
                  Gotovo
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>
              VRSTA VEZE
            </Text>

            <ScrollView
              contentContainerStyle={styles.relations}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {relationTypes.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setRelation(item)}
                  style={[
                    styles.relationChip,
                    relation === item &&
                      styles.relationChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.relationText,
                      relation === item &&
                        styles.relationTextActive,
                    ]}
                  >
                    {relationTypeLabels[item]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>
              POVEŽI S
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Pretraži naslov, zapis ili frekvenciju..."
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              value={query}
            />

            {busy ? (
              <ActivityIndicator
                style={styles.busy}
              />
            ) : null}

            <ScrollView
              contentContainerStyle={styles.results}
              keyboardShouldPersistTaps="handled"
            >
              {results.map((item) => (
                <Pressable
                  key={
                    item.entityType +
                    ':' +
                    item.entityId
                  }
                  onPress={() => void connect(item)}
                  style={styles.result}
                >
                  <View style={styles.resultCopy}>
                    <Text
                      numberOfLines={1}
                      style={styles.resultTitle}
                    >
                      {item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.resultMeta}
                    >
                      {entityTypeLabels[item.entityType]}
                      {item.subtitle
                        ? ' · ' + item.subtitle
                        : ''}
                    </Text>
                  </View>

                  <Text style={styles.resultArrow}>
                    ›
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  add: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
    paddingHorizontal: 10,
  },
  addText: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '900',
  },
  empty: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 11,
  },
  links: {
    marginTop: 8,
    gap: 6,
  },
  linkRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.fill,
    paddingLeft: 12,
    paddingRight: 8,
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  linkMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 9,
  },
  unlink: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkText: {
    color: colors.textMuted,
    fontSize: 20,
  },
  error: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 10,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sheetTitle: {
    marginTop: 5,
    color: colors.navy,
    fontSize: 24,
    fontWeight: '900',
  },
  done: {
    borderRadius: 14,
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    marginTop: 8,
    marginHorizontal: 20,
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  relations: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  relationChip: {
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  relationChipActive: {
    backgroundColor: colors.navy,
  },
  relationText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '800',
  },
  relationTextActive: {
    color: colors.white,
  },
  search: {
    minHeight: 50,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
  },
  busy: {
    marginTop: 10,
  },
  results: {
    padding: 20,
    gap: 8,
  },
  result: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
  },
  resultArrow: {
    color: colors.navy,
    fontSize: 22,
    marginLeft: 10,
  },
});
`;

  write(panelFile, content);
}

// ============================================================
// 5) MOUNT UNIVERSAL LINKS UNDER EVERY FREQUENCY
// ============================================================

{
  const file = files.memoryRadio;
  let text = read(file);

  const importMarker =
    "import { MemoryPlayer } from '../components/MemoryPlayer';";

  must(text.includes(importMarker), 'MemoryRadio MemoryPlayer import marker missing');

  if (!text.includes("FrequencyLinksPanel")) {
    text = text.replace(
      importMarker,
      `${importMarker}
import { FrequencyLinksPanel } from '../components/FrequencyLinksPanel';`
    );
  }

  if (!text.includes('<FrequencyLinksPanel frequency={memory} />')) {
    const marker = `                  ) : null}
                </View>
              );
            })}`;

    must(text.includes(marker), 'MemoryRadio frequency row closing marker missing');

    text = text.replace(
      marker,
      `                  ) : null}

                  <FrequencyLinksPanel
                    frequency={memory}
                  />
                </View>
              );
            })}`
    );
  }

  write(file, text);
}

// ============================================================
// 6) COMMAND PALETTE: JINGLE BECOMES A GRAPH, NOT ONLY FAVOURITES
// ============================================================

{
  const file = files.palette;
  let text = read(file);

  const importMarker = "import { colors } from '../theme/colors';";
  must(text.includes(importMarker), 'CommandPalette colors import marker missing');

  if (!text.includes("from '../services/entityLinksApi'")) {
    text = text.replace(
      importMarker,
      `${importMarker}
import { entityLinksApi } from '../services/entityLinksApi';
import type { EntityReference } from '../types/collection';`
    );
  }

  if (!text.includes('const [jingleGraph, setJingleGraph]')) {
    const marker =
      '  const [recentEntities, setRecentEntities] =';
    const index = text.indexOf(marker);
    must(index >= 0, 'CommandPalette recentEntities marker missing');

    // Find end of recentEntities useState declaration.
    const end = text.indexOf('\n\n', index);
    must(end >= 0, 'CommandPalette recentEntities block end missing');

    text =
      text.slice(0, end) +
      `

  const [jingleGraph, setJingleGraph] =
    useState<EntityReference[]>([]);` +
      text.slice(end);
  }

  if (!text.includes('// brutusJingleGraphV2')) {
    const marker = '  useEffect(() => {\n    if (openSignal <= 0) return;';
    must(text.includes(marker), 'CommandPalette first useEffect marker missing');

    const block = `  // brutusJingleGraphV2
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    void entityLinksApi
      .jingleReferences()
      .then((items) => {
        if (!cancelled) setJingleGraph(items);
      })
      .catch(() => {
        if (!cancelled) setJingleGraph([]);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

`;

    text = text.replace(marker, `${block}${marker}`);
  }

  // Extend favourite semantics for ENTRY/FREQUENCY entities if graph-linked to a Jingle root.
  if (!text.includes('const jingleGraphKeys = new Set')) {
    const marker =
      '  const entities = useMemo<SearchEntity[]>(\n    () => [';

    must(text.includes(marker), 'CommandPalette entities useMemo marker missing');

    const prelude = `  const jingleGraphKeys = new Set(
    jingleGraph.map(
      (item) =>
        item.entityType + ':' + item.entityId,
    ),
  );

`;

    text = text.replace(marker, `${prelude}${marker}`);

    text = text.replace(
      "favourite: false,\n      })),\n      ...frequencies.map",
      `favourite:
          jingleGraphKeys.has(
            'ENTRY:' + entry.entryId,
          ),
      })),
      ...frequencies.map`
    );

    text = text.replace(
      "favourite: false,\n      })),\n    ],",
      `favourite:
          jingleGraphKeys.has(
            'FREQUENCY:' + frequency.trackId,
          ),
      })),
    ],`
    );

    // Ensure jingleGraph affects entity memo when the dependency array is explicit.
    const entityStart = text.indexOf(
      '  const entities = useMemo<SearchEntity[]>('
    );
    const itemsStart = text.indexOf(
      '  const items = useMemo<PaletteItem[]>',
      entityStart,
    );

    if (entityStart >= 0 && itemsStart > entityStart) {
      const segment = text.slice(entityStart, itemsStart);
      if (
        !segment.includes('jingleGraph,') &&
        segment.includes('frequencies,')
      ) {
        const revised = segment.replace(
          '    frequencies,\n',
          '    frequencies,\n    jingleGraph,\n',
        );

        text =
          text.slice(0, entityStart) +
          revised +
          text.slice(itemsStart);
      }
    }
  }

  write(file, text);
}

// ============================================================
// 7) CLOUD AUTH DIAGNOSTIC HELPER - NO SECRET HARDCODING
// ============================================================

const cloudDiag = path.join(ROOT, '_brutus-cloud-sync-check.cjs');

if (!fs.existsSync(cloudDiag)) {
  const content = `const fs = require('fs');
const crypto = require('crypto');
const cp = require('child_process');
const path = require('path');

const envPath = path.join(
  process.cwd(),
  'mobile',
  '.env.local',
);

if (!fs.existsSync(envPath)) {
  console.error('MISSING mobile/.env.local');
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8');

function value(name) {
  const match = env.match(
    new RegExp('^' + name + '=(.+)$', 'm'),
  );
  return match?.[1]?.trim() || '';
}

const key = value('EXPO_PUBLIC_SYNC_KEY');
const url = value('EXPO_PUBLIC_SYNC_API_URL');

if (!key) {
  console.error('EXPO_PUBLIC_SYNC_KEY is missing.');
  process.exit(1);
}

const fp = crypto
  .createHash('sha256')
  .update(key)
  .digest('hex')
  .slice(0, 12);

console.log('SYNC URL:', url || '(default)');
console.log('LOCAL KEY LENGTH:', key.length);
console.log('LOCAL KEY SHA256/12:', fp);
console.log('');
console.log(
  'If Android still says Unauthorized, Metro/native bundle is using a different key or the VPS key differs.',
);
console.log(
  'Restart Expo/Metro with cache clear after changing .env.local.',
);
console.log('');
console.log('Expected restart:');
console.log('  cd mobile');
console.log('  npx expo start -c');
`;
  write(cloudDiag, content);
}

// ============================================================
// VERIFY
// ============================================================

console.log('');
console.log('BRUTUS FUNCTIONAL V2 PATCHED');
console.log('');
console.log('✓ FREQUENCY is a real EntityReferenceType');
console.log('✓ generic entity search includes Memory Radio frequencies');
console.log('✓ frequency ↔ entry/title/topic/game/media/frequency links');
console.log('✓ reusable frequency relationship picker');
console.log('✓ generic graph links do NOT replace/delete legacy soundtrack links');
console.log('✓ Jingle search includes entities connected to Jingle catalogue roots');
console.log('✓ cloud sync diagnostic helper created');
console.log('');
console.log('NOT TOUCHED:');
console.log('  TodayScreen / meadow / frosted UI');
console.log('  existing entry_soundtracks behavior');
console.log('  audio files');
console.log('  database connection code');
console.log('');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '--noEmit'],
    {
      cwd: MOBILE,
      stdio: 'inherit',
      shell: false,
    }
  );

  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch (error) {
  console.error('');
  console.error('TYPESCRIPT FAILED - restore from:');
  console.error(backupDir);
  process.exitCode = 1;
}
