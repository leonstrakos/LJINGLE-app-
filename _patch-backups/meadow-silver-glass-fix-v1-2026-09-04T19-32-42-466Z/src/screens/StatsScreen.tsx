import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import {
  loadStatsOverview,
  type StatsNetPeriodKey,
  type StatsOverview,
  type StatsTopItem,
} from '../storage/statsOverview';
import { CatalogueSnapshotsSection } from '../components/CatalogueSnapshotsSection';
import { LatelyStatsSection } from '../components/LatelyStatsSection';
// temporalStatsV1
import { TemporalStatsSection } from '../components/TemporalStatsSection';
import { colors } from '../theme/colors';
import { readingStatusLabels, readingStatuses } from '../types/book';
// forkEBookStatsUnifiedV1
import { activeVisualSkinId } from '../theme/visualSkins';
import { activeAeroBackgroundId } from '../theme/aeroBackground';

import { celestial, celestialAlpha } from '../theme/celestial';
const pixelMode = activeVisualSkinId === 'pixel';

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

// statsNeutralSurfaceV1 — Stats stays visually neutral across Aero/Meadow
const aeroMode = activeVisualSkinId === 'aero'; // FRUTIGER_AERO_MAX_UI_V2
const aeroMeadow =
  aeroMode &&
  activeAeroBackgroundId === 'meadow';

const nf = new Intl.NumberFormat('hr-HR');

function N4ProfileDust() {
  if (!n4Celestial) return null;
  return (
    <View pointerEvents="none" style={styles.n4Dust}>
      <Text style={[styles.n4Star, { left: '7%' as any, top: 44 }]}>✦</Text>
      <Text style={[styles.n4StarSmall, { right: '11%' as any, top: 96 }]}>✧</Text>
      <Text style={[styles.n4StarSmall, { left: '44%' as any, top: 170 }]}>· ✦ ·</Text>
      <Text style={[styles.n4StarSmall, { right: '22%' as any, top: 322 }]}>✦</Text>
    </View>
  );
}



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

const NET_PERIODS: {
  key: StatsNetPeriodKey;
  label: string;
}[] = [
  { key: 'DAYS_7', label: '7D' },
  { key: 'DAYS_30', label: '30D' },
  { key: 'YEAR', label: 'GODINA' },
  { key: 'ALL', label: 'SVE' },
];

function formatSigned(value: number) {
  if (value > 0) return '+' + nf.format(value);
  return nf.format(value);
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
  const [netPeriod, setNetPeriod] =
    useState<StatsNetPeriodKey>('DAYS_30');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      setData(await loadStatsOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Profil se nije mogao učitati.');
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
      <AeroAtmosphere variant="profile" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>Slažem tvoj profil…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="profile" />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Profil nije dostupan</Text>
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
  const catalogueTotal =
    data.library.books +
    data.library.media +
    data.library.games;
  const net = data.netTracking[netPeriod];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="profile" />
      <N4ProfileDust />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        {/* finalPrebuildUiV1: settings belongs on Profile, not Today. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otvori postavke"
          hitSlop={12}
          onPress={() => navigation.navigate('ThemePicker')}
          style={({ pressed }) => [
            styles.profileSettingsButtonFinalV1,
            pressed && styles.profileSettingsButtonPressedFinalV1,
          ]}
        >
          <Image
            source={require('../assets/ui/settings-gear.png')}
            resizeMode="contain"
            style={[
              styles.profileSettingsIconFinalV1,
              { tintColor: n4Celestial ? N4_GOLD : colors.textMuted },
            ]}
          />
        </Pressable>

        {/* forkIHomeProfileV1: Stats route becomes the personal archive Profile. */}
        <Text style={styles.kicker}>LJINGLE · TVOJA ARHIVA</Text>
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.intro}>
          Jedno mjesto za vrijeme, katalog, čitanje, gledanje i tragove koje ostavljaš u LJingleu.
        </Text>
<View style={styles.profileHeroForkIV1}>
          {n4Celestial ? <Text style={styles.n4ProfileSigil}>✦</Text> : null}
          <Text style={styles.profileHeroEyebrowForkIV1}>UKUPNO PRAĆENO</Text>
          <Text style={styles.profileHeroValueForkIV1}>
            {formatTime(data.app.trackedSeconds)}
          </Text>
          <Text style={styles.profileHeroNoteForkIV1}>
            {nf.format(data.app.sessionCount)} sesija
            {data.app.activeSessionCount > 0
              ? ' · ' + nf.format(data.app.activeSessionCount) + ' aktivno sada'
              : ''}
          </Text>

          <View style={styles.profileSnapshotForkIV1}>
            <View style={styles.profileSnapshotItemForkIV1}>
              <Text style={styles.profileSnapshotValueForkIV1}>{nf.format(catalogueTotal)}</Text>
              <Text style={styles.profileSnapshotLabelForkIV1}>u katalogu</Text>
            </View>
            <View style={styles.profileSnapshotItemForkIV1}>
              <Text style={styles.profileSnapshotValueForkIV1}>{nf.format(data.library.entries)}</Text>
              <Text style={styles.profileSnapshotLabelForkIV1}>zapisa</Text>
            </View>
            <View style={styles.profileSnapshotItemForkIV1}>
              <Text style={styles.profileSnapshotValueForkIV1}>
                {nf.format(data.books.statusCounts.IN_PROGRESS)}
              </Text>
              <Text style={styles.profileSnapshotLabelForkIV1}>trenutačno čitam</Text>
            </View>
          </View>
        </View>

        {/* forkNProfileNetTrackingV1 */}
        <View style={styles.netCardForkNV1}>
          <View style={styles.netHeaderForkNV1}>
            <View style={styles.netHeaderCopyForkNV1}>
              <Text style={styles.cardEyebrow}>NETO PROMJENA</Text>
              <Text style={styles.netTitleForkNV1}>Katalog u pokretu</Text>
              <Text style={styles.netIntroForkNV1}>
                Koliko si novih stvari dodao/la naspram onih koje si završio/la.
              </Text>
            </View>

            <View style={styles.netPeriodsForkNV1}>
              {NET_PERIODS.map((period) => {
                const selected =
                  period.key === netPeriod;

                return (
                  <Pressable
                    key={period.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setNetPeriod(period.key)
                    }
                    style={[
                      styles.netPeriodForkNV1,
                      selected &&
                        styles.netPeriodSelectedForkNV1,
                    ]}
                  >
                    <Text
                      style={[
                        styles.netPeriodTextForkNV1,
                        selected &&
                          styles.netPeriodTextSelectedForkNV1,
                      ]}
                    >
                      {period.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.netSummaryForkNV1}>
            <View style={styles.netBalanceForkNV1}>
              <Text style={styles.netBalanceLabelForkNV1}>NETO</Text>
              <Text style={styles.netBalanceValueForkNV1}>
                {formatSigned(net.net)}
              </Text>
            </View>

            <View style={styles.netCountersForkNV1}>
              <View style={styles.netCounterForkNV1}>
                <Text style={styles.netCounterValueForkNV1}>
                  {nf.format(net.added)}
                </Text>
                <Text style={styles.netCounterLabelForkNV1}>DODANO</Text>
              </View>
              <View style={styles.netCounterForkNV1}>
                <Text style={styles.netCounterValueForkNV1}>
                  {nf.format(net.finished)}
                </Text>
                <Text style={styles.netCounterLabelForkNV1}>ZAVRŠENO</Text>
              </View>
            </View>
          </View>

          <View style={styles.netBreakdownForkNV1}>
            {[
              { label: 'Knjige', value: net.books },
              { label: 'Film / TV', value: net.media },
              { label: 'Igre', value: net.games },
            ].map((item) => (
              <View
                key={item.label}
                style={styles.netRowForkNV1}
              >
                <Text style={styles.netRowLabelForkNV1}>
                  {item.label}
                </Text>
                <Text style={styles.netRowMetaForkNV1}>
                  +{nf.format(item.value.added)} dodano
                  {' · '}
                  {nf.format(item.value.finished)} završeno
                </Text>
                <Text style={styles.netRowValueForkNV1}>
                  {formatSigned(item.value.net)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.netFootnoteForkNV1}>
            Pozitivno znači da katalog raste brže nego što ga završavaš; negativno znači da završavaš brže nego što dodaješ.
          </Text>
        </View>
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
        color: n4Celestial ? N4_IVORY : '#111',
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

        {/* forkEBookStatsUnifiedV1: former BookStatsScreen now lives here */}
        <View style={[styles.card, aeroMode && styles.aeroGlass]}>
          <Text style={styles.cardEyebrow}>KNJIGE</Text>
          <Text style={styles.cardTitle}>Čitanje</Text>
          <Text style={styles.cardCopy}>
            Status, napredak i vremenski raspon cijele knjižne zbirke.
          </Text>

          <View style={styles.libraryGrid}>
            <Metric value={nf.format(data.books.total)} label="ukupno knjiga" />
            <Metric value={nf.format(data.books.statusCounts.IN_PROGRESS)} label="trenutačno čitam" />
            <Metric value={nf.format(data.books.statusCounts.COMPLETED)} label="pročitano" />
            <Metric value={nf.format(data.books.favourites)} label="favorita" />
          </View>

          <View style={styles.bookProgressHeader}>
            <Text style={styles.bookProgressValue}>{data.books.averageProgress}%</Text>
            <Text style={styles.bookProgressCopy}>prosječan napredak kroz cijeli katalog</Text>
          </View>
          <View style={styles.bookTrack}>
            <View
              style={[
                styles.bookTrackFill,
                { width: `${Math.max(0, Math.min(100, data.books.averageProgress))}%` },
              ]}
            />
          </View>

          <View style={styles.bookStatusBreakdown}>
            {readingStatuses.map((status) => (
              <View key={status} style={styles.bookStatusLine}>
                <Text style={styles.bookStatusLabel}>{readingStatusLabels[status]}</Text>
                <Text style={styles.bookStatusCount}>{nf.format(data.books.statusCounts[status])}</Text>
              </View>
            ))}
          </View>

          <View style={styles.bookDivider} />
          <Text style={styles.bookSubheading}>Vremenski raspon</Text>
          <View style={styles.bookRangeGrid}>
            <View style={styles.bookRangeItem}>
              <Text style={styles.bookRangeLabel}>Najstarije izdanje</Text>
              <Text style={styles.bookRangeTitle} numberOfLines={2}>
                {data.books.oldest?.title ?? '—'}
              </Text>
              <Text style={styles.bookRangeMeta} numberOfLines={2}>
                {data.books.oldest
                  ? `${data.books.oldest.author} · ${data.books.oldest.publishedYear}`
                  : 'Nema podataka'}
              </Text>
            </View>
            <View style={styles.bookRangeItem}>
              <Text style={styles.bookRangeLabel}>Najnovije izdanje</Text>
              <Text style={styles.bookRangeTitle} numberOfLines={2}>
                {data.books.newest?.title ?? '—'}
              </Text>
              <Text style={styles.bookRangeMeta} numberOfLines={2}>
                {data.books.newest
                  ? `${data.books.newest.author} · ${data.books.newest.publishedYear}`
                  : 'Nema podataka'}
              </Text>
            </View>
          </View>

          <View style={styles.sessionLine}>
            <Text style={styles.sessionLabel}>Prosječna godina izdanja</Text>
            <Text style={styles.sessionValue}>
              {data.books.averageYear ? nf.format(data.books.averageYear) : '—'}
            </Text>
          </View>
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
  // forkN4CelestialArchiveVisualV12
  n4Dust: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  n4Star: { position: 'absolute', color: N4_GOLD, fontSize: 16, opacity: 0.58 },
  n4StarSmall: { position: 'absolute', color: N4_GOLD, fontSize: 9, opacity: 0.40, letterSpacing: 3 },
  n4Rule: { marginTop: 18, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 7 },
  n4RuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: N4_GOLD_LINE },
  n4RuleStar: { color: N4_GOLD, fontSize: 9, opacity: 0.82 },
  n4RuleLabel: { color: N4_GOLD, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  n4ProfileSigil: { position: 'absolute', right: 20, top: 16, color: N4_GOLD, fontSize: 26, opacity: 0.56 },

  safe: {
    flex: 1,
    backgroundColor: aeroMeadow ? '#D8DED6' : aeroMode ? '#DDF6FF' : colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 52,
  },
  // finalPrebuildUiV1
  profileSettingsButtonFinalV1: {
    position: 'absolute',
    top: 12,
    right: 18,
    zIndex: 5,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSettingsButtonPressedFinalV1: {
    opacity: 0.62,
    transform: [{ scale: 0.96 }],
  },
  profileSettingsIconFinalV1: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    color: aeroMeadow ? '#5E7167' : aeroMode ? '#077F9C' : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 4,
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 40,
    lineHeight: 46,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: n4Celestial ? '700' : '900',
    letterSpacing: n4Celestial ? 0.7 : -1.2,
  },
  intro: {
    marginTop: 8,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 600,
  },
  // forkIHomeProfileV1
  profileHeroForkIV1: {
    marginTop: 22,
    padding: 22,
    borderRadius: pixelMode ? 0 : 26,
    backgroundColor: n4Celestial ? N4_PANEL : n4Celestial ? N4_PANEL : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  profileHeroEyebrowForkIV1: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  profileHeroValueForkIV1: {
    marginTop: 6,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 44,
    lineHeight: 50,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  profileHeroNoteForkIV1: {
    marginTop: 3,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  profileSnapshotForkIV1: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  profileSnapshotItemForkIV1: {
    flexGrow: 1,
    flexBasis: '29%',
    minWidth: 112,
    padding: 13,
    borderRadius: pixelMode ? 0 : 16,
    backgroundColor: n4Celestial ? N4_BLUE : n4Celestial ? N4_BLUE : colors.fill,
  },
  profileSnapshotValueForkIV1: {
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 19,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  profileSnapshotLabelForkIV1: {
    marginTop: 2,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },

  // forkNProfileNetTrackingV1
  netCardForkNV1: {
    marginTop: 14,
    padding: 19,
    borderRadius: pixelMode ? 0 : 22,
    backgroundColor: n4Celestial ? N4_PANEL : n4Celestial ? N4_PANEL : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  netHeaderForkNV1: {
    flexDirection: n4Celestial ? 'column' : 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  netHeaderCopyForkNV1: {
    flex: 1,
    minWidth: 0,
  },
  netTitleForkNV1: {
    marginTop: 4,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  netIntroForkNV1: {
    marginTop: 4,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  netPeriodsForkNV1: {
    width: n4Celestial ? '100%' : undefined,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: n4Celestial ? 'flex-start' : 'flex-end',
    gap: 5,
    maxWidth: n4Celestial ? undefined : 190,
  },
  netPeriodForkNV1: {
    minHeight: 30,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 999,
    backgroundColor: n4Celestial ? N4_BLUE : n4Celestial ? N4_BLUE : colors.fill,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  netPeriodSelectedForkNV1: {
    backgroundColor: n4Celestial ? N4_IVORY : colors.text,
    borderColor: n4Celestial ? N4_IVORY : colors.text,
  },
  netPeriodTextForkNV1: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 8.5,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  netPeriodTextSelectedForkNV1: {
    color: colors.background,
  },
  netSummaryForkNV1: {
    // finalHomeProfileJinglePolishV1
    marginTop: 16,
    flexDirection: n4Celestial ? 'column' : 'row',
    gap: 10,
  },
  netBalanceForkNV1: {
    width: n4Celestial ? '100%' : undefined,
    flex: n4Celestial ? undefined : 1.12,
    minWidth: n4Celestial ? 0 : 120,
    padding: 15,
    borderRadius: pixelMode ? 0 : 17,
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
  },
  netBalanceLabelForkNV1: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  netBalanceValueForkNV1: {
    marginTop: 4,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  netCountersForkNV1: {
    width: n4Celestial ? '100%' : undefined,
    flex: n4Celestial ? undefined : 1.5,
    flexDirection: 'row',
    gap: 8,
  },
  netCounterForkNV1: {
    flex: 1,
    minWidth: n4Celestial ? 0 : 82,
    padding: 13,
    borderRadius: pixelMode ? 0 : 17,
    backgroundColor: n4Celestial ? N4_BLUE : n4Celestial ? N4_BLUE : colors.fill,
  },
  netCounterValueForkNV1: {
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  netCounterLabelForkNV1: {
    marginTop: 3,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  netBreakdownForkNV1: {
    marginTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  netRowForkNV1: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  netRowLabelForkNV1: {
    width: 76,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  netRowMetaForkNV1: {
    flex: 1,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9.5,
    lineHeight: 14,
  },
  netRowValueForkNV1: {
    minWidth: 34,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  netFootnoteForkNV1: {
    marginTop: 11,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9.5,
    lineHeight: 14,
  },

  heroCard: {
    marginTop: 24,
    padding: 22,
    borderRadius: pixelMode ? 0 : 24,
    backgroundColor: n4Celestial ? N4_PANEL : n4Celestial ? N4_PANEL : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  aeroGlass: {
    backgroundColor: aeroMeadow ? 'rgba(76,106,69,0.38)' : celestialAlpha(celestial.ivory, 0.72),
    borderColor: aeroMeadow ? celestialAlpha(celestial.ivory, 0.86) : celestialAlpha(celestial.ivory, 0.96),
    shadowColor: aeroMeadow ? 'transparent' : '#087D99',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: aeroMeadow ? 0 : 0.12,
    shadowRadius: 18,
    elevation: aeroMeadow ? 0 : 3,
  },
  heroLabel: {
    color: aeroMeadow ? '#5E7167' : aeroMode ? '#087D99' : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroValue: {
    marginTop: 8,
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
  },
  heroNote: {
    marginTop: 4,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
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
    backgroundColor: aeroMeadow ? 'rgba(84,115,75,0.42)' : aeroMode ? celestialAlpha(celestial.ivory, 0.65) : n4Celestial ? N4_PANEL : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.94) : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  metricValue: {
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 24,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    marginTop: 3,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    marginTop: 14,
    padding: 19,
    borderRadius: pixelMode ? 0 : 22,
    backgroundColor: n4Celestial ? N4_PANEL : n4Celestial ? N4_PANEL : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  cardEyebrow: {
    color: aeroMeadow ? '#5E7167' : aeroMode ? '#087D99' : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cardTitle: {
    marginTop: 4,
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 23,
    lineHeight: 28,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  cardCopy: {
    marginTop: 5,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  splitBar: {
    height: 13,
    marginTop: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 8,
    backgroundColor: n4Celestial ? N4_BLUE : n4Celestial ? N4_BLUE : colors.fill,
  },
  seriesBar: {
    backgroundColor: aeroMeadow ? '#71867A' : aeroMode ? '#32BDE1' : n4Celestial ? N4_IVORY : colors.text,
  },
  movieBar: {
    backgroundColor: aeroMeadow ? '#AAB6AE' : aeroMode ? '#8EDDF0' : n4Celestial ? N4_MUTED : colors.textMuted,
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
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  legendLabel: {
    marginTop: 2,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
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
    borderTopColor: aeroMode ? 'rgba(4,104,151,0.14)' : n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  rankNumber: {
    width: 34,
    color: aeroMode ? '#0893B5' : n4Celestial ? N4_MUTED : colors.textMuted,
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
    color: aeroMeadow ? '#31453C' : aeroMode ? '#06366C' : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rankMeta: {
    marginTop: 2,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
  },
  libraryGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bookProgressHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
  },
  bookProgressValue: {
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bookProgressCopy: {
    flex: 1,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  bookTrack: {
    height: 8,
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 999,
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
  },
  bookTrackFill: {
    height: '100%',
    backgroundColor: n4Celestial ? N4_IVORY : colors.text,
  },
  bookStatusBreakdown: {
    marginTop: 14,
    gap: 9,
  },
  bookStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookStatusLabel: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  bookStatusCount: {
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bookDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    backgroundColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
  },
  bookSubheading: {
    marginTop: 16,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  bookRangeGrid: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  bookRangeItem: {
    flex: 1,
    minWidth: 0,
    padding: 13,
    borderRadius: pixelMode ? 0 : 15,
    backgroundColor: n4Celestial ? N4_BLUE : n4Celestial ? N4_BLUE : colors.fill,
  },
  bookRangeLabel: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bookRangeTitle: {
    marginTop: 5,
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  bookRangeMeta: {
    marginTop: 3,
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  sessionLine: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: n4Celestial ? N4_GOLD_LINE : n4Celestial ? N4_GOLD_LINE : colors.separator,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionLabel: {
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionValue: {
    color: n4Celestial ? N4_IVORY : n4Celestial ? N4_IVORY : colors.text,
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
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
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
    color: n4Celestial ? N4_MUTED : n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
