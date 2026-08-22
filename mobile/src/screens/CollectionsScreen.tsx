import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView as ModalSafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
import type { CollectionSummary } from '../types/collection';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Collections'>;

export function CollectionsScreen({ navigation }: Props) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('◇');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCollections(await collectionApi.getAll());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kolekcije se nisu učitale.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await collectionApi.create({
        name: name.trim(),
        description: description.trim() || null,
        symbol: symbol.trim() || '◇',
      });
      setCollections((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'hr')));
      setName('');
      setDescription('');
      setSymbol('◇');
      setCreateVisible(false);
      navigation.navigate('CollectionDetails', { collectionId: created.collectionId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kolekcija nije spremljena.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.collectionId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Tvoje police i liste</Text>
              <Text style={styles.heading}>Collections</Text>
              <Text style={styles.intro}>
                Miješaj knjige, filmove, igre, teme, citate i bilješke u istoj kolekciji.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreateVisible(true)}
              style={({ pressed }) => [styles.createCard, pressed && styles.pressed]}
            >
              <Text style={styles.createPlus}>＋</Text>
              <View style={styles.createCopy}>
                <Text style={styles.createTitle}>Nova kolekcija</Text>
                <Text style={styles.createSubtitle}>Napravi shelf, listu, sezonu ili vlastiti cluster</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
            {error ? (
              <Pressable onPress={() => void load()} style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>Pokušaj ponovno</Text>
              </Pressable>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.black} size="large" style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyMark}>◇</Text>
              <Text style={styles.emptyTitle}>Nema kolekcija</Text>
              <Text style={styles.emptyText}>Napravi prvu i u nju dodaj bilo koju vrstu sadržaja.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CollectionDetails', { collectionId: item.collectionId })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.symbol}><Text style={styles.symbolText}>{item.symbol || '◇'}</Text></View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description ? <Text numberOfLines={2} style={styles.cardDescription}>{item.description}</Text> : null}
              <Text style={styles.cardCount}>{item.itemCount} {item.itemCount === 1 ? 'stavka' : 'stavki'}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}
      />

      <Modal animationType="slide" visible={createVisible} onRequestClose={() => setCreateVisible(false)}>
        <ModalSafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Natrag na kolekcije"
              hitSlop={12}
              onPress={() => setCreateVisible(false)}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>Nova polica / lista</Text>
              <Text style={styles.modalTitle}>Nova kolekcija</Text>
            </View>
          </View>
          <View style={styles.form}>
            <Text style={styles.label}>Simbol</Text>
            <TextInput value={symbol} onChangeText={setSymbol} maxLength={16} style={[styles.input, styles.symbolInput]} />
            <Text style={styles.label}>Naziv</Text>
            <TextInput value={name} onChangeText={setName} placeholder="npr. Rainy Night Movies" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Text style={styles.label}>Opis</Text>
            <TextInput value={description} onChangeText={setDescription} multiline placeholder="Neobavezno" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textarea]} />
            <Pressable disabled={!name.trim() || saving} onPress={() => void create()} style={({ pressed }) => [styles.saveButton, (!name.trim() || saving) && styles.disabled, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Spremi kolekciju</Text>}
            </Pressable>
          </View>
        </ModalSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 46 },
  hero: { paddingTop: 8, paddingBottom: 18 },
  eyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heading: { marginTop: 4, color: colors.text, fontSize: 39, lineHeight: 46, fontWeight: '900', letterSpacing: -1.2 },
  intro: { marginTop: 8, maxWidth: 560, color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  createCard: { minHeight: 86, marginBottom: 16, padding: 15, flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: colors.black },
  createPlus: { width: 48, color: colors.white, fontSize: 30, textAlign: 'center' },
  createCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  createTitle: { color: colors.white, fontSize: 17, fontWeight: '900' },
  createSubtitle: { marginTop: 3, color: '#C7C7CC', fontSize: 11, lineHeight: 15 },
  arrow: { marginLeft: 10, color: colors.textMuted, fontSize: 30, fontWeight: '300' },
  card: { minHeight: 108, marginBottom: 11, padding: 15, flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  symbol: { width: 60, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.fillStrong },
  symbolText: { color: colors.text, fontSize: 27, fontWeight: '800' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 15 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cardDescription: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  cardCount: { marginTop: 7, color: colors.text, fontSize: 11, fontWeight: '800' },
  errorBanner: { marginBottom: 15, padding: 13, borderRadius: 14, backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger, fontSize: 13 },
  retryText: { marginTop: 4, color: colors.danger, fontSize: 12, fontWeight: '800' },
  loader: { marginTop: 50 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyMark: { color: colors.textMuted, fontSize: 40 },
  emptyTitle: { marginTop: 12, color: colors.text, fontSize: 19, fontWeight: '800' },
  emptyText: { marginTop: 6, maxWidth: 300, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { minHeight: 76, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.separator },
  backButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  backText: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '400' },
  modalHeaderCopy: { flex: 1, minWidth: 0, marginLeft: 4 },
  modalEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  modalTitle: { marginTop: 3, color: colors.text, fontSize: 22, fontWeight: '900' },
  closeButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.fillStrong },
  closeText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  form: { padding: 20 },
  label: { marginTop: 14, marginBottom: 7, color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 50, paddingHorizontal: 14, color: colors.text, fontSize: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, borderRadius: 14 },
  symbolInput: { width: 90, fontSize: 24, textAlign: 'center' },
  textarea: { minHeight: 108, paddingTop: 13, textAlignVertical: 'top' },
  saveButton: { minHeight: 52, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.black },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.72 },
});
