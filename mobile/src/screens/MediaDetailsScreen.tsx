// jingleReasonV1
import { JingleReasonCard } from '../components/JingleReasonCard';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueCoverDisplay, CatalogueCoverOverrideControls } from '../components/CatalogueCoverOverride';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { MediaFeedbackView } from '../components/MediaFeedbackView';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
// aroundSameTimeV1
import { AroundSameTimeSection } from '../components/AroundSameTimeSection';
// backdatedSessionsV1
import { BackdatedSessionCard } from '../components/BackdatedSessionCard';
// uncertaintyDatesV1
import { ApproximateDateCard } from '../components/ApproximateDateCard';

import { MediaPoster } from '../components/MediaPoster';
import { PrimaryButton } from '../components/PrimaryButton';
import { SeriesTracker } from '../components/SeriesTracker';
import { WatchTimerCard } from '../components/WatchTimerCard';
import { deleteCatalogueCoverOverride } from '../services/catalogueCoverOverrides';
import { mediaApi } from '../services/mediaApi';
import { hydrateMovieMetadata } from '../services/movieMetadataHydrator';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import {
  mediaEnjoymentLabels,
  mediaTypeLabels,
  watchStatusLabels,
  type MediaResponse,
  type MediaTimerResponse,
} from '../types/media';
import type { MediaStackParamList } from '../types/mediaNavigation';
import type { SeriesProgress } from '../types/series';
import { deletedFeedback } from '../utils/crudFeedback';
import { TimerMotionView } from '../components/TimerMotionView';
import { semanticFeedback } from '../utils/semanticFeedback';

import { celestial, celestialAlpha } from '../theme/celestial';
import { JingleBellIcon } from '../components/JingleBellIcon';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaDetails'>;

const celestialMode = activeVisualSkinId === 'classic';

export function MediaDetailsScreen({ route, navigation }: Props) {
  const { mediaId } = route.params;
  const [item, setItem] = useState<MediaResponse | null>(null);
  const [timer, setTimer] = useState<MediaTimerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jingleBusy, setJingleBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedItem, loadedTimer] = await Promise.all([
        mediaApi.getById(mediaId),
        mediaApi.getTimer(mediaId),
      ]);
      setItem(loadedItem);
      setTimer(loadedTimer);

      // lazyMoviePostersV5
      if (loadedItem.mediaType === 'MOVIE' && !loadedItem.posterPath) {
        void hydrateMovieMetadata(loadedItem, { priority: true }).then((hydrated) => {
          if (hydrated) setItem(hydrated);
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat naslova nije uspio.');
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  useEffect(() => {
    void load();
    return navigation.addListener('focus', () => void load());
  }, [load, navigation]);

  const updateSeriesProgress = useCallback(() => {
    void load();
  }, [load]);

  const toggleTimer = async () => {
    if (!timer || timerLoading) return;
    setTimerLoading(true);
    setTimerError(null);
    try {
      const updated = timer.running
        ? await mediaApi.stopWatching(mediaId)
        : await mediaApi.startWatching(mediaId);
      setTimer(updated);
      void (updated.running
        ? semanticFeedback.timerStart()
        : semanticFeedback.timerStop());
    } catch (caught) {
      setTimerError(caught instanceof Error ? caught.message : 'Promjena timera nije uspjela.');
    } finally {
      setTimerLoading(false);
    }
  };

  const toggleJingle = async () => {
    if (
      !item ||
      jingleBusy
    ) {
      return;
    }

    setJingleBusy(true);

    try {
      const updated =
        await mediaApi.setFavourite(
          item.mediaId,
          !item.favourite,
        );

      setItem(updated);

      void semanticFeedback.jingle(
        updated.favourite,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Jingle promjena nije spremljena.',
      );
    } finally {
      setJingleBusy(false);
    }
  };

  const remove = () => {
    if (!item || deleting) return;
    setDeleteError(null);
    setConfirmVisible(true);
  };

  const confirmRemove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await mediaApi.remove(mediaId);

      deletedFeedback();
      // mediaDetailsCoverNullGuardV1
      if (item) {
        await deleteCatalogueCoverOverride(
          item.mediaType,
          mediaId,
        ).catch(() => undefined);
      }
      setConfirmVisible(false);
      navigation.goBack();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Brisanje nije uspjelo.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelRemove = () => {
    if (deleting) return;
    setConfirmVisible(false);
    setDeleteError(null);
  };

  if (loading && !item) return <MediaFeedbackView type="loading" />;
  if (error || !item) {
    return <MediaFeedbackView type="error" message={error ?? 'Naslov nije pronađen.'} onRetry={() => void load()} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, celestialMode && styles.celestialHero]}>
          {celestialMode ? <CelestialAtmosphere variant="media" /> : null}
          <CatalogueCoverDisplay
            entityType={item.mediaType}
            entityId={item.mediaId}
            imageStyle={{
              width: 156,
              height: 234,
              borderRadius: 12,
              backgroundColor: colors.fillStrong,
            }}
          >
            <MediaPoster
              title={item.title}
              posterPath={item.posterPath}
              width={156}
              height={234}
            />
          </CatalogueCoverDisplay>
          <View style={styles.heroText}>
            <Text style={styles.type}>{mediaTypeLabels[item.mediaType]}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.year}>{item.releaseYear ?? 'Godina nije poznata'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{watchStatusLabels[item.watchStatus]}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.favourite
                  ? 'Makni iz Jingle'
                  : 'Dodaj u Jingle'
              }
              disabled={jingleBusy}
              hitSlop={10}
              onPress={() =>
                void toggleJingle()
              }
              style={styles.heroJingleButton}
            >
              <JingleBellIcon
                active={item.favourite}
                inactiveOpacity={0.28}
                style={styles.heroJingle}
              />
            </Pressable>
          </View>
        </View>
<CatalogueCoverOverrideControls
          entityType={item.mediaType}
          entityId={item.mediaId}
        />

        {item.favourite ? (
          <JingleReasonCard
            entityType="MEDIA"
            entityId={item.mediaId}
          />
        ) : null}

        {item.mediaType === 'SERIES' ? (
          <SeriesTracker
            mediaId={item.mediaId}
            title={item.title}
            onProgressChange={updateSeriesProgress}
          />
        ) : null}

        {timer ? (
          <TimerMotionView active={timer.running}>
            <WatchTimerCard
            timer={timer}
            loading={timerLoading}
            errorMessage={timerError}
            onToggle={() => void toggleTimer()}
          />
          </TimerMotionView>
        ) : null}

        {/* backdatedSessionsV1 */}
        <BackdatedSessionCard
          entityType="MEDIA"
          entityId={mediaId}
        />

        {/* uncertaintyDatesV1 */}
        <ApproximateDateCard
          entityType="MEDIA"
          entityId={mediaId}
        />

        <EntityRelationsPanel entityType="MEDIA" entityId={mediaId} title={item.title} />

        {/* aroundSameTimeV1 */}
        <AroundSameTimeSection
          entityType="MEDIA"
          entityId={mediaId}
        />

        {item.overview ? (
          <View style={[styles.card, celestialMode && styles.celestialCard]}>
            <Text style={styles.sectionLabel}>Opis</Text>
            <Text style={styles.overview}>{item.overview}</Text>
          </View>
        ) : null}

        <View style={[styles.card, celestialMode && styles.celestialCard]}>
          <DetailRow label="Dojam" value={item.enjoyment ? mediaEnjoymentLabels[item.enjoyment] : 'Nije ocijenjeno'} />
          <DetailRow label="Početak gledanja" value={item.startedOn ?? 'Nije zabilježeno'} />
          <DetailRow label="Završetak gledanja" value={item.completedOn ?? 'Nije zabilježeno'} />
          <DetailRow label="Online izvor" value={item.tmdbId ? String(item.tmdbId) : 'Ručni unos'} />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Uredi naslov"
            variant="secondary"
            onPress={() => navigation.navigate('MediaForm', { mediaId })}
          />
          <View style={styles.gap} />
          <PrimaryButton
            label="Obriši naslov"
            variant="danger"
            loading={deleting}
            onPress={remove}
          />
        </View>
      </ScrollView>
      <DeleteConfirmationModal
        visible={confirmVisible}
        itemTitle={item.title}
        title="Obrisati naslov?"
        message={`„${item.title}” bit će uklonjen iz kataloga. Spremljena povijest gledanja ostaje sačuvana.`}
        loading={deleting}
        errorMessage={deleteError}
        onCancel={cancelRemove}
        onConfirm={() => void confirmRemove()}
      />
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  hero: { flexDirection: 'row', gap: 20, alignItems: 'flex-end' },
  heroText: { flex: 1, paddingBottom: 4 },
  type: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 6 },
  year: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  badge: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.fillStrong },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  // // catalogueJingleProgressSemanticsV1:MediaJingle
  heroJingleButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  heroJingle: {
    width: 32,
    height: 39,
  },
  progressCard: { marginTop: 20, padding: 17, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  progressValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.fillStrong, marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.black },
  card: { marginTop: 18, paddingHorizontal: 18, paddingTop: 17, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  overview: { color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 18 },
  detailRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  detailValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 5 },
  actions: { marginTop: 24 },
  gap: { height: 12 },
  celestialHero: {
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 6,
  },
  celestialCard: {
    borderColor: celestialAlpha(celestial.gold, 0.36),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  celestialProgressFill: {
    backgroundColor: celestial.gold,
  },

});

// catalogueJingleProgressSemanticsV1
