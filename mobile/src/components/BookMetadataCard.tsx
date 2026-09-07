import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { BookMetadataCandidate } from '../types/bookMetadata';
import { metadataProviderLabels } from '../types/bookMetadata';

type Props = {
  candidate: BookMetadataCandidate;
  onPress: () => void;
};

// ljingleBookApiBrowseSynopsisR1
function cleanApiBookDescription(value: string | null | undefined) {
  if (!value) return '';

  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function BookMetadataCard({ candidate, onPress }: Props) {
  const isbn = candidate.isbn13 ?? candidate.isbn10;
  const synopsis = cleanApiBookDescription(candidate.description);
  const browseMeta = [
    candidate.publisher,
    candidate.pageCount ? candidate.pageCount + ' str.' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {candidate.coverUrl ? (
        <Image source={{ uri: candidate.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Text style={styles.coverLetter}>{candidate.title?.slice(0, 1) ?? '?'}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>
          {candidate.title ?? 'Bez naslova'}
        </Text>
        <Text numberOfLines={2} style={styles.author}>
          {candidate.authors.length > 0 ? candidate.authors.join(', ') : 'Autor nije naveden'}
        </Text>
        <Text style={styles.details}>
          {[candidate.publishedYear, isbn].filter(Boolean).join(' · ') || 'Nedovršeni metapodaci'}
        </Text>
        <View style={styles.providers}>
          {candidate.sources.map((source) => (
            <View key={`${source.provider}-${source.externalId}`} style={styles.badge}>
              <Text style={styles.badgeText}>{metadataProviderLabels[source.provider]}</Text>
            </View>
          ))}
        </View>
      
        {browseMeta ? (
          <Text
            numberOfLines={1}
            style={styles.apiBrowseMetaR1}
          >
            {browseMeta}
          </Text>
        ) : null}

        {synopsis ? (
          <Text
            ellipsizeMode="tail"
            numberOfLines={4}
            style={styles.apiBrowseSynopsisR1}
          >
            {synopsis}
          </Text>
        ) : null}
</View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ljingleBookApiBrowseSynopsisR1:styles
  apiBrowseMetaR1: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  apiBrowseSynopsisR1: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 12,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.995 }],
  },
  cover: {
    width: 68,
    height: 100,
    borderRadius: 9,
    backgroundColor: colors.fillStrong,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLetter: {
    color: colors.textMuted,
    fontSize: 30,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  author: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  details: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  badge: {
    backgroundColor: colors.fill,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 28,
  },
});
