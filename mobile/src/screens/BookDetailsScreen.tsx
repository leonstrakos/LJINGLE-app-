// jingleReasonV1
import { JingleReasonCard } from '../components/JingleReasonCard';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { PrimaryButton } from '../components/PrimaryButton';
import { ReadingTimerCard } from '../components/ReadingTimerCard';
import { activityApi } from '../services/activityApi';
import { bookApi } from '../services/bookApi';
import { deleteCatalogueCoverOverride } from '../services/catalogueCoverOverrides';
import { colors } from '../theme/colors';
import type { ActivityTimerResponse } from '../types/activity';
import { enjoymentLabels, readingStatusLabels, type BookResponse } from '../types/book';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetails'>;

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
        <CatalogueCoverDisplay
          entityType="BOOK"
          entityId={bookId}
          imageStyle={styles.cover}
        >
          <View style={styles.cover}>
            <Text style={styles.coverMark}>L</Text>
            <View style={styles.coverLine} />
            <Text style={styles.coverTitle} numberOfLines={4}>
              {book.title}
            </Text>
            <Text style={styles.coverAuthor}>{book.author}</Text>
          </View>
        </CatalogueCoverDisplay>

        <CatalogueCoverOverrideControls
          entityType="BOOK"
          entityId={bookId}
        />

        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>●  {readingStatusLabels[book.readingStatus]}</Text>
          </View>
          {book.favourite ? <Text accessibilityLabel="Favorit" style={styles.favourite}>★ Favorit</Text> : null}
        </View>

        {book.favourite ? (
          <JingleReasonCard
            entityType="BOOK"
            entityId={book.bookId}
          />
        ) : null}

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Napredak</Text>
            <Text style={styles.progressValue}>{book.progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${book.progress}%` }]} />
          </View>
        </View>

        {readingTimer ? (
          <ReadingTimerCard
            timer={readingTimer}
            loading={timerLoading}
            errorMessage={timerError}
            onToggle={() => void toggleReadingTimer()}
          />
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

        <View style={styles.detailsCard}>
          <DetailRow label="Autor" value={book.author} />
          <DetailRow label="ISBN" value={book.isbn} />
          <DetailRow label="Godina izdanja" value={String(book.publishedYear)} />
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
  cover: {
    minHeight: 270,
    justifyContent: 'flex-end',
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
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
  favourite: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
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
});
