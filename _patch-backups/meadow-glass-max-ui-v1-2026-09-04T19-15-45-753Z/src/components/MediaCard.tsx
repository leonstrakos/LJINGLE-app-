import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
// catalogueQuietModeV1
import { useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import {
  mediaTypeLabels,
  watchStatusLabels,
  type MediaResponse,
} from '../types/media';
import { CatalogueCoverDisplay } from './CatalogueCoverOverride';

// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';
const aeroMode = activeVisualSkinId === 'aero';
import { MediaPoster } from './MediaPoster';

import { celestial, celestialAlpha } from '../theme/celestial';
type Props = {
  item: MediaResponse;
  onPress: () => void;
};

export function MediaCard({ item, onPress }: Props) {
  const compactMode = useCatalogueDisplayMode() === 'compact';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card, aeroMode && styles.aeroCard,
        celestialMode && styles.celestialCard,
        compactMode && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      {!compactMode ? (
        <CatalogueCoverDisplay
          entityType={item.mediaType}
          entityId={item.mediaId}
          imageStyle={{
            width: 86,
            height: 128,
            borderRadius: 12,
            backgroundColor: colors.fillStrong,
          }}
        >
          <MediaPoster
            title={item.title}
            posterPath={item.posterPath}
          />
        </CatalogueCoverDisplay>
      ) : null}
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={[styles.type, celestialMode && styles.celestialType]}>{mediaTypeLabels[item.mediaType]}</Text>
        </View>
        <Text numberOfLines={compactMode ? 1 : 2} style={[styles.title, celestialMode && styles.celestialTitle]}>{item.title}</Text>
        <Text style={[styles.subtitle, celestialMode && styles.celestialMuted]}>
          {[item.releaseYear, watchStatusLabels[item.watchStatus]].filter(Boolean).join(' · ')}
        </Text>
        {!compactMode ? (
          <>
            <View style={[styles.progressTrack, celestialMode && styles.celestialTrack]}>
              <View style={[styles.progressFill, celestialMode && styles.celestialFill, { width: `${item.progress}%` }]} />
            </View>
            <Text style={[styles.progressLabel, celestialMode && styles.celestialProgressLabel]}>{item.progress}%</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardCompact: { minHeight: 82, paddingVertical: 11 },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.995 }],
  },
  content: {
    // mobileStabilityUiPolishV1
    flex: 1,
    minWidth: 0,
    paddingVertical: 3,
    paddingRight: 40,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  star: {
    color: colors.text,
    fontSize: 15,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: 7,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.fillStrong,
    marginTop: 15,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.black,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  aeroCard: {
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#087CB8',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  celestialCard: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.42),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  celestialType: { color: celestial.gold, letterSpacing: 1.05 },
  celestialTitle: { color: celestial.ivory },
  celestialMuted: { color: celestialAlpha(celestial.ivory, 0.64) },
  celestialTrack: {
    backgroundColor: celestialAlpha(celestial.ivory, 0.08),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.20),
  },
  celestialFill: { backgroundColor: celestial.gold },
  celestialProgressLabel: { color: celestial.gold },
  celestialStar: {
    color: celestial.gold,
    fontSize: 10,
    opacity: 0.82,
  },
  celestialProgressFill: {
    backgroundColor: celestial.gold,
  },

});
