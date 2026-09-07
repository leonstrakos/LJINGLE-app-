import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { tmdbImageUrl } from '../types/media';

type Props = {
  title: string;
  posterPath: string | null;
  width?: number;
  height?: number;
  fill?: boolean;
}; // mediaGridMatchGamesV4

export function MediaPoster({ title, posterPath, width = 86, height = 128, fill = false }: Props) {
  const uri = tmdbImageUrl(posterPath);
  if (uri) {
    return (
      <Image
        accessibilityLabel={`Poster: ${title}`}
        source={{ uri }}
        style={[styles.poster, fill ? styles.fill : { width, height }]}
      />
    );
  }

  return (
    <View style={[styles.poster, styles.placeholder, fill ? styles.fill : { width, height }]}>
      <Text style={styles.mark}>▶</Text>
      <Text numberOfLines={3} style={styles.placeholderTitle}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  poster: {
    borderRadius: 12,
    backgroundColor: colors.fillStrong,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  mark: {
    color: colors.textMuted,
    fontSize: 20,
  },
  placeholderTitle: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 7,
  },
});
