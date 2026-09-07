import { useCallback, useState } from 'react';
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
    queue: MemoryTrack[],
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
  // ljingleOnboardingPlayerV1: a Collection's Frequency order is its queue.
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
                        void onPlay(
                          memory,
                          group.items.map((item) => item.memory),
                        )
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
