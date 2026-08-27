// jingleReasonV1
import { JingleReasonCard } from '../components/JingleReasonCard';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueCoverDisplay, CatalogueCoverOverrideControls } from '../components/CatalogueCoverOverride';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
// aroundSameTimeV1
import { AroundSameTimeSection } from '../components/AroundSameTimeSection';
// backdatedSessionsV1
import { BackdatedSessionCard } from '../components/BackdatedSessionCard';
// uncertaintyDatesV1
import { ApproximateDateCard } from '../components/ApproximateDateCard';

import { FeedbackView } from '../components/FeedbackView';
import { BookCover } from '../components/BookCover';
import { PrimaryButton } from '../components/PrimaryButton';
import { ReadingTimerCard } from '../components/ReadingTimerCard';
import { activityApi } from '../services/activityApi';
import { bookApi } from '../services/bookApi';
import { deleteCatalogueCoverOverride } from '../services/catalogueCoverOverrides';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import type { ActivityTimerResponse } from '../types/activity';
import { enjoymentLabels, readingStatusLabels, type BookResponse } from '../types/book';
import type { RootStackParamList } from '../types/navigation';
import { deletedFeedback } from '../utils/crudFeedback';
import { TimerMotionView } from '../components/TimerMotionView';
import { semanticFeedback } from '../utils/semanticFeedback';

import { celestial, celestialAlpha } from '../theme/celestial';
import { JingleBellIcon } from '../components/JingleBellIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetails'>;

const celestialMode = activeVisualSkinId === 'classic';

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function BookDetailsScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const [book, setBook] = useState<BookResponse | null>(null);
  const [readingTimer, setReadingTimer] = useState<ActivityTimerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jingleBusy, setJingleBusy] = useState(false);

  const loadBook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedBook, loadedTimer] = await Promise.all([
        bookApi.getById(bookId),
        activityApi.getReadingTimer(bookId),
      ]);
      setBook(loadedBook);
      setReadingTimer(loadedTimer);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat knjige nije uspio.');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void loadBook();
    return navigation.addListener('focus', () => {
      void loadBook();
    });
  }, [loadBook, navigation]);

  const toggleJingle = async () => {
    if (
      !book ||
      jingleBusy
    ) {
      return;
    }

    setJingleBusy(true);

    try {
      const updated =
        await bookApi.setFavourite(
          book.bookId,
          !book.favourite,
        );

      setBook(updated);

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

  const confirmDelete = () => {
    if (!book) return;
    setDeleteError(null);
    setConfirmVisible(true);
  };

  const toggleReadingTimer = async () => {
    if (!readingTimer || timerLoading) return;
    setTimerLoading(true);
    setTimerError(null);
    try {
      const updated = readingTimer.running
        ? await activityApi.stopReading(bookId)
        : await activityApi.startReading(bookId);
      setReadingTimer(updated);

      void (updated.running

        ? semanticFeedback.timerStart()

        : semanticFeedback.timerStop());
    } catch (caught) {
      setTimerError(
        caught instanceof Error ? caught.message : 'Promjena timera nije uspjela.',
      );
    } finally {
      setTimerLoading(false);
    }
  };

  const deleteBook = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      if (readingTimer?.running && readingTimer.activityId) {
        await activityApi.stop(readingTimer.activityId);
      }
      await bookApi.remove(bookId);

      deletedFeedback();
      await deleteCatalogueCoverOverride('BOOK', bookId).catch(() => undefined);
      setConfirmVisible(false);
      navigation.goBack();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : 'Brisanje nije uspjelo. Pokušajte ponovno.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setConfirmVisible(false);
    setDeleteError(null);
  };

  if (loading && !book) {
    return <FeedbackView type="loading" />;
  }

  if (error || !book) {
    return (
      <FeedbackView
        type="error"
        message={error ?? 'Knjiga nije pronađena.'}
        onRetry={() => void loadBook()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* bookDetailCoverParityV1 */}
        <View style={[styles.hero, celestialMode && styles.celestialHero]}>
          <CelestialAtmosphere variant="detail" />
          {celestialMode ? <CelestialAtmosphere variant="books" /> : null}
          <CatalogueCoverDisplay
            entityType="BOOK"
            entityId={bookId}
            imageStyle={styles.cover}
          >
            <BookCover
              author={book.author}
              isbn={book.isbn}
              title={book.title}
              size="L"
              style={styles.cover}
            />
          </CatalogueCoverDisplay>

          <View style={styles.heroText}>
            <Text style={[styles.type, celestialMode && styles.celestialType]}>KNJIGA</Text>
            <Text numberOfLines={4} style={styles.title}>
              {book.title}
            </Text>

            {book.author.trim() ? (
              <Text numberOfLines={2} style={styles.subtitle}>
                {book.author}
              </Text>
            ) : null}

            {book.publishedYear > 0 ? (
              <Text style={styles.year}>{book.publishedYear}</Text>
            ) : null}

            <View style={styles.heroStatusRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {readingStatusLabels[book.readingStatus]}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  book.favourite
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
                  active={book.favourite}
                  inactiveOpacity={0.28}
                  style={styles.heroJingle}
                />
              </Pressable>
            </View>
          </View>
        </View>
<CatalogueCoverOverrideControls
          entityType="BOOK"
          entityId={bookId}
        />


        {book.favourite ? (
          <JingleReasonCard
            entityType="BOOK"
            entityId={book.bookId}
          />
        ) : null}

        <View style={[styles.progressCard, celestialMode && styles.celestialCard]}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>Napredak</Text>
              {book.totalPages ? (
                <Text style={styles.pageProgress}>
                  {book.currentPage ?? 0} / {book.totalPages} str.
                </Text>
              ) : null}
            </View>
            <Text style={styles.progressValue}>{book.progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, celestialMode && styles.celestialProgressFill, { width: `${book.progress}%` }]} />
          </View>
        </View>

        {readingTimer ? (
          <TimerMotionView active={readingTimer.running}>
            <ReadingTimerCard
            timer={readingTimer}
            loading={timerLoading}
            errorMessage={timerError}
            onToggle={() => void toggleReadingTimer()}
          />
          </TimerMotionView>
        ) : null}

        {/* backdatedSessionsV1 */}
        <BackdatedSessionCard
          entityType="BOOK"
          entityId={bookId}
        />

        {/* uncertaintyDatesV1 */}
        <ApproximateDateCard
          entityType="BOOK"
          entityId={bookId}
        />

        <EntityRelationsPanel entityType="BOOK" entityId={bookId} title={book.title} />

        {/* aroundSameTimeV1 */}
        <AroundSameTimeSection
          entityType="BOOK"
          entityId={bookId}
        />

        <View style={[styles.detailsCard, celestialMode && styles.celestialCard]}>
          {book.author.trim() ? (
            <DetailRow label="Autor" value={book.author} />
          ) : null}
          {book.isbn.trim() ? (
            <DetailRow label="ISBN" value={book.isbn} />
          ) : null}
          {book.publishedYear > 0 ? (
            <DetailRow label="Godina izdanja" value={String(book.publishedYear)} />
          ) : null}
          <DetailRow label="Dojam" value={book.enjoyment ? enjoymentLabels[book.enjoyment] : 'Nije ocijenjeno'} />
          <DetailRow label="Početak čitanja" value={book.startedOn ?? 'Nije zabilježeno'} />
          <DetailRow label="Završetak čitanja" value={book.finishedOn ?? 'Nije zabilježeno'} />
          <DetailRow label="Identifikator" value={book.bookId} />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Uredi knjigu"
            onPress={() => navigation.navigate('BookForm', { bookId })}
            variant="secondary"
          />
          <View style={styles.actionGap} />
          <PrimaryButton
            label="Obriši knjigu"
            onPress={confirmDelete}
            loading={deleting}
            variant="danger"
          />
        </View>
      </ScrollView>

      <DeleteConfirmationModal
        visible={confirmVisible}
        bookTitle={book.title}
        loading={deleting}
        errorMessage={deleteError}
        onCancel={cancelDelete}
        onConfirm={() => void deleteBook()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
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
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  year: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 5,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  cover: {
    width: 156,
    height: 234,
    backgroundColor: colors.fillStrong,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverMark: {
    position: 'absolute',
    top: 8,
    right: 22,
    color: colors.navySoft,
    fontSize: 112,
    fontWeight: '900',
  },
  coverLine: {
    width: 44,
    height: 4,
    backgroundColor: colors.gold,
    marginBottom: 18,
  },
  coverTitle: {
    color: colors.cream,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  coverAuthor: {
    color: colors.goldSoft,
    fontSize: 16,
    marginTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 18,
  },
  statusBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  // // catalogueJingleProgressSemanticsV1:BookJingle
  heroJingleButton: {
    marginLeft: 4,
  },
  heroJingle: {
    width: 29,
    height: 35,
  },
  pageProgress: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  progressCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  progressValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
    borderRadius: 4,
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.black,
    borderRadius: 4,
  },
  detailsCard: {
    marginTop: 18,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 5,
  },
  actions: {
    marginTop: 24,
  },
  actionGap: {
    height: 12,
  },
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
  celestialType: {
    color: celestial.gold,
    letterSpacing: 1.2,
  },
  celestialProgressFill: {
    backgroundColor: celestial.gold,
  },

});

// catalogueJingleProgressSemanticsV1
