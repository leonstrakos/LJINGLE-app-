import { useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaFeedbackView } from '../components/MediaFeedbackView';
import { MediaPoster } from '../components/MediaPoster';
import { mediaApi } from '../services/mediaApi';
import { colors } from '../theme/colors';
import {
  mediaTypeLabels,
  type MediaRequest,
  type MediaType,
  type TmdbMediaResponse,
} from '../types/media';
import type { MediaStackParamList } from '../types/mediaNavigation';
import { createdFeedback } from '../utils/crudFeedback';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaSearch'>;

export function MediaSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('MOVIE');
  const [results, setResults] = useState<TmdbMediaResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim() || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const response = await mediaApi.searchTmdb(query.trim(), mediaType);
      setResults(response.results);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : 'Online pretraga nije uspjela.');
    } finally {
      setLoading(false);
    }
  };

  const addToCatalog = async (result: TmdbMediaResponse) => {
    setAddingId(result.tmdbId);
    try {
      const payload: MediaRequest = {
        mediaType: result.mediaType,
        tmdbId: result.tmdbId,
        title: result.title,
        originalTitle: result.originalTitle,
        overview: result.overview,
        posterPath: result.posterPath,
        backdropPath: result.backdropPath,
        releaseYear: result.releaseYear,
        watchStatus: 'WATCHLIST',
        progress: 0,
        enjoyment: null,
        favourite: false,
        startedOn: null,
        completedOn: null,
      };
      const created = await mediaApi.create(payload);
      createdFeedback();
      navigation.replace('MediaDetails', { mediaId: created.mediaId });
    } catch (caught) {
      Alert.alert(
        'Dodavanje nije uspjelo',
        caught instanceof Error ? caught.message : 'Pokušajte ponovno.',
      );
    } finally {
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Online katalog</Text>
        <Text style={styles.heading}>Pronađi naslov</Text>
        <View style={styles.typeRow}>
          {(['MOVIE', 'SERIES'] as MediaType[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setMediaType(value);
                setResults([]);
                setSearched(false);
              }}
              style={[styles.typeChip, mediaType === value && styles.typeChipActive]}
            >
              <Text style={[styles.typeText, mediaType === value && styles.typeTextActive]}>
                {mediaTypeLabels[value]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sourceNote}>
          {mediaType === 'MOVIE'
            ? 'Izvori: TMDB ako je postavljen · Apple Search · Wikidata backup'
            : 'Izvori: TMDB ako je postavljen · TVmaze · Apple TV · Wikidata backup'}
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={mediaType === 'MOVIE' ? 'Naslov filma' : 'Naslov serije'}
            placeholderTextColor="#98989D"
            returnKeyType="search"
            onSubmitEditing={() => void search()}
            style={styles.input}
          />
          <Pressable
            disabled={!query.trim() || loading}
            onPress={() => void search()}
            style={[styles.searchButton, (!query.trim() || loading) && styles.disabled]}
          >
            <Text style={styles.searchLabel}>{loading ? '…' : 'Traži'}</Text>
          </Pressable>
        </View>
      </View>

      {loading && results.length === 0 ? (
        <MediaFeedbackView type="loading" message="Pretražujem filmove i serije…" />
      ) : error ? (
        <MediaFeedbackView type="error" message={error} onRetry={() => void search()} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={searched ? (
            <MediaFeedbackView type="empty" message="Nema rezultata za taj upit." />
          ) : (
            <View style={styles.prompt}>
              <Text style={styles.promptIcon}>⌕</Text>
              <Text style={styles.promptText}>Pronađite naslov online i dodajte rezultat u svoj privatni katalog. API ključ nije potreban.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.resultCard}>
              <MediaPoster title={item.title} posterPath={item.posterPath} width={80} height={120} />
              <View style={styles.resultContent}>
                <Text numberOfLines={2} style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultMeta}>{item.releaseYear ?? 'Godina nije poznata'}</Text>
                <Text numberOfLines={2} style={styles.resultOverview}>{item.overview ?? 'Opis nije dostupan.'}</Text>
                <View style={styles.resultActions}>
                  <Pressable
                    disabled={addingId !== null}
                    onPress={() => void addToCatalog(item)}
                    style={[styles.addButton, addingId !== null && styles.disabled]}
                  >
                    <Text style={styles.addLabel}>{addingId === item.tmdbId ? 'Dodavanje…' : 'Dodaj u katalog'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('MediaForm', { draft: item })}
                    style={styles.editButton}
                  >
                    <Text style={styles.editLabel}>Pregledaj</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 16 },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.7, marginTop: 3 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 17 },
  typeChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  typeChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  typeText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  typeTextActive: { color: colors.white },
  sourceNote: { color: colors.textMuted, fontSize: 11, marginTop: 9 },
  sourceLink: { color: colors.text, fontWeight: '700', textDecorationLine: 'underline' },
  searchRow: { flexDirection: 'row', gap: 9, marginTop: 13 },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 16 },
  searchButton: { minWidth: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.black },
  searchLabel: { color: colors.white, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  list: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 35 },
  prompt: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 32 },
  promptIcon: { color: colors.textMuted, fontSize: 42 },
  promptText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 14 },
  resultCard: { flexDirection: 'row', gap: 13, padding: 13, marginBottom: 12, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  resultContent: { flex: 1 },
  resultTitle: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  resultMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  resultOverview: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 7 },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: colors.black },
  addLabel: { color: colors.white, fontSize: 12, fontWeight: '800' },
  editButton: { paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.fillStrong },
  editLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
