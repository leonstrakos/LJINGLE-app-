// jingleReasonV1
import { JingleReasonCard } from '../../components/JingleReasonCard';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueCoverDisplay, CatalogueCoverOverrideControls } from '../../components/CatalogueCoverOverride';
import { DeleteConfirmationModal } from '../../components/DeleteConfirmationModal';
import { FeedbackView } from '../../components/FeedbackView';
import { EntityRelationsPanel } from '../../components/EntityRelationsPanel';
// aroundSameTimeV1
import { AroundSameTimeSection } from '../../components/AroundSameTimeSection';
// backdatedSessionsV1
import { BackdatedSessionCard } from '../../components/BackdatedSessionCard';
// uncertaintyDatesV1
import { ApproximateDateCard } from '../../components/ApproximateDateCard';

import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import type { ActivityTimerResponse } from '../../types/activity';
import { GameTimerCard } from '../components/GameTimerCard';
import { deleteCatalogueCoverOverride } from '../../services/catalogueCoverOverrides';
import { gameApi } from '../services/gameApi';
import { hydrateGameMetadata } from '../services/gameMetadataHydrator';
import {
  enjoymentLabels,
  gameStatusLabels,
  type GameResponse,
  type GameStackParamList,
} from '../types/game';

type Props = NativeStackScreenProps<GameStackParamList, 'GameDetails'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function GameDetailsScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const [game, setGame] = useState<GameResponse | null>(null);
  const [timer, setTimer] = useState<ActivityTimerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedGame, loadedTimer] = await Promise.all([
        gameApi.getById(gameId),
        gameApi.getTimer(gameId),
      ]);
      setGame(loadedGame);
      setTimer(loadedTimer);

      // lazyGameCoversV1
      if (!loadedGame.coverUrl) {
        void hydrateGameMetadata(loadedGame, { priority: true }).then((hydrated) => {
          if (hydrated) setGame(hydrated);
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat igre nije uspio.');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
    return navigation.addListener('focus', () => void loadGame());
  }, [loadGame, navigation]);

  const toggleTimer = async () => {
    if (!timer || timerLoading) return;
    setTimerLoading(true);
    setTimerError(null);
    try {
      setTimer(timer.running
        ? await gameApi.stopTimer(gameId)
        : await gameApi.startTimer(gameId));
    } catch (caught) {
      setTimerError(caught instanceof Error ? caught.message : 'Promjena timera nije uspjela.');
    } finally {
      setTimerLoading(false);
    }
  };

  const deleteGame = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await gameApi.remove(gameId);
      await deleteCatalogueCoverOverride('GAME', gameId).catch(() => undefined);
      setConfirmVisible(false);
      navigation.popToTop();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Brisanje nije uspjelo.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    setDeleteError(null);
    setConfirmVisible(true);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setConfirmVisible(false);
    setDeleteError(null);
  };

  if (loading && !game) return <FeedbackView type="loading" />;
  if (error || !game) {
    return <FeedbackView type="error" message={error ?? 'Igra nije pronađena.'} onRetry={() => void loadGame()} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* mobileStabilityUiPolishV1 */}
        <View style={styles.hero}>
          <CatalogueCoverDisplay
            entityType="GAME"
            entityId={gameId}
            imageStyle={styles.cover}
          >
            {game.coverUrl ? (
              <Image
                source={{ uri: game.coverUrl }}
                resizeMode="cover"
                style={styles.cover}
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverMark}>G</Text>
              </View>
            )}
          </CatalogueCoverDisplay>

          <View style={styles.heroText}>
            <Text style={styles.type}>IGRA</Text>

            <Text
              numberOfLines={4}
              style={styles.title}
            >
              {game.title}{game.dnf ? ' *' : ''}
            </Text>

            <Text style={styles.subtitle}>
              {[game.developer, game.releaseYear]
                .filter(Boolean)
                .join(' · ') || game.platform}
            </Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {gameStatusLabels[game.gameStatus]}
                {game.dnf ? ' *' : ''}
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={styles.platform}
            >
              {game.platform}
            </Text>

            {game.favourite ? (
              <Image
                source={require('../../assets/aero/fav.png')}
                resizeMode="contain"
                style={styles.heroJingle}
              />
            ) : null}
          </View>
        </View>

        <CatalogueCoverOverrideControls
          entityType="GAME"
          entityId={gameId}
        />

        {game.favourite ? (
          <JingleReasonCard
            entityType="GAME"
            entityId={game.gameId}
          />
        ) : null}

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Napredak</Text>
            <Text style={styles.progressValue}>{game.progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${game.progress}%` }]} />
          </View>
        </View>

        {timer ? (
          <GameTimerCard
            timer={timer}
            loading={timerLoading}
            errorMessage={timerError}
            onToggle={() => void toggleTimer()}
          />
        ) : null}

        {/* backdatedSessionsV1 */}
        <BackdatedSessionCard
          entityType="GAME"
          entityId={gameId}
        />

        {/* uncertaintyDatesV1 */}
        <ApproximateDateCard
          entityType="GAME"
          entityId={gameId}
        />

        <EntityRelationsPanel entityType="GAME" entityId={gameId} title={game.title} />

        {/* aroundSameTimeV1 */}
        <AroundSameTimeSection
          entityType="GAME"
          entityId={gameId}
        />

        <View style={styles.detailsCard}>
          <DetailRow label="Platforma" value={game.platform} />
          <DetailRow label="Razvojni studio" value={game.developer ?? 'Nije navedeno'} />
          <DetailRow label="Godina izlaska" value={game.releaseYear ? String(game.releaseYear) : 'Nije navedeno'} />
          <DetailRow label="Dojam" value={game.enjoyment ? enjoymentLabels[game.enjoyment] : 'Nije ocijenjeno'} />
          <DetailRow label="Početak igranja" value={game.startedOn ?? 'Nije zabilježeno'} />
          <DetailRow label="Završetak igranja" value={game.finishedOn ?? 'Nije zabilježeno'} />
          {game.igdbId ? <DetailRow label="Online izvor" value={String(game.igdbId)} /> : null}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Uredi igru"
            onPress={() => navigation.navigate('GameForm', { gameId })}
            variant="secondary"
          />
          <View style={styles.actionGap} />
          <PrimaryButton
            label="Obriši igru"
            onPress={confirmDelete}
            loading={deleting}
            variant="danger"
          />
        </View>
      </ScrollView>
      <DeleteConfirmationModal
        visible={confirmVisible}
        itemTitle={game.title}
        title="Obrisati igru?"
        message={`Igra „${game.title}” bit će uklonjena iz kataloga. Spremljena povijest igranja ostaje sačuvana.`}
        loading={deleting}
        errorMessage={deleteError}
        onCancel={cancelDelete}
        onConfirm={() => void deleteGame()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 42 },
  hero: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-end',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 4,
  },
  type: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cover: {
    width: 156,
    height: 234,
    backgroundColor: colors.fillStrong,
    borderRadius: 12,
  },
  coverPlaceholder: {
    width: 156,
    height: 234,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.black,
    borderRadius: 12,
    padding: 16,
  },
  coverMark: {
    position: 'absolute',
    top: -8,
    right: 18,
    color: colors.navySoft,
    fontSize: 82,
    fontWeight: '900',
  },
  coverTitle: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '900' },
  heroJingle: {
    width: 34,
    height: 41,
    marginTop: 9,
  },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 6 },
  favourite: { color: colors.black, fontSize: 25 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 13,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  platform: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  progressCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  progressValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  progressTrack: { height: 8, overflow: 'hidden', backgroundColor: colors.fillStrong, borderRadius: 4, marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: colors.black, borderRadius: 4 },
  detailsCard: {
    marginTop: 18,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: 5 },
  actions: { marginTop: 24 },
  actionGap: { height: 12 },
});
