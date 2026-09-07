import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CatalogueCoverDisplay } from '../../components/CatalogueCoverOverride';
import { colors } from '../../theme/colors';
import { activeVisualSkinId } from '../../theme/visualSkins';
// catalogueQuietModeV1
import { useCatalogueDisplayMode } from '../../theme/catalogueDisplayMode';
import { gameStatusLabels, type GameResponse } from '../types/game';

import { celestial, celestialAlpha } from '../../theme/celestial';
type Props = {
  game: GameResponse;
  onPress: () => void;
  coverOnly?: boolean;
}; // catalogueBooksGamesCoversV2

const celestialMode = activeVisualSkinId === 'classic';

export function GameCard({ game, onPress, coverOnly = false }: Props) {
  const compactMode = useCatalogueDisplayMode() === 'compact';

  if (coverOnly && !compactMode) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Otvori igru ${game.title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.coverOnlyCard, pressed && styles.pressed]}
      >
        <CatalogueCoverDisplay entityType="GAME" entityId={game.gameId} imageStyle={styles.coverOnlyImage}>
          {game.coverUrl ? <Image source={{ uri: game.coverUrl }} resizeMode="cover" style={styles.coverOnlyImage} /> : <View style={styles.coverOnlyPlaceholder}><Text style={styles.missingCoverTitle}>{game.title}</Text></View>}
        </CatalogueCoverDisplay>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otvori igru ${game.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        celestialMode && styles.celestialCard,
        compactMode && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      {!compactMode ? (
        <CatalogueCoverDisplay
          entityType="GAME"
          entityId={game.gameId}
          imageStyle={styles.cover}
        >
          {game.coverUrl ? (
            <Image
              source={{ uri: game.coverUrl }}
              resizeMode="cover"
              style={styles.cover}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.missingCoverTitle}>{game.title}</Text>
            </View>
          )}
        </CatalogueCoverDisplay>
      ) : null}

      <View style={[styles.copy, compactMode && styles.copyCompact]}>
        <View style={styles.titleRow}>
          <Text numberOfLines={compactMode ? 1 : 2} style={styles.title}>
            {game.title}{game.dnf ? ' *' : ''}
          </Text>
          {celestialMode ? <Text style={styles.celestialStar}>✦</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {[game.developer, game.releaseYear].filter(Boolean).join(' · ') || 'Podaci nisu uneseni'}
        </Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {gameStatusLabels[game.gameStatus]}{game.dnf ? ' *' : ''}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.platform}>{game.platform}</Text>
        </View>
        {!compactMode ? (
          <>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, celestialMode && styles.celestialProgressFill, { width: `${game.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{game.progress}%</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  coverOnlyCard: { flex: 1, aspectRatio: 0.66, overflow: 'hidden', borderRadius: 14, backgroundColor: colors.fillStrong },
  coverOnlyImage: { width: '100%', height: '100%' },
  coverOnlyPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black },
  cardCompact: { minHeight: 0 },
  copyCompact: { paddingVertical: 12, paddingHorizontal: 14 },
  card: {
    minHeight: 160,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 18,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.995 }],
  },
  cover: {
    width: 112,
    minHeight: 160,
    backgroundColor: colors.fillStrong,
  },
  placeholder: {
    width: 112,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.black,
  },
  missingCoverTitle: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 8,
  }, // gridTitlesMediaSwitchV31
  placeholderMark: {
    color: colors.white,
    fontSize: 54,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
    padding: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  star: {
    color: colors.black,
    fontSize: 17,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.fill,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  platform: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
    borderRadius: 3,
    marginTop: 13,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.black,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  celestialCard: {
    borderColor: celestialAlpha(celestial.gold, 0.36),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  celestialStar: {
    color: celestial.gold,
    fontSize: 10,
    marginTop: 4,
    opacity: 0.82,
  },
  celestialProgressFill: {
    backgroundColor: celestial.gold,
  },

});
