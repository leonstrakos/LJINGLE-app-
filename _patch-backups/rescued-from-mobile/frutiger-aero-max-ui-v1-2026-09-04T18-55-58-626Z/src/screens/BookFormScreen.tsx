import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackView } from '../components/FeedbackView';
import { PrimaryButton } from '../components/PrimaryButton';
import { bookApi } from '../services/bookApi';
import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
import { semanticFeedback } from '../utils/semanticFeedback';
import {
  enjoymentLabels,
  enjoymentOptions,
  readingStatusLabels,
  readingStatuses,
  type BookRequest,
  type Enjoyment,
  type ReadingStatus,
} from '../types/book';
import type { RootStackParamList } from '../types/navigation';
import type { CollectionSummary } from '../types/collection';
import { createdFeedback } from '../utils/crudFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'BookForm'>;

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98989D"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function BookFormScreen({ route, navigation }: Props) {
  const bookId = route.params?.bookId;
  const editing = Boolean(bookId);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publishedYear, setPublishedYear] = useState('');
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('LATER');
  // // catalogueJingleProgressSemanticsV1:BookProgress
  const [legacyProgress, setLegacyProgress] = useState('0');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [enjoyment, setEnjoyment] = useState<Enjoyment | null>(null);
  const [favourite, setFavourite] = useState(false);
  const [startedOn, setStartedOn] = useState('');
  const [finishedOn, setFinishedOn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allCollections, setAllCollections] = useState<CollectionSummary[]>([]);
  const [bookCollectionIds, setBookCollectionIds] = useState<string[]>([]);
  const [collectionBusy, setCollectionBusy] = useState<string | null>(null); // catalogueFinalPolishV1

  useEffect(() => {
    if (!bookId) return;

    const loadBook = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const book = await bookApi.getById(bookId);
        setTitle(book.title);
        setAuthor(book.author || '');
        setIsbn(book.isbn || '');
        setPublishedYear(book.publishedYear > 0 ? String(book.publishedYear) : '');
        setReadingStatus(book.readingStatus);
        setLegacyProgress(String(book.progress));
        setTotalPages(
          book.totalPages
            ? String(book.totalPages)
            : '',
        );
        setCurrentPage(
          book.currentPage !== null
            ? String(book.currentPage)
            : '',
        );
        setEnjoyment(book.enjoyment);
        setFavourite(book.favourite);
        setStartedOn(book.startedOn ?? '');
        setFinishedOn(book.finishedOn ?? '');
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : 'Dohvat knjige nije uspio.');
      } finally {
        setLoading(false);
      }
    };

    void loadBook();
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    void Promise.all([
      collectionApi.getAll(),
      collectionApi.getForEntity('BOOK', bookId),
    ]).then(([collections, memberships]) => {
      if (!active) return;
      setAllCollections(collections);
      setBookCollectionIds(memberships.map((item) => item.collectionId));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [bookId]);

  const toggleBookCollection = async (collection: CollectionSummary) => {
    if (!bookId || collectionBusy) return;
    setCollectionBusy(collection.collectionId);
    try {
      if (bookCollectionIds.includes(collection.collectionId)) {
        const detail = await collectionApi.getById(collection.collectionId);
        const membership = detail.items.find((item) => item.entityType === 'BOOK' && item.entityId === bookId);
        if (membership) await collectionApi.removeItem(collection.collectionId, membership.itemId);
      } else {
        await collectionApi.addItem(collection.collectionId, 'BOOK', bookId);
      }
      const memberships = await collectionApi.getForEntity('BOOK', bookId);
      setBookCollectionIds(memberships.map((item) => item.collectionId));
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Kolekcija nije promijenjena.');
    } finally {
      setCollectionBusy(null);
    }
  };

  const validate = (): BookRequest | null => {
    const nextErrors: Record<string, string> = {};
    const numericYear = Number(publishedYear);
    const numericTotalPages =
      Number(totalPages);
    const numericCurrentPage =
      currentPage.trim()
        ? Number(currentPage)
        : 0;
    const maxYear = new Date().getFullYear() + 1;

    if (!title.trim()) nextErrors.title = 'Naslov ne smije biti prazan.';
    if (
      publishedYear.trim() &&
      (!Number.isInteger(numericYear) || numericYear <= 0 || numericYear > maxYear)
    ) {
      nextErrors.publishedYear = `Godina mora biti između 1 i ${maxYear}.`;
    }
    if (
      totalPages.trim() &&
      (
        !Number.isInteger(
          numericTotalPages,
        ) ||
        numericTotalPages <= 0
      )
    ) {
      nextErrors.totalPages =
        'Broj stranica mora biti pozitivan cijeli broj.';
    }

    if (
      currentPage.trim() &&
      (
        !Number.isInteger(
          numericCurrentPage,
        ) ||
        numericCurrentPage < 0
      )
    ) {
      nextErrors.currentPage =
        'Trenutna stranica mora biti 0 ili veća.';
    }

    if (
      !nextErrors.totalPages &&
      !nextErrors.currentPage &&
      totalPages.trim() &&
      currentPage.trim() &&
      numericCurrentPage >
        numericTotalPages
    ) {
      nextErrors.currentPage =
        'Trenutna stranica ne može biti veća od ukupnog broja stranica.';
    }
    if (startedOn && !isValidIsoDate(startedOn)) {
      nextErrors.startedOn = 'Koristite valjani datum u obliku GGGG-MM-DD.';
    }
    if (finishedOn && !isValidIsoDate(finishedOn)) {
      nextErrors.finishedOn = 'Koristite valjani datum u obliku GGGG-MM-DD.';
    }
    if (!nextErrors.startedOn && !nextErrors.finishedOn && startedOn && finishedOn && finishedOn < startedOn) {
      nextErrors.finishedOn = 'Datum završetka ne može biti prije početka.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const derivedProgress =
      totalPages.trim() &&
      Number.isInteger(
        numericTotalPages,
      ) &&
      numericTotalPages > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                numericCurrentPage /
                  numericTotalPages *
                  100,
              ),
            ),
          )
        : Number(
            legacyProgress,
          ) || 0;

    return {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      publishedYear: publishedYear.trim() ? numericYear : 0,
      readingStatus,
      progress: derivedProgress,
      totalPages:
        totalPages.trim()
          ? numericTotalPages
          : null,
      currentPage:
        currentPage.trim()
          ? numericCurrentPage
          : null,
      enjoyment,
      favourite,
      startedOn: startedOn || null,
      finishedOn: finishedOn || null,
    };
  };

  const save = async () => {
    const payload = validate();
    if (!payload) return;

    setSaveError(null);

    setSaving(true);
    try {
      if (bookId) {
        await bookApi.update(bookId, payload);
      } else {
        await bookApi.create(payload);

        createdFeedback();
      }
      navigation.goBack();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Pokušajte ponovno.';
      setSaveError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Spremanje nije uspjelo', message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FeedbackView type="loading" message="Učitavanje podataka…" />;
  }

  if (loadError) {
    return <FeedbackView type="error" message={loadError} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{editing ? 'Uređivanje' : 'Dodavanje'}</Text>
            <Text style={styles.heading}>{editing ? 'Uredi knjigu' : 'Nova knjiga'}</Text>
            <Text style={styles.introText}>
              {editing
                ? 'Promijenite podatke koje želite ažurirati.'
                : 'Unesite osnovne podatke i dodajte knjigu u zbirku.'}
            </Text>
          </View>

          <View style={styles.formCard}>
            <FormField
              label="Naslov *"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setErrors((current) => ({ ...current, title: '' }));
              }}
              placeholder="npr. Sto godina samoće"
              error={errors.title}
            />
            <FormField
              label="Autor"
              value={author}
              onChangeText={(value) => {
                setAuthor(value);
                setErrors((current) => ({ ...current, author: '' }));
              }}
              placeholder="npr. Gabriel García Márquez"
              error={errors.author}
              autoCapitalize="words"
            />
            <FormField
              label="ISBN"
              value={isbn}
              onChangeText={(value) => {
                setIsbn(value);
                setErrors((current) => ({ ...current, isbn: '' }));
              }}
              placeholder="978-…"
              error={errors.isbn}
              autoCapitalize="none"
            />
            <FormField
              label="Godina izdanja"
              value={publishedYear}
              onChangeText={(value) => {
                setPublishedYear(value.replace(/[^0-9]/g, ''));
                setErrors((current) => ({ ...current, publishedYear: '' }));
              }}
              placeholder="npr. 1967"
              error={errors.publishedYear}
              keyboardType="number-pad"
              autoCapitalize="none"
            />

            <View style={styles.field}>
              <Text style={styles.label}>Status čitanja</Text>
              <View style={styles.choiceList}>
                {readingStatuses.map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    onPress={() => {
                      if (
                        status === 'COMPLETED' &&
                        readingStatus !== 'COMPLETED'
                      ) {
                        // semanticCompletionFeedbackV1
                        void semanticFeedback.complete();
                      }

                      setReadingStatus(status);

                      if (
                        status === 'COMPLETED' &&
                        totalPages.trim()
                      ) {
                        setCurrentPage(
                          totalPages,
                        );
                      }
                    }}
                    style={[styles.choice, readingStatus === status && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, readingStatus === status && styles.choiceTextSelected]}>
                      {readingStatusLabels[status]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <FormField
              label="Broj stranica"
              value={totalPages}
              onChangeText={(value) => {
                setTotalPages(
                  value.replace(
                    /[^0-9]/g,
                    '',
                  ),
                );

                setErrors((current) => ({
                  ...current,
                  totalPages: '',
                  currentPage: '',
                }));
              }}
              placeholder="npr. 320"
              error={errors.totalPages}
              keyboardType="number-pad"
              autoCapitalize="none"
            />

            <FormField
              label="Trenutna stranica"
              value={currentPage}
              onChangeText={(value) => {
                setCurrentPage(
                  value.replace(
                    /[^0-9]/g,
                    '',
                  ),
                );

                setErrors((current) => ({
                  ...current,
                  currentPage: '',
                }));
              }}
              placeholder="npr. 147"
              error={errors.currentPage}
              keyboardType="number-pad"
              autoCapitalize="none"
            />

            {totalPages.trim() ? (
              <Text style={styles.calculatedProgress}>
                Napredak · {
                  Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round(
                        (
                          Number(
                            currentPage ||
                              0,
                          ) /
                          Math.max(
                            1,
                            Number(
                              totalPages,
                            ),
                          )
                        ) *
                          100,
                      ),
                    ),
                  )
                }%
              </Text>
            ) : null}

            {editing && allCollections.length > 0 ? (
              <View style={styles.field}>
                <Text style={styles.label}>Kolekcije</Text>
                <View style={styles.choiceList}>
                  {allCollections.map((collection) => {
                    const active = bookCollectionIds.includes(collection.collectionId);
                    return (
                      <Pressable
                        key={collection.collectionId}
                        accessibilityRole="button"
                        disabled={collectionBusy !== null}
                        onPress={() => void toggleBookCollection(collection)}
                        style={[styles.choice, active && styles.choiceSelected, collectionBusy === collection.collectionId && { opacity: 0.55 }]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextSelected]}>
                          {collection.symbol ? `${collection.symbol} ${collection.name}` : collection.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Kako ti je bilo?</Text>
              <View style={styles.choiceList}>
                {enjoymentOptions.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => setEnjoyment(enjoyment === option ? null : option)}
                    style={[styles.choice, enjoyment === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, enjoyment === option && styles.choiceTextSelected]}>
                      {enjoymentLabels[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.optionalHint}>Nije obvezno; ponovno dodirni odabrano za poništavanje.</Text>
            </View>

            <FormField
              label="Datum početka"
              value={startedOn}
              onChangeText={(value) => {
                setStartedOn(value);
                setErrors((current) => ({ ...current, startedOn: '', finishedOn: '' }));
              }}
              placeholder="GGGG-MM-DD"
              error={errors.startedOn}
              autoCapitalize="none"
            />
            <FormField
              label="Datum završetka"
              value={finishedOn}
              onChangeText={(value) => {
                setFinishedOn(value);
                setErrors((current) => ({ ...current, finishedOn: '' }));
              }}
              placeholder="GGGG-MM-DD"
              error={errors.finishedOn}
              autoCapitalize="none"
            />


          </View>

          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <View style={styles.saveArea}>
            <PrimaryButton
              label={editing ? 'Spremi promjene' : 'Dodaj knjigu'}
              onPress={() => void save()}
              loading={saving}
            />
            <Text style={styles.required}>Samo je naslov obvezan.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  intro: {
    paddingHorizontal: 6,
    marginBottom: 22,
  },
  eyebrow: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 15,
  },
  heading: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 3,
  },
  introText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    color: colors.text,
    backgroundColor: colors.fill,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  choiceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 38,
    justifyContent: 'center',
    backgroundColor: colors.fill,
    borderRadius: 19,
    paddingHorizontal: 14,
  },
  choiceSelected: {
    backgroundColor: colors.black,
  },
  choiceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: colors.white,
  },
  optionalHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingTop: 17,
  },
  switchCopy: {
    flex: 1,
    paddingRight: 12,
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  saveError: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 10,
  },
  saveArea: {
    marginTop: 18,
  },
  required: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 12,
  },
  // // catalogueJingleProgressSemanticsV1:BookCalculatedProgress
  calculatedProgress: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 18,
  },

});

// catalogueJingleProgressSemanticsV1
