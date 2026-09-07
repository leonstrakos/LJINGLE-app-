import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { historyApi } from '../services/historyApi';
import { getSessionNotes } from '../services/sessionNotes';
import { colors } from '../theme/colors';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { activeVisualSkinId } from '../theme/visualSkins';

// forkN4CelestialArchiveVisualV12
// Classic-only celestial archive skin.
// IMPORTANT: celestial *language* is fixed, but its palette stays driven by
// ThemePicker semantic colors. Pixel + Aero (Meadow/Frutiger) stay untouched.
const n4Celestial = activeVisualSkinId === 'classic';
const N4_NIGHT = colors.background;
const N4_PANEL = colors.surface;
const N4_PANEL_RAISED = colors.fillStrong;
const N4_BLUE = colors.fill;
const N4_GOLD = colors.navy;
const N4_GOLD_SOFT = colors.goldSoft;
const N4_GOLD_LINE = colors.separator;
const N4_IVORY = colors.text;
const N4_MUTED = colors.textMuted;

import type { HistorySession } from '../types/history';

const PAGE_SIZE = 30;

function N4HistoryDust() {
  if (!n4Celestial) return null;
  return (
    <View pointerEvents="none" style={styles.n4Dust}>
      <Text style={[styles.n4DustGlyph, { left: '8%' as any, top: 52 }]}>✦</Text>
      <Text style={[styles.n4DustGlyphSmall, { right: '12%' as any, top: 104 }]}>✧</Text>
      <Text style={[styles.n4DustGlyphSmall, { left: '52%' as any, top: 190 }]}>· ✦ ·</Text>
      <View style={[styles.n4DustPoint, { left: '23%' as any, top: 138 }]} />
      <View style={[styles.n4DustPoint, { right: '26%' as any, top: 265 }]} />
    </View>
  );
}

function N4HistoryRule() {
  if (!n4Celestial) return null;
  return (
    <View style={styles.n4Rule} pointerEvents="none">
      <Text style={styles.n4RuleText}>✦</Text>
      <View style={styles.n4RuleLine} />
      <Text style={styles.n4RuleText}>✧</Text>
    </View>
  );
}


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

// forkMHistoryArchiveV1
type HistoryRow =
  | {
      kind: 'archive-title';
      key: string;
    }
  | {
      kind: 'day';
      key: string;
      title: string;
      count: number;
      archive: boolean;
    }
  | {
      kind: 'session';
      key: string;
      session: HistorySession;
      archive: boolean;
    }
  | {
      kind: 'year';
      key: string;
      year: number;
      expanded: boolean;
    }
  | {
      kind: 'month';
      key: string;
      year: number;
      month: number;
      title: string;
      expanded: boolean;
    }
  | {
      kind: 'week';
      key: string;
      year: number;
      month: number;
      weekKey: string;
      title: string;
      expanded: boolean;
    };

type ArchiveWeek = {
  key: string;
  title: string;
  sessions: HistorySession[];
};

type ArchiveMonth = {
  key: string;
  year: number;
  month: number;
  title: string;
  weeks: ArchiveWeek[];
};

type ArchiveYear = {
  key: string;
  year: number;
  months: ArchiveMonth[];
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

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function recentDayKeys(now: number) {
  const result = new Set<string>();
  const base = startOfLocalDay(new Date(now));

  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date(base);
    day.setDate(base.getDate() - offset);
    result.add(dateKey(day.toISOString()));
  }

  return result;
}

function mondayStart(value: string) {
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return null;

  const result = startOfLocalDay(source);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

function weekKey(value: string) {
  const start = mondayStart(value);
  return start ? dateKey(start.toISOString()) : value;
}

function weekTitle(value: string) {
  const start = mondayStart(value);
  if (!start) return 'Nepoznat tjedan';

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const format = (date: Date) =>
    new Intl.DateTimeFormat('hr-HR', {
      day: 'numeric',
      month: 'long',
    }).format(date);

  return `${format(start)} – ${format(end)}`;
}

function monthTitle(month: number) {
  return new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
  }).format(new Date(2020, month, 1));
}

function buildArchiveYears(
  sessions: HistorySession[],
): ArchiveYear[] {
  const years = new Map<
    number,
    Map<number, Map<string, HistorySession[]>>
  >();

  for (const session of sessions) {
    const date = new Date(session.startedAt);
    if (Number.isNaN(date.getTime())) continue;

    const year = date.getFullYear();
    const month = date.getMonth();
    const week = weekKey(session.startedAt);

    let months = years.get(year);
    if (!months) {
      months = new Map();
      years.set(year, months);
    }

    let weeks = months.get(month);
    if (!weeks) {
      weeks = new Map();
      months.set(month, weeks);
    }

    const weekSessions = weeks.get(week);
    if (weekSessions) {
      weekSessions.push(session);
    } else {
      weeks.set(week, [session]);
    }
  }

  return [...years.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, months]) => ({
      key: `year-${year}`,
      year,
      months: [...months.entries()]
        .sort(([left], [right]) => right - left)
        .map(([month, weeks]) => ({
          key: `month-${year}-${month}`,
          year,
          month,
          title: monthTitle(month),
          weeks: [...weeks.entries()]
            .sort(([left], [right]) =>
              right.localeCompare(left),
            )
            .map(([key, weekSessions]) => ({
              key,
              title: weekTitle(
                weekSessions[0]?.startedAt ?? key,
              ),
              sessions: [...weekSessions].sort(
                (left, right) =>
                  Date.parse(right.startedAt) -
                  Date.parse(left.startedAt),
              ),
            })),
        })),
    }));
}

function dayRows(
  sessions: HistorySession[],
  archive: boolean,
): HistoryRow[] {
  const groups = new Map<string, HistorySession[]>();

  for (const session of sessions) {
    const key = dateKey(session.startedAt);
    const current = groups.get(key);
    if (current) current.push(session);
    else groups.set(key, [session]);
  }

  const rows: HistoryRow[] = [];

  for (const [key, daySessions] of [...groups.entries()].sort(
    ([left], [right]) => right.localeCompare(left),
  )) {
    const sorted = [...daySessions].sort(
      (left, right) =>
        Date.parse(right.startedAt) -
        Date.parse(left.startedAt),
    );

    rows.push({
      kind: 'day',
      key: `${archive ? 'archive-' : 'recent-'}day-${key}`,
      title: dayTitle(sorted[0]?.startedAt ?? key),
      count: sorted.length,
      archive,
    });

    for (const session of sorted) {
      rows.push({
        kind: 'session',
        key: `session-${session.sessionId}`,
        session,
        archive,
      });
    }
  }

  return rows;
}

function buildHistoryRows(
  sessions: HistorySession[],
  now: number,
  expandedYears: Set<string>,
  expandedMonths: Set<string>,
  expandedWeeks: Set<string>,
): HistoryRow[] {
  const recentKeys = recentDayKeys(now);
  const recent: HistorySession[] = [];
  const archived: HistorySession[] = [];

  for (const session of sessions) {
    if (recentKeys.has(dateKey(session.startedAt))) {
      recent.push(session);
    } else {
      archived.push(session);
    }
  }

  const rows = dayRows(recent, false);
  const years = buildArchiveYears(archived);

  if (years.length === 0) return rows;

  rows.push({
    kind: 'archive-title',
    key: 'archive-title',
  });

  for (const year of years) {
    const yearExpanded = expandedYears.has(year.key);
    rows.push({
      kind: 'year',
      key: year.key,
      year: year.year,
      expanded: yearExpanded,
    });

    if (!yearExpanded) continue;

    for (const month of year.months) {
      const monthExpanded = expandedMonths.has(month.key);
      rows.push({
        kind: 'month',
        key: month.key,
        year: month.year,
        month: month.month,
        title: month.title,
        expanded: monthExpanded,
      });

      if (!monthExpanded) continue;

      for (const week of month.weeks) {
        const expanded = expandedWeeks.has(week.key);
        rows.push({
          kind: 'week',
          key: `week-row-${month.year}-${month.month}-${week.key}`,
          year: month.year,
          month: month.month,
          weekKey: week.key,
          title: week.title,
          expanded,
        });

        if (expanded) {
          rows.push(...dayRows(week.sessions, true));
        }
      }
    }
  }

  return rows;
}

function toggleSet(
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  key: string,
) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
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
      {n4Celestial ? (
        <Text style={[styles.n4SessionSigil, session.running && styles.n4SessionSigilRunning]}>✦</Text>
      ) : (
        <View style={[styles.marker, session.running && styles.markerRunning]} />
      )}
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
  const [expandedYears, setExpandedYears] =
    useState<Set<string>>(() => new Set());
  const [expandedMonths, setExpandedMonths] =
    useState<Set<string>>(() => new Set());
  const [expandedWeeks, setExpandedWeeks] =
    useState<Set<string>>(() => new Set());
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

  const rows = useMemo(
    () =>
      buildHistoryRows(
        sessions,
        now,
        expandedYears,
        expandedMonths,
        expandedWeeks,
      ),
    [
      expandedMonths,
      expandedWeeks,
      expandedYears,
      now,
      sessions,
    ],
  );

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
      <N4HistoryDust />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.kind === 'archive-title') {
            return (
              <View style={styles.archiveIntro}>
                <Text style={styles.archiveEyebrow}>ARHIVA</Text>
                <Text style={styles.archiveTitle}>Starije od 3 dana</Text>
                <Text style={styles.archiveCopy}>
                  Otvori godinu, mjesec i tjedan samo kada ti trebaju.
                </Text>
              </View>
            );
          }

          if (item.kind === 'day') {
            return (
              <View
                style={[
                  styles.sectionHeader,
                  item.archive && styles.archiveDayHeader,
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    item.archive && styles.archiveDayTitle,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.sectionCount}>{item.count}</Text>
              </View>
            );
          }

          if (item.kind === 'session') {
            return item.archive ? (
              <View style={styles.archiveSessionWrap}>
                <SessionCard now={now} session={item.session} />
              </View>
            ) : (
              <SessionCard now={now} session={item.session} />
            );
          }

          if (item.kind === 'year') {
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: item.expanded }}
                accessibilityLabel={`${item.year}., ${
                  item.expanded ? 'zatvori' : 'otvori'
                }`}
                onPress={() => toggleSet(setExpandedYears, item.key)}
                style={({ pressed }) => [
                  styles.archiveRow,
                  styles.archiveYearRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.archiveChevron}>
                  {item.expanded ? '⌄' : '›'}
                </Text>
                <Text style={styles.archiveYearText}>{item.year}</Text>
              </Pressable>
            );
          }

          if (item.kind === 'month') {
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: item.expanded }}
                accessibilityLabel={`${item.title}, ${
                  item.expanded ? 'zatvori' : 'otvori'
                }`}
                onPress={() => toggleSet(setExpandedMonths, item.key)}
                style={({ pressed }) => [
                  styles.archiveRow,
                  styles.archiveMonthRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.archiveChevron}>
                  {item.expanded ? '⌄' : '›'}
                </Text>
                <Text style={styles.archiveMonthText}>{item.title}</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: item.expanded }}
              accessibilityLabel={`Tjedan ${item.title}, ${
                item.expanded ? 'zatvori' : 'otvori'
              }`}
              onPress={() => toggleSet(setExpandedWeeks, item.weekKey)}
              style={({ pressed }) => [
                styles.archiveRow,
                styles.archiveWeekRow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.archiveChevron}>
                {item.expanded ? '⌄' : '›'}
              </Text>
              <View style={styles.archiveWeekCopy}>
                <Text style={styles.archiveWeekLabel}>TJEDAN</Text>
                <Text style={styles.archiveWeekText}>{item.title}</Text>
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <CelestialAtmosphere variant="history" />
            <Text style={styles.eyebrow}>{n4Celestial ? '' : 'Tvoje zabilježeno vrijeme'}</Text>
            <Text style={styles.heading}>Povijest</Text>
            <Text style={styles.subtitle}>
              Zadnja tri dana ostaju odmah dostupna. Starije sesije složene su u
              godinu, mjesec i tjedan. 
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

            {!loadingMore && !lastPage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadMore()}
                style={({ pressed }) => [
                  styles.loadOlderButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.loadOlderText}>Učitaj stariju povijest</Text>
              </Pressable>
            ) : null}

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
        refreshControl={
          <RefreshControl
            colors={[colors.black]}
            onRefresh={() => void loadFirstPage(true)}
            refreshing={refreshing}
            tintColor={colors.black}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // forkN4CelestialArchiveVisualV12
  n4Dust: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  n4DustGlyph: { position: 'absolute', color: N4_GOLD, fontSize: 15, opacity: 0.54 },
  n4DustGlyphSmall: { position: 'absolute', color: N4_GOLD, fontSize: 9, opacity: 0.36, letterSpacing: 3 },
  n4DustPoint: { position: 'absolute', width: 2, height: 2, borderRadius: 2, backgroundColor: N4_GOLD, opacity: 0.34 },
  n4Rule: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 360 },
  n4RuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: N4_GOLD_LINE },
  n4RuleText: { color: N4_GOLD, fontSize: 10, opacity: 0.76 },
  n4SectionStar: { marginRight: 7, color: N4_GOLD, fontSize: 9, opacity: 0.9 },
  n4SessionSigil: { width: 22, marginRight: 8, color: N4_GOLD, fontSize: 12, opacity: 0.64, textAlign: 'center' },
  n4SessionSigilRunning: { opacity: 1, fontSize: 15 },

  safeArea: {
    flex: 1,
    backgroundColor: n4Celestial ? N4_NIGHT : colors.background,
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
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  heading: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 3,
  },
  subtitle: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
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
    flex: 1,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sectionCount: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  archiveIntro: {
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 6,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  archiveEyebrow: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  archiveTitle: {
    marginTop: 4,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  archiveCopy: {
    marginTop: 5,
    maxWidth: 520,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  archiveRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  archiveYearRow: {
    marginTop: 6,
    paddingHorizontal: 8,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
    borderRadius: 14,
    borderBottomWidth: 0,
  },
  archiveMonthRow: {
    marginLeft: 18,
    paddingHorizontal: 10,
  },
  archiveWeekRow: {
    marginLeft: 38,
    paddingHorizontal: 8,
    minHeight: 54,
  },
  archiveChevron: {
    width: 24,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  archiveYearText: {
    marginLeft: 4,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  archiveMonthText: {
    marginLeft: 5,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  archiveWeekCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 5,
  },
  archiveWeekLabel: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  archiveWeekText: {
    marginTop: 2,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  archiveDayHeader: {
    marginLeft: 54,
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  archiveDayTitle: {
    fontSize: 14,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
  },
  archiveSessionWrap: {
    marginLeft: 54,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
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
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
    marginRight: 13,
  },
  markerRunning: {
    backgroundColor: n4Celestial ? N4_GOLD : colors.black,
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
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginRight: 12,
  },
  duration: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  durationRunning: {
    color: n4Celestial ? N4_GOLD : colors.black,
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 5,
  },
  sessionNote: {
    marginTop: 9,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  typeLabel: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: colors.border,
    fontSize: 12,
    marginHorizontal: 5,
  },
  timeRange: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  runningLabel: {
    color: n4Celestial ? N4_GOLD : colors.black,
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
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
  },
  stateCopy: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
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
    backgroundColor: n4Celestial ? N4_GOLD : colors.black,
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
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 38,
  },
  emptySymbol: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 36,
  },
  emptyTitle: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 13,
  },
  emptyCopy: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
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
  loadOlderButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },
  loadOlderText: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  moreError: {
    alignItems: 'center',
    padding: 10,
  },
  moreErrorText: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  moreRetry: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
