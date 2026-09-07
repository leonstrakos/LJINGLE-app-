import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { BookImportPreview } from '../components/BookImportPreview';
import { BookMetadataCard } from '../components/BookMetadataCard';
import { bookMetadataApi } from '../services/bookMetadataApi';
import { ApiError } from '../services/apiClient';
import { createdFeedback } from '../utils/crudFeedback';
import { colors } from '../theme/colors';
import type {
  BookImportPreviewResponse,
  BookImportResultResponse,
  BookMetadataCandidate,
  MetadataProvider,
} from '../types/bookMetadata';

type SearchMode = 'TEXT' | 'ISBN';
type ProviderFilter = MetadataProvider | 'ALL';

type Props = {
  onImported?: (result: BookImportResultResponse) => void;
};

export function BookMetadataImportScreen({ onImported }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('TEXT');
  const [provider, setProvider] = useState<ProviderFilter>('ALL');
  const [results, setResults] = useState<BookMetadataCandidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState<BookImportPreviewResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const value = query.trim();
    if (!value) {
      setError('Unesite naslov, autora ili ISBN.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    try {
      if (mode === 'ISBN') {
        const response = await bookMetadataApi.lookupIsbn(value);
        setResults(response.candidate ? [response.candidate] : []);
        setWarnings(response.warnings);
      } else {
        const response = await bookMetadataApi.search(
          value,
          provider === 'ALL' ? undefined : provider,
        );
        setResults(response.results);
        setWarnings(response.warnings);
      }
      setSearched(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Pretraga nije uspjela.');
    } finally {
      setLoading(false);
    }
  }, [mode, provider, query]);

  const openPreview = useCallback(async (candidate: BookMetadataCandidate) => {
    const source = candidate.sources[0];
    if (!source) {
      setError('Rezultat nema izvor koji se može uvesti.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPreview(await bookMetadataApi.previewImport({ source }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Pregled uvoza nije uspio.');
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmImport = useCallback(async (confirmMetadataUpdate: boolean) => {
    if (!preview) {
      return;
    }
    const source = preview.candidate.sources[0];
    if (!source) {
      setError('Rezultat nema izvor koji se može uvesti.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await bookMetadataApi.confirmImport({
        source,
        targetBookId: preview.existingBook?.bookId,
        confirmMetadataUpdate,
      });
      // bookApiCreateSoundR1
      if (result.action === 'CREATE') {
        createdFeedback();
      }
      setSuccess(
        result.action === 'CREATE'
          ? `Knjiga „${result.book.title}” dodana je u katalog.`
          : `Metapodaci za „${result.book.title}” su usklađeni.`,
      );
      setPreview(null);
      onImported?.(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Uvoz nije uspio.');
    } finally {
      setImporting(false);
    }
  }, [onImported, preview]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <AeroAtmosphere variant="books" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>METAPODACI KNJIGA</Text>
        <Text style={styles.heading}>Pronađi i uvezi</Text>
        <Text style={styles.intro}>
          Pretraži Open Library i Google Books, pregledaj podudaranja i potvrdi prije zapisa.
        </Text>

        <View style={styles.segmented}>
          {(['TEXT', 'ISBN'] as SearchMode[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => setMode(value)}
              style={[styles.segment, mode === value && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>
                {value === 'TEXT' ? 'Naslov / autor' : 'ISBN'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'TEXT' ? (
          <View style={styles.filters}>
            {(['ALL', 'OPEN_LIBRARY', 'GOOGLE_BOOKS'] as ProviderFilter[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => setProvider(value)}
                style={[styles.filter, provider === value && styles.filterActive]}
              >
                <Text style={[styles.filterText, provider === value && styles.filterTextActive]}>
                  {value === 'ALL' ? 'Oba izvora' : value === 'OPEN_LIBRARY' ? 'Open Library' : 'Google Books'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.searchRow}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder={mode === 'ISBN' ? '978…' : 'Naslov ili autor'}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <Pressable onPress={runSearch} style={styles.searchButton}>
            {loading && !preview ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.searchButtonText}>Traži</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {warnings.map((warning) => (
          <Text key={warning} style={styles.warning}>• {warning}</Text>
        ))}

        {preview ? (
          <BookImportPreview
            loading={importing}
            onCancel={() => setPreview(null)}
            onConfirm={confirmImport}
            preview={preview}
          />
        ) : (
          <View style={styles.results}>
            {searched && results.length === 0 && !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nema rezultata</Text>
                <Text style={styles.emptyText}>Pokušajte s drugim naslovom, autorom ili ISBN-om.</Text>
              </View>
            ) : null}
            {results.map((candidate) => (
              <BookMetadataCard
                candidate={candidate}
                key={candidate.sources.map((source) => `${source.provider}:${source.externalId}`).join('|')}
                onPress={() => openPreview(candidate)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 48,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  heading: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    marginTop: 7,
  },
  intro: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.fillStrong,
    borderRadius: 14,
    padding: 4,
    marginTop: 24,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  filter: {
    backgroundColor: colors.fill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterActive: {
    backgroundColor: colors.black,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.onAccent,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  searchButton: {
    minWidth: 82,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.black,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  success: {
    color: colors.text,
    backgroundColor: colors.successSoft,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  warning: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  results: {
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
});
