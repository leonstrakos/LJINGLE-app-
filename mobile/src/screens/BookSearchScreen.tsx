import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gameApi } from '../games/services/gameApi';
import { bookApi } from '../services/bookApi';
import { mediaApi } from '../services/mediaApi';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'BookSearch'>;
type Result = { id: string; kind: 'BOOK' | 'MEDIA' | 'GAME'; title: string; detail: string };

const labels = { BOOK: 'KNJIGA', MEDIA: 'FILM / SERIJA', GAME: 'IGRA' } as const;

export function BookSearchScreen({ navigation }: Props) {
  const [items, setItems] = useState<Result[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [books, media, games] = await Promise.all([bookApi.getAll(), mediaApi.getAll(), gameApi.getAll()]);
      setItems([
        ...books.map((item) => ({ id: item.bookId, kind: 'BOOK' as const, title: item.title, detail: item.author })),
        ...media.map((item) => ({ id: item.mediaId, kind: 'MEDIA' as const, title: item.title, detail: [item.mediaType === 'MOVIE' ? 'Film' : 'Serija', item.releaseYear].filter(Boolean).join(' · ') })),
        ...games.map((item) => ({ id: item.gameId, kind: 'GAME' as const, title: item.title, detail: [item.developer, item.platform].filter(Boolean).join(' · ') })),
      ]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Katalog se nije učitao.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('hr');
    if (!q) return items;
    return items.filter((item) => (item.title + ' ' + item.detail + ' ' + labels[item.kind]).toLocaleLowerCase('hr').includes(q));
  }, [items, query]);

  const open = (item: Result) => {
    if (item.kind === 'BOOK') navigation.navigate('BookDetails', { bookId: item.id });
    else if (item.kind === 'MEDIA') (navigation as any).navigate('Media', { screen: 'MediaDetails', params: { mediaId: item.id } });
    else (navigation as any).navigate('Games', { screen: 'GameDetails', params: { gameId: item.id } });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Tvoja zbirka</Text>
        <Text style={styles.heading}>Pretraži katalog</Text>
        <Text style={styles.intro}>Knjige, filmovi, serije i igre koje si već spremio/la.</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput autoFocus autoCapitalize="none" autoCorrect={false} value={query} onChangeText={setQuery}
            placeholder="Naslov, autor, studio ili platforma" placeholderTextColor={colors.textMuted} style={styles.input} />
          {query ? <Pressable onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
        </View>
      </View>
      {loading ? <ActivityIndicator color={colors.black} size="large" style={styles.loading} /> : error ? (
        <Pressable onPress={() => void load()} style={styles.error}><Text style={styles.errorText}>{error}</Text><Text style={styles.retry}>Pokušaj ponovno</Text></Pressable>
      ) : (
        <FlatList data={results} keyExtractor={(item) => item.kind + item.id} keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Nema rezultata</Text><Text style={styles.emptyText}>Ovdje se prikazuju samo već spremljene stvari.</Text></View>}
          renderItem={({ item }) => <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.kind}><Text style={styles.kindText}>{labels[item.kind]}</Text></View>
            <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{item.title}</Text><Text numberOfLines={1} style={styles.detail}>{item.detail || 'Bez dodatnih podataka'}</Text></View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 15 },
  eyebrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { marginTop: 4, color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.8 },
  intro: { marginTop: 7, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  searchBox: { minHeight: 58, marginTop: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface },
  searchIcon: { color: colors.black, fontSize: 25, marginRight: 11 }, input: { flex: 1, color: colors.text, fontSize: 16 }, clear: { color: colors.textMuted, fontSize: 27, padding: 5 },
  loading: { marginTop: 80 }, list: { paddingHorizontal: 18, paddingBottom: 36 },
  card: { minHeight: 84, marginBottom: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface },
  kind: { minWidth: 88, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.fillStrong }, kindText: { color: colors.black, fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  copy: { flex: 1, marginLeft: 13 }, title: { color: colors.text, fontSize: 17, fontWeight: '800' }, detail: { marginTop: 4, color: colors.textMuted, fontSize: 12 }, arrow: { color: colors.textMuted, fontSize: 28 }, pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  error: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: colors.dangerSoft }, errorText: { color: colors.danger, fontSize: 14 }, retry: { marginTop: 8, color: colors.danger, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 90 }, emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '900' }, emptyText: { marginTop: 8, color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
