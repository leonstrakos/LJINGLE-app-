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
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activityApi } from '../services/activityApi';
import { entityLinksApi } from '../services/entityLinksApi';
import { colors } from '../theme/colors';
import type { ActivityTimerResponse } from '../types/activity';
import {
  entityTypeLabels,
  type EntityReference,
} from '../types/collection';
import {
  formatDuration,
  getActiveSessionSeconds,
} from '../utils/activityTime';
import { semanticFeedback } from '../utils/semanticFeedback';

export function GlobalTimerCard() {
  const [timer, setTimer] =
    useState<ActivityTimerResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [linkSessionId, setLinkSessionId] =
    useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] =
    useState<EntityReference[]>([]);
  const [searching, setSearching] =
    useState(false);
  const [linkedKeys, setLinkedKeys] =
    useState<Set<string>>(new Set());
  const [error, setError] =
    useState<string | null>(null);

  const load = async () => {
    try {
      setTimer(await activityApi.getGlobal());
    } catch {
      // Today itself remains usable.
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!timer?.running) return undefined;

    const interval = setInterval(
      () => setNow(Date.now()),
      1000,
    );

    return () => clearInterval(interval);
  }, [timer?.running]);

  useEffect(() => {
    if (!linkSessionId || query.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);

      void entityLinksApi
        .searchReferences(query.trim())
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [linkSessionId, query]);

  const liveSeconds = useMemo(
    () =>
      timer
        ? getActiveSessionSeconds(timer, now)
        : 0,
    [now, timer],
  );

  const toggle = async () => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      if (timer?.running) {
        const stopped =
          await activityApi.stopGlobal();

        setTimer(stopped.timer);
        void semanticFeedback.timerStop();

        if (stopped.sessionId) {
          setLinkedKeys(new Set());
          setQuery('');
          setResults([]);
          setLinkSessionId(
            stopped.sessionId,
          );
        }
      } else {
        const started =
          await activityApi.startGlobal();

        setTimer(started);
        setNow(Date.now());
        void semanticFeedback.timerStart();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Timer nije promijenjen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const link = async (
    reference: EntityReference,
  ) => {
    if (!linkSessionId) return;

    const key =
      reference.entityType +
      ':' +
      reference.entityId;

    if (linkedKeys.has(key)) return;

    setSearching(true);
    setError(null);

    try {
      await activityApi.addSessionContext(
        linkSessionId,
        reference.entityType,
        reference.entityId,
      );

      setLinkedKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Poveznica nije spremljena.',
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>
            GLOBAL TIMER
          </Text>

          <Text style={styles.title}>
            {timer?.running
              ? 'Mjeri sada'
              : 'Pokreni bez setupa'}
          </Text>

          <Text style={styles.time}>
            {formatDuration(liveSeconds)}
          </Text>

          <Text style={styles.hint}>
            Nakon Stop možeš ga povezati s bilo čim — ili preskočiti.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void toggle()}
          style={({ pressed }) => [
            styles.action,
            timer?.running &&
              styles.actionRunning,
            pressed &&
              !busy &&
              styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              color={colors.white}
            />
          ) : (
            <Text style={styles.actionText}>
              {timer?.running
                ? 'STOP'
                : 'START'}
            </Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() =>
          setLinkSessionId(null)
        }
        transparent
        visible={Boolean(linkSessionId)}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetEyebrow}>
                  SESIJA SPREMLJENA
                </Text>
                <Text style={styles.sheetTitle}>
                  Poveži s…
                </Text>
                <Text style={styles.sheetHint}>
                  Ovo je opcionalno. Timer je već sigurno spremljen.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setLinkSessionId(null)
                }
                style={styles.done}
              >
                <Text style={styles.doneText}>
                  Gotovo
                </Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Tema, collection, knjiga, zapis, frequency…"
              placeholderTextColor={
                colors.textMuted
              }
              style={styles.search}
              value={query}
            />

            {searching ? (
              <ActivityIndicator
                style={styles.loader}
              />
            ) : null}

            <ScrollView
              contentContainerStyle={
                styles.results
              }
              keyboardShouldPersistTaps="handled"
            >
              {results.map((item) => {
                const key =
                  item.entityType +
                  ':' +
                  item.entityId;

                const linked =
                  linkedKeys.has(key);

                return (
                  <Pressable
                    key={key}
                    disabled={linked}
                    onPress={() =>
                      void link(item)
                    }
                    style={[
                      styles.result,
                      linked &&
                        styles.resultLinked,
                    ]}
                  >
                    <View
                      style={styles.resultCopy}
                    >
                      <Text
                        numberOfLines={1}
                        style={
                          styles.resultTitle
                        }
                      >
                        {item.title}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={
                          styles.resultMeta
                        }
                      >
                        {
                          entityTypeLabels[
                            item.entityType
                          ]
                        }
                        {item.subtitle
                          ? ' · ' +
                            item.subtitle
                          : ''}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.resultAction
                      }
                    >
                      {linked ? '✓' : '+'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    marginTop: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 22,
    backgroundColor: colors.black,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#AEAEB2',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 5,
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: '900',
  },
  time: {
    marginTop: 7,
    color: colors.onAccent,
    fontSize: 31,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    marginTop: 5,
    maxWidth: 430,
    color: '#AEAEB2',
    fontSize: 10,
    lineHeight: 14,
  },
  action: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#2C2C2E',
  },
  actionRunning: {
    backgroundColor: colors.danger,
  },
  actionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
  error: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 11,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    maxHeight: '86%',
    paddingBottom: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
  },
  sheetHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  sheetCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sheetTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
  },
  sheetHint: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  done: {
    minHeight: 42,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  doneText: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '800',
  },
  search: {
    minHeight: 52,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    color: colors.text,
    fontSize: 14,
  },
  loader: {
    marginTop: 12,
  },
  results: {
    padding: 20,
    gap: 8,
  },
  result: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  resultLinked: {
    opacity: 0.56,
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
  resultAction: {
    marginLeft: 12,
    color: colors.text,
    fontSize: 21,
  },
});
