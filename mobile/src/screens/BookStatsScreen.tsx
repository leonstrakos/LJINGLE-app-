import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { FeedbackView } from '../components/FeedbackView';
import { bookApi } from '../services/bookApi';
import { colors } from '../theme/colors';
import { readingStatusLabels, readingStatuses, type BookResponse } from '../types/book';

type MetricProps = {
  label: string;
  value: string;
  dark?: boolean;
};

function Metric({ label, value, dark = false }: MetricProps) {
  return (
    <View style={[styles.metric, dark && styles.metricDark]}>
      <Text style={[styles.metricValue, dark && styles.metricValueDark]}>{value}</Text>
      <Text style={[styles.metricLabel, dark && styles.metricLabelDark]}>{label}</Text>
    </View>
  );
}

export function BookStatsScreen() {
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setBooks(await bookApi.getAll());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat statistike nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks]),
  );

  const stats = useMemo(() => {
    const statusCounts = Object.fromEntries(
      readingStatuses.map((status) => [
        status,
        books.filter((book) => book.readingStatus === status).length,
      ]),
    ) as Record<(typeof readingStatuses)[number], number>;
    const sortedByYear = [...books].sort((left, right) => left.publishedYear - right.publishedYear);
    const yearSum = books.reduce((sum, book) => sum + book.publishedYear, 0);
    const progressSum = books.reduce((sum, book) => sum + book.progress, 0);

    return {
      total: books.length,
      statusCounts,
      favourites: books.filter((book) => book.favourite).length,
      averageProgress: books.length ? Math.round(progressSum / books.length) : 0,
      averageYear: books.length ? Math.round(yearSum / books.length) : 0,
      oldest: sortedByYear[0],
      newest: sortedByYear.at(-1),
    };
  }, [books]);

  if (loading && books.length === 0) {
    return <FeedbackView type="loading" message="Izračunavanje statistike…" />;
  }

  if (error && books.length === 0) {
    return <FeedbackView type="error" message={error} onRetry={() => void loadBooks()} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="books" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.black]}
            onRefresh={() => void loadBooks(true)}
            refreshing={refreshing}
            tintColor={colors.black}
          />
        }
      >
        <Text style={styles.eyebrow}>Pregled zbirke</Text>
        <Text style={styles.heading}>Statistika</Text>
        <Text style={styles.subtitle}>Sažetak se izračunava iz trenutačnih podataka na backendu.</Text>

        <View style={styles.metricsGrid}>
          <Metric dark label="Ukupno knjiga" value={String(stats.total)} />
          <Metric label="Trenutačno čitam" value={String(stats.statusCounts.IN_PROGRESS)} />
          <Metric label="Pročitano" value={String(stats.statusCounts.COMPLETED)} />
          <Metric label="Favoriti" value={String(stats.favourites)} />
        </View>

        <Text style={styles.sectionTitle}>Status čitanja</Text>
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <Text style={styles.availabilityValue}>{stats.averageProgress}%</Text>
            <Text style={styles.availabilityCopy}>prosječan napredak kroz cijeli katalog</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${stats.averageProgress}%` }]} />
          </View>
          <View style={styles.statusBreakdown}>
            {readingStatuses.map((status) => (
              <View key={status} style={styles.statusLine}>
                <Text style={styles.legendText}>{readingStatusLabels[status]}</Text>
                <Text style={styles.statusCount}>{stats.statusCounts[status]}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vremenski raspon</Text>
        <View style={styles.rangeCard}>
          <View style={styles.rangeItem}>
            <Text style={styles.rangeLabel}>Najstarije izdanje</Text>
            <Text style={styles.rangeTitle}>{stats.oldest?.title ?? '—'}</Text>
            <Text style={styles.rangeMeta}>
              {stats.oldest ? `${stats.oldest.author} · ${stats.oldest.publishedYear}` : 'Nema podataka'}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.rangeItem}>
            <Text style={styles.rangeLabel}>Najnovije izdanje</Text>
            <Text style={styles.rangeTitle}>{stats.newest?.title ?? '—'}</Text>
            <Text style={styles.rangeMeta}>
              {stats.newest ? `${stats.newest.author} · ${stats.newest.publishedYear}` : 'Nema podataka'}
            </Text>
          </View>
        </View>

        <View style={styles.yearSummary}>
          <Text style={styles.rangeLabel}>Prosječna godina izdanja</Text>
          <Text style={styles.rangeTitle}>{stats.averageYear ? String(stats.averageYear) : '—'}</Text>
        </View>
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 36,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 3,
    marginLeft: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    marginHorizontal: 6,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  metric: {
    width: '49%',
    minHeight: 126,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 18,
    marginBottom: 8,
  },
  metricDark: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  metricValue: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricValueDark: {
    color: colors.onAccent,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  metricLabelDark: {
    color: '#A1A1A6',
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 9,
    marginLeft: 6,
  },
  availabilityCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 18,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  availabilityValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  availabilityCopy: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    marginLeft: 9,
  },
  track: {
    height: 10,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
    borderRadius: 5,
    marginTop: 18,
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.black,
    borderRadius: 5,
  },
  statusBreakdown: {
    marginTop: 14,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  statusCount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rangeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 18,
  },
  rangeItem: {
    paddingVertical: 18,
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  rangeTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 5,
  },
  rangeMeta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  yearSummary: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    marginTop: 10,
    padding: 18,
  },
});
