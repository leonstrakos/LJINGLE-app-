import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gameApi } from '../games/services/gameApi';
import type { GameResponse } from '../games/types/game';
import { bookApi } from '../services/bookApi';
import { mediaApi } from '../services/mediaApi';
import { colors } from '../theme/colors';
import type { BookResponse } from '../types/book';
import type { MediaResponse } from '../types/media';

type Props = {
  navigation: any;
  openSignal?: number;
};

type SearchEntity = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME';
  id: string;
  title: string;
  typeLabel: string;
  meta: string;
  favourite: boolean;
};

type PaletteCommand = {
  key: string;
  label: string;
  detail: string;
  aliases: string;
  action: () => void;
};

type PaletteItem =
  | {
      itemType: 'command';
      command: PaletteCommand;
    }
  | {
      itemType: 'entity';
      entity: SearchEntity;
    };

function normalize(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// commandPaletteRecentsV2
const RECENT_SEARCHES_KEY = 'tracking_command_palette_recent_searches';
const RECENT_ITEMS_KEY = 'tracking_command_palette_recent_items';

function readStoredArray<T>(key: string): T[] {
  if (Platform.OS !== 'web') return [];

  try {
    const raw = (globalThis as any).localStorage?.getItem(key);

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredArray(
  key: string,
  value: unknown[],
) {
  if (Platform.OS !== 'web') return;

  try {
    (globalThis as any).localStorage?.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Recents are optional; palette must keep working.
  }
}

export function CommandPalette({
  navigation,
  openSignal = 0,
}: Props) {
  // commandPaletteV1
  // commandPalettePeekGestureV1
  const inputRef = useRef<TextInput>(null);

  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [media, setMedia] = useState<MediaResponse[]>([]);
  const [games, setGames] = useState<GameResponse[]>([]);

  const [loading, setLoading] = useState(false);

  const [recentSearches, setRecentSearches] =
    useState<string[]>([]);

  const [recentEntities, setRecentEntities] =
    useState<SearchEntity[]>([]);

  useEffect(() => {
    if (openSignal <= 0) return;

    setVisible(true);
  }, [openSignal]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    setRecentSearches(
      readStoredArray<string>(RECENT_SEARCHES_KEY)
        .slice(0, 4)
    );

    setRecentEntities(
      readStoredArray<SearchEntity>(RECENT_ITEMS_KEY)
        .slice(0, 5)
    );
  }, []);

  const rememberSearch = (value: string) => {
    const clean = value.trim();

    if (!clean) return;

    setRecentSearches((current) => {
      const next = [
        clean,
        ...current.filter(
          (item) =>
            normalize(item) !== normalize(clean)
        ),
      ].slice(0, 4);

      writeStoredArray(
        RECENT_SEARCHES_KEY,
        next,
      );

      return next;
    });
  };

  const rememberEntity = (
    entity: SearchEntity,
  ) => {
    setRecentEntities((current) => {
      const next = [
        entity,
        ...current.filter(
          (item) => item.key !== entity.key
        ),
      ].slice(0, 5);

      writeStoredArray(
        RECENT_ITEMS_KEY,
        next,
      );

      return next;
    });
  };

  const close = () => {
    setVisible(false);
    setQuery('');
    setSelectedIndex(0);
  };

  const navigate = (
    route: string,
    params?: unknown,
  ) => {
    if (!navigation?.isReady?.()) return;

    if (params === undefined) {
      navigation.navigate(route);
    } else {
      navigation.navigate(route, params);
    }

    close();
  };

  const openEntity = (entity: SearchEntity) => {
    rememberEntity(entity);
    rememberSearch(query);

    if (entity.kind === 'BOOK') {
      navigate('BookDetails', {
        bookId: entity.id,
      });
      return;
    }

    if (entity.kind === 'MEDIA') {
      navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: entity.id,
        },
      });
      return;
    }

    navigate('Games', {
      screen: 'GameDetails',
      params: {
        gameId: entity.id,
      },
    });
  };

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        key: 'catalogue',
        label: 'Katalog',
        detail: 'Otvori cijeli katalog',
        aliases: 'catalogue katalog library biblioteka',
        action: () => navigate('Catalogue'),
      },
      {
        key: 'new-entry',
        label: 'Novi zapis',
        detail: 'Dodaj novi zapis',
        aliases: 'zapis entry note dodaj novi',
        action: () => navigate('EntryForm'),
      },
      {
        key: 'today',
        label: 'Danas / Timeri',
        detail: 'Vrati se na početni ekran i aktivnosti',
        aliases: 'danas today timer activity aktivnost',
        action: () => navigate('Today'),
      },
      {
        key: 'history',
        label: 'Povijest',
        detail: 'Otvori povijest aktivnosti',
        aliases: 'history povijest sessions aktivnosti',
        action: () => navigate('History'),
      },
      {
        key: 'stats',
        label: 'Statistika',
        detail: 'Otvori statistiku',
        aliases: 'stats statistics statistika',
        action: () => navigate('Stats'),
      },
      {
        key: 'radio',
        label: 'Memory Radio',
        detail: 'Otvori Memory Radio',
        aliases: 'radio memory audio glazba',
        action: () => navigate('MemoryRadio'),
      },
      {
        key: 'settings',
        label: 'Postavke',
        detail: 'Izgled, boje i postavke',
        aliases: 'settings postavke theme tema izgled',
        action: () => navigate('ThemePicker'),
      },
      {
        key: 'jingle',
        label: 'Jingle',
        detail: 'Prikaži sve Jingle naslove',
        aliases: 'jingle favourite favorite bell zvono',
        action: () => {
          setQuery('jingle');
          setSelectedIndex(0);
        },
      },
    ],
    [navigation],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const target = globalThis as any;

    const onKeyDown = (event: any) => {
      const key = String(event.key ?? '').toLocaleLowerCase();

      if (
        (event.ctrlKey || event.metaKey) &&
        key === 'k'
      ) {
        event.preventDefault();
        setVisible((current) => !current);
        return;
      }

      if (!visible) return;

      if (key === 'escape') {
        event.preventDefault();
        close();
      }
    };

    target.addEventListener?.('keydown', onKeyDown);

    return () => {
      target.removeEventListener?.('keydown', onKeyDown);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    setLoading(true);

    Promise.all([
      bookApi.getAll(),
      mediaApi.getAll(),
      gameApi.getAll(),
    ])
      .then(([loadedBooks, loadedMedia, loadedGames]) => {
        if (cancelled) return;

        setBooks(loadedBooks);
        setMedia(loadedMedia);
        setGames(loadedGames);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const entities = useMemo<SearchEntity[]>(
    () => [
      ...books.map((book) => ({
        key: 'BOOK:' + book.bookId,
        kind: 'BOOK' as const,
        id: book.bookId,
        title: book.title,
        typeLabel: 'Knjiga',
        meta: [
          book.author,
          book.publishedYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(book.favourite),
      })),

      ...media.map((item) => ({
        key: 'MEDIA:' + item.mediaId,
        kind: 'MEDIA' as const,
        id: item.mediaId,
        title: item.title,
        typeLabel:
          item.mediaType === 'MOVIE'
            ? 'Film'
            : 'Serija',
        meta: [
          item.originalTitle &&
          item.originalTitle !== item.title
            ? item.originalTitle
            : null,
          item.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(item.favourite),
      })),

      ...games.map((game) => ({
        key: 'GAME:' + game.gameId,
        kind: 'GAME' as const,
        id: game.gameId,
        title: game.title,
        typeLabel: 'Igra',
        meta: [
          game.platform,
          game.developer,
          game.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(game.favourite),
      })),
    ],
    [books, games, media],
  );

  const items = useMemo<PaletteItem[]>(() => {
    const normalizedQuery = normalize(query.trim());

    if (normalizedQuery.length === 0) {
      const recentSearchCommands =
        recentSearches.map(
          (value): PaletteCommand => ({
            key: 'recent-search:' + value,
            label: value,
            detail: 'Nedavna pretraga',
            aliases: value,
            action: () => {
              setQuery(value);
              setSelectedIndex(0);
            },
          }),
        );

      return [
        ...recentEntities.map(
          (entity): PaletteItem => ({
            itemType: 'entity',
            entity,
          }),
        ),

        ...recentSearchCommands.map(
          (command): PaletteItem => ({
            itemType: 'command',
            command,
          }),
        ),

        ...commands.map(
          (command): PaletteItem => ({
            itemType: 'command',
            command,
          }),
        ),
      ];
    }
    const tokens = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    const jingleOnly = tokens.includes('jingle');

    const textTerms = tokens.filter(
      (token) => token !== 'jingle'
    );

    const commandResults =
      commands.filter((command) => {
            const haystack = normalize(
              command.label +
                ' ' +
                command.detail +
                ' ' +
                command.aliases
            );

            return textTerms.length > 0
              ? textTerms.every((term) =>
                  haystack.includes(term)
                )
              : false;
          });

    const entityResults =
      entities
            .filter((entity) => {
              if (
                jingleOnly &&
                !entity.favourite
              ) {
                return false;
              }

              if (textTerms.length === 0) {
                return true;
              }

              const haystack = normalize(
                [
                  entity.title,
                  entity.typeLabel,
                  entity.meta,
                ].join(' ')
              );

              return textTerms.every((term) =>
                haystack.includes(term)
              );
            })
            .slice(0, 20);

    return [
      ...commandResults.map(
        (command): PaletteItem => ({
          itemType: 'command',
          command,
        })
      ),
      ...entityResults.map(
        (entity): PaletteItem => ({
          itemType: 'entity',
          entity,
        })
      ),
    ];
  }, [
    commands,
    entities,
    query,
    recentEntities,
    recentSearches,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const target = globalThis as any;

    const onKeyDown = (event: any) => {
      const key = String(event.key ?? '').toLocaleLowerCase();

      if (key === 'arrowdown') {
        event.preventDefault();

        setSelectedIndex((current) =>
          items.length === 0
            ? 0
            : (current + 1) % items.length
        );

        return;
      }

      if (key === 'arrowup') {
        event.preventDefault();

        setSelectedIndex((current) =>
          items.length === 0
            ? 0
            : (current - 1 + items.length) %
              items.length
        );

        return;
      }

      if (key === 'enter') {
        const item = items[selectedIndex];

        if (!item) return;

        event.preventDefault();

        if (item.itemType === 'command') {
          rememberSearch(query);
          item.command.action();
        } else {
          openEntity(item.entity);
        }
      }
    };

    target.addEventListener?.('keydown', onKeyDown);

    return () => {
      target.removeEventListener?.('keydown', onKeyDown);
    };
  }, [items, selectedIndex, visible]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Zatvori command palette"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.palette}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>
              ⌕
            </Text>

            <TextInput
              ref={inputRef}
              accessibilityLabel="Pretraži ili pokreni naredbu"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Pretraži ili pokreni naredbu..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={query}
            />

            {Platform.OS === 'web' ? (
              <View style={styles.shortcut}>
                <Text style={styles.shortcutText}>
                  ESC
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.results}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  color={colors.textMuted}
                  size="small"
                />
                <Text style={styles.loadingText}>
                  Učitavam katalog...
                </Text>
              </View>
            ) : items.length === 0 ? (
              <Text style={styles.empty}>
                Nema rezultata.
              </Text>
            ) : (
              items.map((item, index) => {
                const selected =
                  selectedIndex === index;

                if (item.itemType === 'command') {
                  return (
                    <Pressable
                      key={'command:' + item.command.key}
                      accessibilityRole="button"
                      onPress={() => {
                        rememberSearch(query);
                        item.command.action();
                      }}
                      onHoverIn={() =>
                        setSelectedIndex(index)
                      }
                      style={[
                        styles.row,
                        selected && styles.rowSelected,
                      ]}
                    >
                      <View style={styles.commandMark}>
                        <Text style={styles.commandMarkText}>
                          ›
                        </Text>
                      </View>

                      <View style={styles.copy}>
                        <Text style={styles.title}>
                          {item.command.label}
                        </Text>

                        <Text style={styles.meta}>
                          {item.command.detail}
                        </Text>
                      </View>

                      <Text style={styles.kind}>
                        NAREDBA
                      </Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={item.entity.key}
                    accessibilityRole="button"
                    onPress={() =>
                      openEntity(item.entity)
                    }
                    onHoverIn={() =>
                      setSelectedIndex(index)
                    }
                    style={[
                      styles.row,
                      selected && styles.rowSelected,
                    ]}
                  >
                    <View style={styles.copy}>
                      <Text
                        numberOfLines={1}
                        style={styles.title}
                      >
                        {item.entity.title}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={styles.meta}
                      >
                        {item.entity.meta ||
                          item.entity.typeLabel}
                      </Text>
                    </View>

                    {item.entity.favourite ? (
                      <Text style={styles.jingle}>
                        ♫
                      </Text>
                    ) : null}

                    <Text style={styles.kind}>
                      {query.trim()
                        ? item.entity.typeLabel.toLocaleUpperCase()
                        : 'NEDAVNO · ' +
                          item.entity.typeLabel.toLocaleUpperCase()}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {Platform.OS === 'web' ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                ↑ ↓ odabir
              </Text>

              <Text style={styles.footerText}>
                ENTER otvori
              </Text>

              <Text style={styles.footerText}>
                ESC zatvori
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop:
      Platform.OS === 'web'
        ? 92
        : 54,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },

  palette: {
    width: '100%',
    maxWidth: 650,
    maxHeight:
      Platform.OS === 'web'
        ? 590
        : '82%',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  searchRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },

  searchIcon: {
    color: colors.textMuted,
    fontSize: 23,
    marginRight: 10,
  },

  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    paddingVertical: 14,
  },

  shortcut: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.fill,
  },

  shortcutText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },

  results: {
    maxHeight: 465,
    padding: 8,
  },

  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 13,
  },

  rowSelected: {
    backgroundColor: colors.fill,
  },

  commandMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fillStrong,
    marginRight: 10,
  },

  commandMarkText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  meta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },

  kind: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 10,
  },

  jingle: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 8,
  },

  loadingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },

  empty: {
    color: colors.textMuted,
    fontSize: 13,
    padding: 24,
    textAlign: 'center',
  },

  footer: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },

  footerText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
});
