const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  relations: path.join(SRC, 'components', 'EntityRelationsPanel.tsx'),
  collection: path.join(SRC, 'screens', 'CollectionDetailsScreen.tsx'),
  radio: path.join(SRC, 'screens', 'MemoryRadioScreen.tsx'),
  navigation: path.join(SRC, 'types', 'navigation.ts'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' + name + ': ' + path.relative(ROOT, file),
    );
  }
}

const playlistFile = path.join(
  SRC,
  'components',
  'FrequencyCollectionsPanel.tsx',
);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'collections-playlists-nav-v1-' + stamp,
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
  if (fs.existsSync(file)) {
    fs.copyFileSync(
      file,
      path.join(backupDir, path.basename(file)),
    );
  }
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

function insertStyleBefore(text, anchor, source) {
  const marker = '  ' + anchor + ':';
  const index = text.indexOf(marker);

  if (index < 0) {
    fail('style anchor missing: ' + anchor);
  }

  return (
    text.slice(0, index) +
    source +
    text.slice(index)
  );
}

for (const file of Object.values(files)) backup(file);
backup(playlistFile);

// ============================================================================
// A) Generic Link composer — compact the giant empty middle area.
// ============================================================================

{
  let text = read(files.relations);

  text = text.replace(
    /linkComposer:\s*\{\s*flex:\s*1,\s*padding:\s*16\s*\},/,
    "linkComposer: { padding: 16, paddingBottom: 24 },",
  );

  text = text.replace(
    /referenceScroller:\s*\{\s*maxHeight:\s*280,\s*marginTop:\s*8\s*\},/,
    "referenceScroller: { maxHeight: 170, marginTop: 8, flexGrow: 0 },",
  );

  text = text.replace(
    /saveLink:\s*\{\s*minHeight:\s*51,\s*marginTop:\s*18,/,
    "saveLink: { minHeight: 48, marginTop: 13,",
  );

  if (!text.includes('// compactConnectionsComposerV1')) {
    const marker = 'export function EntityRelationsPanel';

    if (!text.includes(marker)) {
      fail('EntityRelationsPanel export marker missing');
    }

    text = text.replace(
      marker,
      '// compactConnectionsComposerV1\n' + marker,
    );
  }

  write(files.relations, text);
}

// ============================================================================
// B) Collection items should OPEN their actual entity.
//    The × remains only "remove from this collection".
// ============================================================================

{
  let text = read(files.collection);

  if (!text.includes('const openCollectionItem =')) {
    const anchor = '  const remove = async';

    const index = text.indexOf(anchor);

    if (index < 0) {
      fail('CollectionDetails remove handler anchor missing');
    }

    const helper = `  const openCollectionItem = (
    item: CollectionDetail['items'][number],
  ) => {
    const rootNavigation = navigation as unknown as {
      navigate: (
        screen: string,
        params?: unknown,
      ) => void;
    };

    switch (item.entityType) {
      case 'BOOK':
        rootNavigation.navigate('BookDetails', {
          bookId: item.entityId,
        });
        return;

      case 'TOPIC':
        rootNavigation.navigate('TopicDetails', {
          topicId: item.entityId,
        });
        return;

      case 'ENTRY':
        rootNavigation.navigate('EntryForm', {
          entryId: item.entityId,
        });
        return;

      case 'GAME':
        rootNavigation.navigate('Games', {
          screen: 'GameDetails',
          params: { gameId: item.entityId },
        });
        return;

      case 'MEDIA':
        rootNavigation.navigate('Media', {
          screen: 'MediaDetails',
          params: { mediaId: item.entityId },
        });
        return;

      case 'FREQUENCY':
        rootNavigation.navigate('MemoryRadio', {
          trackId: item.entityId,
        });
        return;

      default:
        return;
    }
  };

`;

    text =
      text.slice(0, index) +
      helper +
      text.slice(index);
  }

  if (!text.includes('styles.itemOpen')) {
    const pattern =
      /(<View style=\{styles\.itemCard\}>\s*)([\s\S]*?)(\s*<Pressable\s+disabled=\{busyId === item\.itemId\})/;

    const match = pattern.exec(text);

    if (!match) {
      fail('CollectionDetails itemCard render shape changed');
    }

    const replacement =
      match[1] +
      `<Pressable
              accessibilityRole="button"
              onPress={() => openCollectionItem(item)}
              style={({ pressed }) => [
                styles.itemOpen,
                pressed && styles.pressed,
              ]}
            >
` +
      match[2] +
      `
            </Pressable>` +
      match[3];

    text = text.replace(pattern, replacement);
  }

  if (!text.includes('  itemOpen:')) {
    text = insertStyleBefore(
      text,
      'typeBadge',
      `  itemOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
`,
    );
  }

  write(files.collection, text);
}

// ============================================================================
// C) MemoryRadio route can target one frequency from a Collection.
// ============================================================================

{
  let text = read(files.navigation);

  if (text.includes('  MemoryRadio: undefined;')) {
    text = text.replace(
      '  MemoryRadio: undefined;',
      "  MemoryRadio: { trackId?: string } | undefined;",
    );
  }

  write(files.navigation, text);
}

{
  let text = read(files.radio);

  if (!text.includes('useRoute')) {
    const focusImport =
      "import { useFocusEffect } from '@react-navigation/native';";

    if (text.includes(focusImport)) {
      text = text.replace(
        focusImport,
        "import { useFocusEffect, useRoute } from '@react-navigation/native';",
      );
    } else {
      const safeImport =
        "import { SafeAreaView } from 'react-native-safe-area-context';";

      if (!text.includes(safeImport)) {
        fail('MemoryRadio navigation import anchor missing');
      }

      text = text.replace(
        safeImport,
        "import { useRoute } from '@react-navigation/native';\n" +
          safeImport,
      );
    }
  }

  if (!text.includes('const requestedTrackId =')) {
    const audioAnchor = '  const audio = useMemoryAudio();';

    if (!text.includes(audioAnchor)) {
      fail('MemoryRadio audio anchor missing');
    }

    text = text.replace(
      audioAnchor,
      `${audioAnchor}
  const route = useRoute();
  const requestedTrackId = (
    route.params as
      | { trackId?: string }
      | undefined
  )?.trackId;
  const radioScrollRef = useRef<ScrollView>(null);
  const frequencyRowY =
    useRef<Record<string, number>>({});`,
    );
  }

  if (
    !text.includes('ref={radioScrollRef}') &&
    text.includes(
      '<ScrollView contentContainerStyle={styles.content}',
    )
  ) {
    text = text.replace(
      '<ScrollView contentContainerStyle={styles.content}',
      '<ScrollView ref={radioScrollRef} contentContainerStyle={styles.content}',
    );
  }

  if (!text.includes('frequencyRowY.current[memory.trackId]')) {
    const rowAnchor =
      '<View key={memory.trackId} style={styles.memoryRow}>';

    if (!text.includes(rowAnchor)) {
      fail('MemoryRadio memoryRow JSX anchor missing');
    }

    text = text.replace(
      rowAnchor,
      `<View
                    key={memory.trackId}
                    onLayout={(event) => {
                      const y =
                        event.nativeEvent.layout.y;

                      frequencyRowY.current[
                        memory.trackId
                      ] = y;

                      if (
                        requestedTrackId ===
                        memory.trackId
                      ) {
                        setTimeout(() => {
                          radioScrollRef.current?.scrollTo({
                            y: Math.max(0, y - 24),
                            animated: false,
                          });
                        }, 0);
                      }
                    }}
                    style={[
                      styles.memoryRow,
                      requestedTrackId === memory.trackId &&
                        styles.memoryRowFocused,
                    ]}
                  >`,
    );
  }

  if (!text.includes('  memoryRowFocused:')) {
    const marker = '  memoryRowCopy:';

    text = insertStyleBefore(
      text,
      'memoryRowCopy',
      `  memoryRowFocused: {
    borderColor: colors.black,
    borderWidth: 1.5,
  },
`,
    );
  }

  write(files.radio, text);
}

// ============================================================================
// D) Collections become lightweight Memory Radio playlists.
//    Only collections that currently contain frequencies are shown.
//    Disconnect removes membership only; audio remains.
// ============================================================================

const playlistSource = `import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
import type { MemoryTrack } from '../types/memoryRadio';

type Props = {
  memories: MemoryTrack[];
  onPlay: (
    memory: MemoryTrack,
  ) => void | Promise<void>;
};

type PlaylistItem = {
  itemId: string;
  memory: MemoryTrack;
};

type PlaylistGroup = {
  collectionId: string;
  name: string;
  items: PlaylistItem[];
};

export function FrequencyCollectionsPanel({
  memories,
  onPlay,
}: Props) {
  const [groups, setGroups] =
    useState<PlaylistGroup[]>([]);
  const [busyKey, setBusyKey] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    if (memories.length === 0) {
      setGroups([]);
      return;
    }

    try {
      const summaries =
        await collectionApi.getAll();

      const details = await Promise.all(
        summaries.map((summary) =>
          collectionApi.getById(
            summary.collectionId,
          ),
        ),
      );

      const byTrack = new Map(
        memories.map((memory) => [
          memory.trackId,
          memory,
        ]),
      );

      const next = details
        .map((detail) => ({
          collectionId: detail.collectionId,
          name: detail.name,
          items: detail.items.flatMap(
            (item): PlaylistItem[] => {
              if (
                item.entityType !== 'FREQUENCY'
              ) {
                return [];
              }

              const memory = byTrack.get(
                item.entityId,
              );

              return memory
                ? [
                    {
                      itemId: item.itemId,
                      memory,
                    },
                  ]
                : [];
            },
          ),
        }))
        .filter(
          (group) => group.items.length > 0,
        );

      setGroups(next);
    } catch {
      // Playlist view is secondary; do not block Memory Radio.
      setGroups([]);
    }
  }, [memories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const disconnect = async (
    collectionId: string,
    itemId: string,
  ) => {
    const key =
      collectionId + ':' + itemId;

    if (busyKey) return;

    setBusyKey(key);

    try {
      await collectionApi.removeItem(
        collectionId,
        itemId,
      );

      setGroups((current) =>
        current
          .map((group) =>
            group.collectionId ===
            collectionId
              ? {
                  ...group,
                  items: group.items.filter(
                    (item) =>
                      item.itemId !== itemId,
                  ),
                }
              : group,
          )
          .filter(
            (group) =>
              group.items.length > 0,
          ),
      );
    } finally {
      setBusyKey(null);
    }
  };

  if (groups.length === 0) return null;

  return (
    <View style={styles.root}>
      {groups.map((group) => (
        <View
          key={group.collectionId}
          style={styles.group}
        >
          <View style={styles.heading}>
            <View>
              <Text style={styles.kicker}>
                COLLECTION · PLAYLIST
              </Text>
              <Text style={styles.title}>
                {group.name}
              </Text>
            </View>

            <Text style={styles.count}>
              {group.items.length}
            </Text>
          </View>

          <View style={styles.list}>
            {group.items.map(
              ({ itemId, memory }) => {
                const key =
                  group.collectionId +
                  ':' +
                  itemId;

                return (
                  <View
                    key={itemId}
                    style={styles.row}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void onPlay(memory)
                      }
                      style={({ pressed }) => [
                        styles.open,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.copy}>
                        <Text
                          numberOfLines={1}
                          style={styles.track}
                        >
                          {memory.trackTitle}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={styles.meta}
                        >
                          {memory.artist ||
                            'Bez izvođača'}
                        </Text>
                      </View>

                      <Text style={styles.play}>
                        PLAY
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Odspoji iz kolekcije"
                      disabled={busyKey === key}
                      onPress={() =>
                        void disconnect(
                          group.collectionId,
                          itemId,
                        )
                      }
                      style={({ pressed }) => [
                        styles.detach,
                        pressed && styles.pressed,
                      ]}
                    >
                      {busyKey === key ? (
                        <ActivityIndicator
                          color={colors.textMuted}
                          size="small"
                        />
                      ) : (
                        <Text
                          style={styles.detachText}
                        >
                          ×
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              },
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 30,
  },
  group: {
    marginTop: 22,
  },
  heading: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  count: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  list: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  open: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  track: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  meta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
  },
  play: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  detach: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detachText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.68,
  },
});
`;

write(playlistFile, playlistSource);

{
  let text = read(files.radio);

  if (
    !text.includes(
      "from '../components/FrequencyCollectionsPanel'",
    )
  ) {
    const preferred =
      "import { FrequencyLinksPanel } from '../components/FrequencyLinksPanel';";

    if (text.includes(preferred)) {
      text = text.replace(
        preferred,
        preferred +
          "\nimport { FrequencyCollectionsPanel } from '../components/FrequencyCollectionsPanel';",
      );
    } else {
      const anchor =
        "import { MemoryPlayer } from '../components/MemoryPlayer';";

      if (!text.includes(anchor)) {
        fail('MemoryRadio component import anchor missing');
      }

      text = text.replace(
        anchor,
        anchor +
          "\nimport { FrequencyCollectionsPanel } from '../components/FrequencyCollectionsPanel';",
      );
    }
  }

  if (
    !text.includes(
      '<FrequencyCollectionsPanel',
    )
  ) {
    const scrollClose =
      text.lastIndexOf('</ScrollView>');

    if (scrollClose < 0) {
      fail('MemoryRadio final ScrollView closing tag missing');
    }

    const panel = `        <FrequencyCollectionsPanel
          memories={memories}
          onPlay={(memory) =>
            audio.play(memory)
          }
        />

`;

    text =
      text.slice(0, scrollClose) +
      panel +
      text.slice(scrollClose);
  }

  write(files.radio, text);
}

console.log('');
console.log('COLLECTIONS / PLAYLISTS NAV V1 INSTALLED');
console.log('✓ generic Link composer uses much less empty space');
console.log('✓ collection item body now opens the actual item');
console.log('✓ collection × still only removes membership');
console.log('✓ books/topics/notes open directly');
console.log('✓ games/media open their nested details');
console.log('✓ frequencies open Memory Radio and scroll to the target row');
console.log('✓ Memory Radio now shows non-empty frequency collections as playlists');
console.log('✓ playlist × disconnects only from that collection');
console.log('✓ empty frequency playlists disappear automatically');
console.log('✓ audio/frequency itself is never deleted by playlist disconnect');
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
