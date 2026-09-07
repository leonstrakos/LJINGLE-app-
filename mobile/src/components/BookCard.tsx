import { StyleSheet, Text, View } from 'react-native';

import { BookCover } from './BookCover';
import { CatalogueCoverDisplay } from './CatalogueCoverOverride';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
// catalogueQuietModeV1
import { useCatalogueDisplayMode } from '../theme/catalogueDisplayMode';
import { readingStatusLabels, type BookResponse } from '../types/book';

import { celestial, celestialAlpha } from '../theme/celestial';
import { ReaderBookmarkMark } from './ReaderBookmarkMark';
import { AnimatedPressable } from './AnimatedPressable';
import { FreshItemShimmer } from './FreshItemShimmer';
// forkMCelestialSharedComponentsV1
const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const aeroMode = activeVisualSkinId === 'aero';

type Props = {
  book: BookResponse;
  onPress: () => void;
  coverOnly?: boolean;
}; // catalogueBooksGamesCoversV2

export function BookCard({ book, onPress, coverOnly = false }: Props) {
  const compactMode = useCatalogueDisplayMode() === 'compact';

  if (coverOnly && !compactMode) {
    return (
      <AnimatedPressable
      idleBreath
      cue="tap"
        accessibilityRole="button"
        accessibilityLabel={`Otvori detalje knjige ${book.title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.coverOnlyCard, pressed && styles.pressed]}
      >
      {/* ljingleSemanticAliveR21Exact:card */}
      <FreshItemShimmer
        entityKey={'BOOK:' + book.bookId}
        createdAt={
          (book as any).createdAt ??
          (book as any).addedAt ??
          (book as any).modifiedAt ??
          null
        }
      />
        <CatalogueCoverDisplay entityType="BOOK" entityId={book.bookId} imageStyle={styles.coverOnlyImage}>
          <BookCover author={book.author} isbn={book.isbn} title={book.title} size="M" style={styles.coverOnlyImage} />
        </CatalogueCoverDisplay>
        {/* ljingleCompletionSealReaderBookmarksR1:BookCard */}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      idleBreath
      cue="tap"
      accessibilityRole="button"
      accessibilityLabel={`Otvori detalje knjige ${book.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card, aeroMode && styles.aeroCard,
        celestialMode && styles.celestialCard,
        compactMode && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      {/* ljingleSemanticAliveR21Exact:card */}
      <FreshItemShimmer
        entityKey={'BOOK:' + book.bookId}
        createdAt={
          (book as any).createdAt ??
          (book as any).addedAt ??
          (book as any).modifiedAt ??
          null
        }
      />
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
          <Text style={[styles.title, celestialMode && styles.celestialTitle]} numberOfLines={compactMode ? 1 : 2}>
            {book.title}
          </Text>
        </View>

        {book.author.trim() ? (
          <Text style={[styles.author, celestialMode && styles.celestialMuted]}>{book.author}</Text>
        ) : null}

        <View style={styles.bottomRow}>
          {book.publishedYear > 0 ? (
            <Text style={[styles.year, celestialMode && styles.celestialGoldText]}>{book.publishedYear}</Text>
          ) : null}

          <View
            style={[
              styles.badge,
              celestialMode && styles.celestialBadge,
              book.readingStatus === 'IN_PROGRESS' && styles.inProgressBadge,
              book.readingStatus === 'COMPLETED' && styles.completedBadge,
              celestialMode && styles.celestialBadge,
            ]}
          >
            <Text style={[styles.badgeText, celestialMode && styles.celestialBadgeText]}>
              {readingStatusLabels[book.readingStatus]}
              {book.progress > 0 ? ` · ${book.progress}%` : ''}
            </Text>
          </View>
        </View>
      </View>

    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  coverOnlyCard: {
    flex: 1,
    aspectRatio: 0.66,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: colors.fillStrong,
  },
  coverOnlyImage: { width: '100%', height: '100%' },
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
  aeroCard: {
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: colors.navySoft,
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
  celestialTitle: { color: celestial.ivory },
  celestialMuted: { color: celestialAlpha(celestial.ivory, 0.64) },
  celestialGoldText: { color: celestial.gold },
  celestialBadge: {
    backgroundColor: celestialAlpha(celestial.gold, 0.10),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.32),
  },
  celestialBadgeText: { color: celestial.gold },
  celestialArrow: { color: celestial.gold, fontSize: 13, lineHeight: 16 },
  celestialStar: {
    color: celestial.gold,
    fontSize: 10,
    marginLeft: 8,
    opacity: 0.8,
  },

  // ljingleCompletionSealReaderBookmarksR1:BookCardStyles
  coverOnlyBookmarkMark: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  cardBookmarkMark: {
    position: 'absolute',
    left: 50,
    top: 17,
    zIndex: 3,
  },

});

// ljingleCompletionSealRemovalFilterSpacingR2:BookCard

// ljingleTargetedGlyphDeclutterR2:book-card

// ljingleBookCardTrailingGlyphCleanR1
