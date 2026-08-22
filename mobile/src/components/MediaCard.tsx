import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
// catalogueQuietModeV1
import { useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import {
  mediaTypeLabels,
  watchStatusLabels,
  type MediaResponse,
} from '../types/media';
import { CatalogueCoverDisplay } from './CatalogueCoverOverride';
import { MediaPoster } from './MediaPoster';

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
        styles.card,
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
          <Text style={styles.type}>{mediaTypeLabels[item.mediaType]}</Text>
        </View>
        <Text numberOfLines={compactMode ? 1 : 2} style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>
          {[item.releaseYear, watchStatusLabels[item.watchStatus]].filter(Boolean).join(' · ')}
        </Text>
        {!compactMode ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{item.progress}%</Text>
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
    flex: 1,
    minWidth: 0,
    paddingVertical: 3,
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
});
