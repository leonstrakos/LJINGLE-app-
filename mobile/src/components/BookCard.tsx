import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from './BookCover';
import { CatalogueCoverDisplay } from './CatalogueCoverOverride';
import { colors } from '../theme/colors';
// catalogueQuietModeV1
import { useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import { readingStatusLabels, type BookResponse } from '../types/book';

type Props = {
  book: BookResponse;
  onPress: () => void;
};

export function BookCard({ book, onPress }: Props) {
  const compactMode = useCatalogueDisplayMode() === 'compact';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otvori detalje knjige ${book.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compactMode && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      {!compactMode ? (
      <CatalogueCoverDisplay
        entityType="BOOK"
        entityId={book.bookId}
        imageStyle={styles.thumbnail}
      >
        <BookCover
          author={book.author}
          isbn={book.isbn}
          title={book.title}
          size="S"
          style={styles.thumbnail}
        />
      </CatalogueCoverDisplay>
      ) : null}

      <View style={[styles.content, compactMode && styles.contentCompact]}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={compactMode ? 1 : 2}>
            {book.title}
          </Text>
        </View>

        <Text style={styles.author}>
          {book.author}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.year}>
            {book.publishedYear}
          </Text>

          <View
            style={[
              styles.badge,
              book.readingStatus === 'IN_PROGRESS' && styles.inProgressBadge,
              book.readingStatus === 'COMPLETED' && styles.completedBadge,
            ]}
          >
            <Text style={styles.badgeText}>
              {readingStatusLabels[book.readingStatus]}
              {book.progress > 0 ? ` · ${book.progress}%` : ''}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardCompact: { minHeight: 76, paddingVertical: 11 },
  contentCompact: { paddingLeft: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 14,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.992 }],
  },
  thumbnail: {
    width: 54,
    height: 68,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    paddingLeft: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  favourite: {
    color: colors.text,
    fontSize: 17,
    marginLeft: 8,
  },
  author: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 11,
  },
  year: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.fill,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  inProgressBadge: {
    backgroundColor: colors.successSoft,
  },
  completedBadge: {
    backgroundColor: colors.goldSoft,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  arrow: {
    color: '#AEAEB2',
    fontSize: 27,
    lineHeight: 28,
    marginLeft: 10,
  },
});
