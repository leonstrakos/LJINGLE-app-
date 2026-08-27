import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  loadStatsOverview,
  type StatsOverview,
  type StatsTopItem,
} from '../storage/statsOverview';
import { CatalogueSnapshotsSection } from '../components/CatalogueSnapshotsSection';
import { LatelyStatsSection } from '../components/LatelyStatsSection';
// temporalStatsV1
import { TemporalStatsSection } from '../components/TemporalStatsSection';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';

const pixelMode = activeVisualSkinId === 'pixel';
const aeroMode = activeVisualSkinId === 'aero';

const nf = new Intl.NumberFormat('hr-HR');

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (days > 0) return `${nf.format(days)} d ${hours} h`;
  if (hours > 0) return `${nf.format(hours)} h ${minutes} min`;
  return `${nf.format(minutes)} min`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function Metric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Ranking({
  items,
  unit,
}: {
  items: StatsTopItem[];
  unit: 'episodes' | 'views';
}) {
  if (items.length === 0) {
    return <Text style={styles.muted}>Još nema dovoljno podataka za rangiranje.</Text>;
  }

  return (
    <View style={styles.ranking}>
      {items.map((item, index) => (
        <View key={item.id} style={styles.rankRow}>
          <Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.rankCopy}>
            <Text style={styles.rankTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.rankMeta}>
              {unit === 'episodes'
                ? `${nf.format(item.count)} ep. · ${formatTime(item.seconds)}`
                : `${nf.format(item.count)} gledanja · ${formatTime(item.seconds)}`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function StatsScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      setData(await loadStatsOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Statistika se nije mogla učitati.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>Računam tvoju statistiku…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Statistika nije dostupna</Text>
          <Text style={styles.muted}>{error ?? 'Pokušaj ponovno.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tvTotal =
    data.tvTime.totalSeriesRuntimeSeconds +
    data.tvTime.totalMoviesRuntimeSeconds;
  const seriesShare = tvTotal > 0
    ? Math.round((data.tvTime.totalSeriesRuntimeSeconds / tvTotal) * 100)
    : 0;
  const movieShare = tvTotal > 0 ? 100 - seriesShare : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <Text style={styles.kicker}>TVOJA ARHIVA</Text>
        <Text style={styles.title}>Statistika</Text>
        <Text style={styles.intro}>
          Povijesno gledanje iz TV Timea i vrijeme koje Life Catalogue mjeri od sada nadalje.
        </Text>
{/* reconstructionEntryV1 */}
<Pressable
  onPress={() =>
    navigation.navigate('Reconstruction')
  }
  style={[
    styles.heroCard,
    aeroMode && styles.aeroGlass,
    { marginTop: 18 },
  ]}
>
  <Text style={styles.heroLabel}>
    OSOBNI ARHIV
  </Text>

  <Text
    style={{
      marginTop: 7,
      fontSize: 20,
      fontWeight: '900',
        color: '#111',
    }}
  >
    Rekonstrukcija vremena →
  </Text>

  <Text
    style={[
      styles.muted,
      { marginTop: 6 },
    ]}
  >
    Vrati se na mjesec ili dan i vidi što si
    tada čitao, gledao, igrao i radio.
  </Text>
</Pressable>


        <View style={[styles.heroCard, aeroMode && styles.aeroGlass]}>
          <Text style={styles.heroLabel}>UKUPNO VRIJEME GLEDANJA · TV TIME</Text>
          <Text style={styles.heroValue}>
            {data.tvTime.available ? formatTime(tvTotal) : '—'}
          </Text>
          <Text style={styles.heroNote}>
            {data.tvTime.available
              ? `Snapshot do ${formatDate(data.tvTime.sourceUpdatedAt) ?? 'zadnjeg izvoza'}`
              : 'TV Time snapshot nije pronađen.'}
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <Metric value={nf.format(data.tvTime.episodeWatchCount)} label="epizoda" />
          <Metric value={nf.format(data.tvTime.movieWatchCount)} label="pogledanih filmova" />
          <Metric value={nf.format(data.tvTime.seriesFollowCount)} label="praćenih serija" />
          <Metric value={formatTime(data.app.trackedSeconds)} label="mjereno u appu" />
        </View>

        {data.tvTime.available ? (
          <View style={[styles.card, aeroMode && styles.aeroGlass]}>
            <Text style={styles.cardEyebrow}>GLEDANJE</Text>
            <Text style={styles.cardTitle}>Serije vs. filmovi</Text>

            <View style={styles.splitBar}>
              <View style={[styles.seriesBar, { flex: Math.max(1, seriesShare) }]} />
              <View style={[styles.movieBar, { flex: Math.max(1, movieShare) }]} />
            </View>

            <View style={styles.splitLegend}>
              <View style={styles.legendItem}>
                <Text style={styles.legendValue}>{seriesShare}%</Text>
                <Text style={styles.legendLabel}>Serije · {formatTime(data.tvTime.totalSeriesRuntimeSeconds)}</Text>
              </View>
              <View style={[styles.legendItem, styles.legendRight]}>
                <Text style={styles.legendValue}>{movieShare}%</Text>
                <Text style={styles.legendLabel}>Filmovi · {formatTime(data.tvTime.totalMoviesRuntimeSeconds)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, aeroMode && styles.aeroGlass]}>
          <Text style={styles.cardEyebrow}>SERIJE</Text>
          <Text style={styles.cardTitle}>Najviše gledano</Text>
          <Text style={styles.cardCopy}>
            Rangirano po poznatom runtimeu gledanih epizoda u lokalnoj bazi.
          </Text>
          <Ranking items={data.topSeries} unit="episodes" />
        </View>

        <View style={[styles.card, aeroMode && styles.aeroGlass]}>
          <Text style={styles.cardEyebrow}>FILMOVI</Text>
          <Text style={styles.cardTitle}>Najviše vremena</Text>
          <Text style={styles.cardCopy}>
            TV Time runtime + sačuvani rewatchevi gdje ih export sadrži.
          </Text>
          <Ranking items={data.topMovies} unit="views" />
        </View>

        <View style={[styles.card, aeroMode && styles.aeroGlass]}>
          <Text style={styles.cardEyebrow}>LIFE CATALOGUE</Text>
          <Text style={styles.cardTitle}>Tvoja biblioteka</Text>
          <View style={styles.libraryGrid}>
            <Metric value={nf.format(data.library.books)} label="knjiga" />
            <Metric value={nf.format(data.library.media)} label="filmova + serija" />
            <Metric value={nf.format(data.library.games)} label="igara" />
            <Metric value={nf.format(data.library.entries)} label="zapisa" />
          </View>

          <View style={styles.sessionLine}>
            <Text style={styles.sessionLabel}>Zabilježene sesije</Text>
            <Text style={styles.sessionValue}>{nf.format(data.app.sessionCount)}</Text>
          </View>
          {data.app.activeSessionCount > 0 ? (
            <Text style={styles.live}>
              ● {nf.format(data.app.activeSessionCount)} aktivno sada
            </Text>
          ) : null}
        </View>

        <Text style={styles.footer}>
          Nebitno je isključeno iz prikazanih library brojki i rang-lista.
        </Text>
        <LatelyStatsSection />
          <TemporalStatsSection />
          <CatalogueSnapshotsSection />
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: aeroMode ? '#DDF6FF' : colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 52,
  },
  center: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  kicker: {
    color: aeroMode ? '#077F9C' : colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 4,
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 40,
    lineHeight: 46,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  intro: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 600,
  },
  heroCard: {
    marginTop: 24,
    padding: 22,
    borderRadius: pixelMode ? 0 : 24,
    backgroundColor: colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: colors.separator,
  },
  aeroGlass: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#087D99',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  heroLabel: {
    color: aeroMode ? '#087D99' : colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroValue: {
    marginTop: 8,
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
  },
  heroNote: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    padding: 16,
    borderRadius: pixelMode ? 0 : 18,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.65)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.94)' : colors.separator,
  },
  metricValue: {
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 24,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    marginTop: 14,
    padding: 19,
    borderRadius: pixelMode ? 0 : 22,
    backgroundColor: colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: colors.separator,
  },
  cardEyebrow: {
    color: aeroMode ? '#087D99' : colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cardTitle: {
    marginTop: 4,
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 23,
    lineHeight: 28,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  cardCopy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  splitBar: {
    height: 13,
    marginTop: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 8,
    backgroundColor: colors.fill,
  },
  seriesBar: {
    backgroundColor: aeroMode ? '#32BDE1' : colors.text,
  },
  movieBar: {
    backgroundColor: aeroMode ? '#8EDDF0' : colors.textMuted,
  },
  splitLegend: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  legendItem: {
    flex: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendValue: {
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  legendLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  ranking: {
    marginTop: 14,
  },
  rankRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: aeroMode ? 'rgba(4,104,151,0.14)' : colors.separator,
  },
  rankNumber: {
    width: 34,
    color: aeroMode ? '#0893B5' : colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rankCopy: {
    flex: 1,
    minWidth: 0,
  },
  rankTitle: {
    color: aeroMode ? '#06366C' : colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rankMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
  },
  libraryGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionLine: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  live: {
    marginTop: 7,
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '900',
  },
  footer: {
    marginTop: 18,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
