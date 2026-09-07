import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { seriesApi } from '../services/seriesApi';
import { triggerCompletionCelebration } from '../services/completionCelebration';
// completionCelebrationR1:series-tracker
import { colors } from '../theme/colors';
import type { SeriesEpisode, SeriesProgress } from '../types/series';

type Props = {
  mediaId: string;
  title: string;
  onProgressChange: (progress: SeriesProgress) => Promise<void> | void;
};

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function episodeCode(episode: SeriesEpisode) {
  return `S${String(episode.seasonNumber).padStart(2, '0')} E${String(episode.episodeNumber).padStart(2, '0')}`;
}

function seriesComplete(value: SeriesProgress | null) {
  return Boolean(
    value &&
    value.totalCount > 0 &&
    value.watchedCount >= value.totalCount
  );
}

function celebrateIfSeriesJustCompleted(
  previous: SeriesProgress | null,
  next: SeriesProgress,
  title: string,
) {
  if (!seriesComplete(previous) && seriesComplete(next)) {
    triggerCompletionCelebration({ kind: 'SERIES', title });
  }
}

export function SeriesTracker({ mediaId, title, onProgressChange }: Props) {
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [changingSeason, setChangingSeason] = useState<number | null>(null); // catalogueFinalPolishV1
  const [error, setError] = useState<string | null>(null);
  const initialSeasonChosen = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const cached = await seriesApi.getProgress(mediaId);
        if (active && cached.totalCount) setProgress(cached);
        const synced = await seriesApi.sync(mediaId, title);
        if (active) setProgress(synced);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Epizode nije moguće dohvatiti.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [mediaId, title]);

  useEffect(() => {
    if (!initialSeasonChosen.current && progress?.nextEpisode) {
      initialSeasonChosen.current = true;
      setExpandedSeason(progress.nextEpisode.seasonNumber);
    }
  }, [progress?.nextEpisode]);

  const seasons = useMemo(() => {
    const grouped = new Map<number, SeriesEpisode[]>();
    for (const episode of progress?.episodes ?? []) {
      const current = grouped.get(episode.seasonNumber) ?? [];
      current.push(episode);
      grouped.set(episode.seasonNumber, current);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [progress]);

  const toggle = async (episode: SeriesEpisode) => {
    if (changingId !== null) return;
    setChangingId(episode.episodeId);
    setError(null);
    try {
      const next = await seriesApi.setWatched(mediaId, episode.episodeId, !episode.watched);
      setProgress(next);
      await onProgressChange(next);
      celebrateIfSeriesJustCompleted(progress, next, title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Promjena epizode nije spremljena.');
    } finally {
      setChangingId(null);
    }
  };

  const toggleSeason = async (season: number, episodes: SeriesEpisode[]) => {
    if (changingId !== null || changingSeason !== null) return;
    const allWatched = episodes.length > 0 && episodes.every((episode) => episode.watched);
    setChangingSeason(season);
    setError(null);
    try {
      const next = await seriesApi.setSeasonWatched(mediaId, season, !allWatched);
      setProgress(next);
      await onProgressChange(next);
      celebrateIfSeriesJustCompleted(progress, next, title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sezona nije spremljena.');
    } finally {
      setChangingSeason(null);
    }
  };

  if (loading && !progress) {
    return <View style={styles.card}><Text style={styles.muted}>Dohvaćam sezone i epizode…</Text></View>;
  }
  if (!progress?.totalCount) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Epizode</Text>
        <Text style={styles.error}>{error ?? 'Popis epizoda nije dostupan.'}</Text>
      </View>
    );
  }

  const percent = Math.round(progress.watchedCount / progress.totalCount * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.label}>Tvoja serija</Text>
            <Text style={styles.count}>{progress.watchedCount} / {progress.totalCount} epizoda</Text>
          </View>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{progress.averageRuntimeMinutes ? `≈ ${progress.averageRuntimeMinutes} min` : '—'}</Text><Text style={styles.statLabel}>prosjek</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{duration(progress.watchedMinutes)}</Text><Text style={styles.statLabel}>pogledano</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{duration(progress.remainingMinutes)}</Text><Text style={styles.statLabel}>preostalo</Text></View>
        </View>

        {progress.nextEpisode ? (
          <Pressable onPress={() => void toggle(progress.nextEpisode!)} style={styles.continueButton}>
            <View style={styles.continueText}>
              <Text style={styles.continueEyebrow}>NASTAVI GLEDATI</Text>
              <Text numberOfLines={1} style={styles.continueTitle}>{episodeCode(progress.nextEpisode)} · {progress.nextEpisode.name}</Text>
            </View>
            <Text style={styles.continueAction}>✓</Text>
          </Pressable>
        ) : <Text style={styles.finished}>Sve dostupne epizode su pogledane ✓</Text>}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </View>

      <View style={styles.seasonsCard}>
        <Text style={styles.seasonsTitle}>Sezone i epizode</Text>
        {seasons.map(([season, episodes]) => {
          const watched = episodes.filter((episode) => episode.watched).length;
          const expanded = expandedSeason === season;
          return (
            <View key={season} style={styles.seasonBlock}>
              <View style={styles.seasonHeader}>
                <Pressable
                  onPress={() => setExpandedSeason(expanded ? null : season)}
                  style={styles.seasonOpen}
                >
                  <View>
                    <Text style={styles.seasonName}>{season === 0 ? 'Specijali' : `Sezona ${season}`}</Text>
                    <Text style={styles.seasonMeta}>{watched} / {episodes.length} pogledano</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={watched === episodes.length ? 'Označi cijelu sezonu kao nepogledanu' : 'Označi cijelu sezonu kao pogledanu'}
                  disabled={changingId !== null || changingSeason !== null}
                  onPress={() => void toggleSeason(season, episodes)}
                  style={[styles.seasonBulk, watched === episodes.length && styles.seasonBulkActive]}
                >
                  <Text style={[styles.seasonBulkText, watched === episodes.length && styles.seasonBulkTextActive]}>✓</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? 'Sakrij epizode' : 'Prikaži epizode'}
                  onPress={() => setExpandedSeason(expanded ? null : season)}
                  style={styles.seasonExpand}
                >
                  <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
                </Pressable>
              </View>
              {expanded ? episodes.map((episode) => (
                <Pressable
                  key={episode.episodeId}
                  disabled={changingId !== null}
                  onPress={() => void toggle(episode)}
                  style={styles.episodeRow}
                >
                  <View style={[styles.check, episode.watched && styles.checkActive]}>
                    <Text style={[styles.checkText, episode.watched && styles.checkTextActive]}>{episode.watched ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.episodeText}>
                    <Text style={styles.episodeCode}>{episodeCode(episode)}</Text>
                    <Text numberOfLines={2} style={[styles.episodeName, episode.watched && styles.episodeWatched]}>{episode.name}</Text>
                  </View>
                  <Text style={styles.runtime}>{episode.runtimeMinutes ? `${episode.runtimeMinutes} min` : '—'}</Text>
                </Pressable>
              )) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  card: { padding: 20, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 9 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  count: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  percent: { color: colors.text, fontSize: 23, fontWeight: '900' },
  track: { height: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.fillStrong, marginTop: 16 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.black },
  stats: { flexDirection: 'row', gap: 8, marginTop: 17 },
  stat: { flex: 1, padding: 11, borderRadius: 14, backgroundColor: colors.fill },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  continueButton: { flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 15, borderRadius: 17, backgroundColor: colors.black },
  continueText: { flex: 1, paddingRight: 10 },
  continueEyebrow: { color: colors.onAccent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, opacity: 0.72 },
  continueTitle: { color: colors.onAccent, fontSize: 15, fontWeight: '800', marginTop: 4 },
  continueAction: { color: colors.onAccent, fontSize: 19, fontWeight: '900' },
  finished: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 18 },
  inlineError: { color: colors.danger, fontSize: 12, marginTop: 10 },
  seasonsCard: { marginTop: 16, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  seasonsTitle: { color: colors.text, fontSize: 19, fontWeight: '900', paddingTop: 19, paddingBottom: 8 },
  seasonBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  seasonHeader: { minHeight: 67, flexDirection: 'row', alignItems: 'center' },
  seasonOpen: { flex: 1, minHeight: 67, justifyContent: 'center' },
  seasonBulk: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  seasonBulkActive: { backgroundColor: colors.black, borderColor: colors.black },
  seasonBulkText: { color: colors.textMuted, fontSize: 16, fontWeight: '900' },
  seasonBulkTextActive: { color: colors.onAccent },
  seasonExpand: { width: 40, height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  seasonName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  seasonMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: '400' },
  episodeRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingVertical: 10 },
  check: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  checkActive: { backgroundColor: colors.black, borderColor: colors.black },
  checkText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  checkTextActive: { color: colors.onAccent },
  episodeText: { flex: 1, paddingHorizontal: 12 },
  episodeCode: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  episodeName: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 19, marginTop: 2 },
  episodeWatched: { color: colors.textMuted },
  runtime: { color: colors.textMuted, fontSize: 11 },
});
