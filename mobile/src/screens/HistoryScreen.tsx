import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { historyApi } from '../services/historyApi';
import { getSessionNotes } from '../services/sessionNotes';
import { colors } from '../theme/colors';
import type { HistorySession } from '../types/history';

const PAGE_SIZE = 30;

const activityLabels: Record<string, string> = {
  READING: 'Čitanje',
  WATCHING: 'Gledanje',
  STUDYING: 'Učenje',
  PLAYING: 'Igranje',
  RESEARCH: 'Istraživanje',
  WORK: 'Rad',
  EXERCISE: 'Vježbanje',
  CUSTOM: 'Aktivnost',
};

type HistorySection = {
  key: string;
  title: string;
  data: HistorySession[];
};

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayTitle(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nepoznat datum';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = dateKey(value);
  if (key === dateKey(today.toISOString())) return 'Danas';
  if (key === dateKey(yesterday.toISOString())) return 'Jučer';

  return new Intl.DateTimeFormat('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function durationLabel(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${remainingSeconds} s`;
}

function liveDuration(session: HistorySession, now: number) {
  if (!session.running) return session.durationSeconds;
  const startedAt = Date.parse(session.startedAt);
  return Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : session.durationSeconds;
}

function groupSessions(sessions: HistorySession[]): HistorySection[] {
  const groups = new Map<string, HistorySection>();
  sessions.forEach((session) => {
    const key = dateKey(session.startedAt);
    const existing = groups.get(key);
    if (existing) {
      existing.data.push(session);
    } else {
      groups.set(key, {
        key,
        title: dayTitle(session.startedAt),
        data: [session],
      });
    }
  });
  return Array.from(groups.values());
}

async function attachSessionNotes(sessions: HistorySession[]) {
  if (sessions.length === 0) return sessions;

  const notes = await getSessionNotes(
    sessions.map((session) => session.sessionId),
  );

  return sessions.map((session) => ({
    ...session,
    note: notes[session.sessionId] ?? null,
  }));
}

type SessionCardProps = {
  session: HistorySession;
  now: number;
};

function SessionCard({ session, now }: SessionCardProps) {
  const kind = activityLabels[session.activityType] ?? session.activityType;
  const endTime = session.endedAt ? timeLabel(session.endedAt) : 'sada';

  return (
    <View style={styles.card}>
      <View style={[styles.marker, session.running && styles.markerRunning]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopLine}>
          <Text numberOfLines={1} style={styles.activityLabel}>
            {session.activityLabel}
          </Text>
          <Text style={[styles.duration, session.running && styles.durationRunning]}>
            {durationLabel(liveDuration(session, now))}
          </Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.typeLabel}>{kind}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.timeRange}>
            {timeLabel(session.startedAt)} – {endTime}
          </Text>
          {session.running ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.runningLabel}>aktivno</Text>
            </>
          ) : null}
        </View>

        {session.note ? (
          <Text style={styles.sessionNote}>{session.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function HistoryScreen() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(true);
  const [now, setNow] = useState(Date.now());
  const requestVersion = useRef(0);

  const loadFirstPage = useCallback(async (asRefresh = false) => {
    const version = ++requestVersion.current;
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const response = await historyApi.getSessions({ size: PAGE_SIZE });
      const content = await attachSessionNotes(response.content);
      if (version !== requestVersion.current) return;
      setSessions(content);
      setPage(response.page);
      setLastPage(response.last);
      setNow(Date.now());
    } catch (caught) {
      if (version !== requestVersion.current) return;
      setError(caught instanceof Error ? caught.message : 'Povijest se nije mogla učitati.');
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  useEffect(() => {
    if (!sessions.some((session) => session.running)) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessions]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || lastPage) return;
    setLoadingMore(true);
    setError(null);

    try {
      const response = await historyApi.getSessions({
        page: page + 1,
        size: PAGE_SIZE,
      });
      const content = await attachSessionNotes(response.content);
      setSessions((current) => {
        const known = new Set(current.map((session) => session.sessionId));
        return [
          ...current,
          ...content.filter((session) => !known.has(session.sessionId)),
        ];
      });
      setPage(response.page);
      setLastPage(response.last);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Starije sesije nisu učitane.');
    } finally {
      setLoadingMore(false);
    }
  }, [lastPage, loading, loadingMore, page, refreshing]);

  const sections = useMemo(() => groupSessions(sessions), [sessions]);

  if (loading && sessions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.black} size="large" />
          <Text style={styles.stateCopy}>Slažemo tvoju vremensku crtu…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.stateTitle}>Povijest se nije učitala</Text>
          <Text style={styles.stateCopy}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadFirstPage()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.sessionId}
        renderItem={({ item }) => <SessionCard now={now} session={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Tvoje zabilježeno vrijeme</Text>
            <Text style={styles.heading}>Povijest</Text>
            <Text style={styles.subtitle}>
              Kronološki trag čitanja, igranja, gledanja, istraživanja i svega čemu
              posvećuješ vrijeme.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptySymbol}>◷</Text>
            <Text style={styles.emptyTitle}>Vrijeme tek počinje</Text>
            <Text style={styles.emptyCopy}>
              Kada pokreneš prvu aktivnost, njezina će se sesija pojaviti ovdje.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? <ActivityIndicator color={colors.black} /> : null}
            {error && sessions.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadMore()}
                style={({ pressed }) => [styles.moreError, pressed && styles.pressed]}
              >
                <Text style={styles.moreErrorText}>{error}</Text>
                <Text style={styles.moreRetry}>Pokušaj ponovno</Text>
              </Pressable>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.content}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            colors={[colors.black]}
            onRefresh={() => void loadFirstPage(true)}
            refreshing={refreshing}
            tintColor={colors.black}
          />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: 6,
    paddingTop: 18,
    paddingBottom: 26,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  heading: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 520,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 9,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.fillStrong,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.separator,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  marker: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.fillStrong,
    marginRight: 13,
  },
  markerRunning: {
    backgroundColor: colors.black,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTopLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  activityLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginRight: 12,
  },
  duration: {
    color: colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  durationRunning: {
    color: colors.black,
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 5,
  },
  sessionNote: {
    marginTop: 9,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  typeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: colors.border,
    fontSize: 12,
    marginHorizontal: 5,
  },
  timeRange: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  runningLabel: {
    color: colors.black,
    fontSize: 12,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
  },
  stateCopy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  errorMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    color: colors.white,
    backgroundColor: colors.danger,
    fontSize: 28,
    lineHeight: 48,
    fontWeight: '800',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.black,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 22,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.separator,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 38,
  },
  emptySymbol: {
    color: colors.text,
    fontSize: 36,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 13,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  footer: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  moreError: {
    alignItems: 'center',
    padding: 10,
  },
  moreErrorText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  moreRetry: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
