import { useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackView } from '../../components/FeedbackView';
import { colors } from '../../theme/colors';
import { gameApi } from '../services/gameApi';
import type { GameMetadataResult, GameStackParamList } from '../types/game';

type Props = NativeStackScreenProps<GameStackParamList, 'GameMetadataSearch'>;

export function GameMetadataSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameMetadataResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const normalized = query.trim();
    if (!normalized || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setResults(await gameApi.searchMetadata(normalized));
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : 'Online pretraživanje nije uspjelo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Metapodaci</Text>
        <Text style={styles.heading}>Pronađi igru</Text>
        <Text style={styles.intro}>
          Online katalog popunjava dostupne podatke o igri i naslovnicu. Ti zatim potvrđuješ i dopunjuješ osobne podatke.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Naziv igre"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            returnKeyType="search"
            placeholder="npr. Fortnite"
            placeholderTextColor="#98989D"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!query.trim() || loading}
            onPress={() => void search()}
            style={({ pressed }) => [
              styles.searchButton,
              (!query.trim() || loading) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.searchButtonText}>{loading ? '…' : 'Traži'}</Text>
          </Pressable>
        </View>
      </View>

      {loading && results.length === 0 ? (
        <FeedbackView type="loading" message="Pretražujem igre…" />
      ) : error ? (
        <FeedbackView type="error" message={error} onRetry={() => void search()} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.igdbId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={searched ? <FeedbackView type="empty" message="Nema rezultata za taj pojam." /> : null}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('GameForm', { prefill: item })}
              style={({ pressed }) => [styles.result, pressed && styles.pressed]}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder}><Text style={styles.coverMark}>G</Text></View>
              )}
              <View style={styles.resultCopy}>
                <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {[item.developer, item.releaseYear].filter(Boolean).join(' · ') || 'Bez dodatnih podataka'}
                </Text>
                <Text numberOfLines={2} style={styles.platforms}>
                  {item.platforms.length > 0 ? item.platforms.join(' · ') : 'Platforma nije navedena'}
                </Text>
                <Text style={styles.use}>Odaberi i dopuni →</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 31, lineHeight: 38, fontWeight: '800', marginTop: 3 },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  searchRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  searchButton: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.black,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  searchButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  list: { flexGrow: 1, padding: 16, paddingBottom: 36 },
  result: {
    minHeight: 150,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 17,
    marginBottom: 12,
  },
  cover: { width: 105, minHeight: 150, backgroundColor: colors.fillStrong },
  coverPlaceholder: {
    width: 105,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.black,
  },
  coverMark: { color: colors.white, fontSize: 48, fontWeight: '900' },
  resultCopy: { flex: 1, padding: 14 },
  title: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 5 },
  platforms: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 11 },
  use: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 11 },
});
