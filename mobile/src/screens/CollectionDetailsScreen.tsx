import { useCallback, useMemo, useState } from 'react';
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
import {
  entityTypeLabels,
  type CollectionDetail,
  type EntityReference,
  type EntityReferenceType,
} from '../types/collection';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionDetails'>;

type Filter = 'ALL' | EntityReferenceType;
const filters: Filter[] = ['ALL', 'BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY'];
const filterLabels: Record<Filter, string> = {
  ALL: 'Sve', BOOK: 'Knjige', MEDIA: 'Media', GAME: 'Igre', TOPIC: 'Teme', ENTRY: 'Zapisi',
};

export function CollectionDetailsScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [query, setQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCollection(await collectionApi.getById(collectionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kolekcija se nije učitala.');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleItems = useMemo(() => {
    if (!collection) return [];
    return filter === 'ALL' ? collection.items : collection.items.filter((item) => item.entityType === filter);
  }, [collection, filter]);

  const openPicker = async () => {
    setPickerVisible(true);
    setPickerLoading(true);
    setQuery('');
    try {
      setReferences(await collectionApi.searchReferences(''));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stavke se nisu učitale.');
    } finally {
      setPickerLoading(false);
    }
  };

  const search = async (value: string) => {
    setQuery(value);
    setPickerLoading(true);
    try {
      setReferences(await collectionApi.searchReferences(value));
    } finally {
      setPickerLoading(false);
    }
  };

  const add = async (reference: EntityReference) => {
    if (busyId || !collection) return;
    setBusyId(reference.entityId);
    setError(null);
    try {
      const item = await collectionApi.addItem(collectionId, reference.entityType, reference.entityId);
      setCollection({ ...collection, items: [...collection.items, item] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stavka nije dodana.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (itemId: string) => {
    if (busyId || !collection) return;
    setBusyId(itemId);
    setError(null);
    try {
      await collectionApi.removeItem(collectionId, itemId);
      setCollection({ ...collection, items: collection.items.filter((item) => item.itemId !== itemId) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stavka nije uklonjena.');
    } finally {
      setBusyId(null);
    }
  };

  const removeCollection = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await collectionApi.remove(collectionId);
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kolekcija nije obrisana.');
    } finally {
      setDeleting(false);
    }
  };

  const memberKeys = new Set(collection?.items.map((item) => `${item.entityType}:${item.entityId}`) ?? []);

  if (loading && !collection) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.black} size="large" /></SafeAreaView>;
  }

  if (!collection) {
    return <SafeAreaView style={styles.center}><Text style={styles.errorText}>{error ?? 'Kolekcija nije pronađena.'}</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.heroSymbol}><Text style={styles.heroSymbolText}>{collection.symbol || '◇'}</Text></View>
              <Text style={styles.eyebrow}>Collection</Text>
              <Text style={styles.heading}>{collection.name}</Text>
              {collection.description ? <Text style={styles.description}>{collection.description}</Text> : null}
              <Text style={styles.count}>{collection.items.length} {collection.items.length === 1 ? 'stavka' : 'stavki'}</Text>
            </View>

            <Pressable onPress={() => void openPicker()} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Text style={styles.addPlus}>＋</Text>
              <View style={styles.addCopy}>
                <Text style={styles.addTitle}>Dodaj bilo što</Text>
                <Text style={styles.addSubtitle}>Knjigu, film, igru, temu, quote ili note</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>

            <FlatList
              horizontal
              data={filters}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Pressable onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{filterLabels[item]}</Text>
                </Pressable>
              )}
            />

            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyMark}>◇</Text><Text style={styles.emptyTitle}>Ovdje još nema ničega</Text><Text style={styles.emptyText}>Dodaj sadržaj ili promijeni filter.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{entityTypeLabels[item.entityType]}</Text></View>
            <View style={styles.itemCopy}>
              <Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text>
              {item.subtitle ? <Text numberOfLines={1} style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
            </View>
            <Pressable disabled={busyId === item.itemId} onPress={() => void remove(item.itemId)} style={styles.removeButton}>
              {busyId === item.itemId ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Text style={styles.removeText}>×</Text>}
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Pressable disabled={deleting} onPress={() => void removeCollection()} style={({ pressed }) => [styles.deleteCollection, pressed && styles.pressed]}>
            {deleting ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.deleteText}>Obriši kolekciju</Text>}
          </Pressable>
        }
      />

      <Modal animationType="slide" visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <ModalSafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.modalEyebrow}>Add anything</Text><Text style={styles.modalTitle}>{collection.name}</Text></View>
            <Pressable onPress={() => setPickerVisible(false)} style={styles.doneButton}><Text style={styles.doneText}>Gotovo</Text></Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={(value) => void search(value)}
            placeholder="Pretraži cijeli katalog…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {pickerLoading ? <ActivityIndicator style={styles.pickerLoader} color={colors.black} /> : null}
          <FlatList
            data={references}
            keyExtractor={(item) => `${item.entityType}:${item.entityId}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.referenceList}
            renderItem={({ item }) => {
              const key = `${item.entityType}:${item.entityId}`;
              const selected = memberKeys.has(key);
              return (
                <Pressable disabled={selected || busyId === item.entityId} onPress={() => void add(item)} style={[styles.referenceRow, selected && styles.referenceSelected]}>
                  <View style={styles.referenceType}><Text style={styles.referenceTypeText}>{entityTypeLabels[item.entityType]}</Text></View>
                  <View style={styles.referenceCopy}>
                    <Text numberOfLines={1} style={styles.referenceTitle}>{item.title}</Text>
                    {item.subtitle ? <Text numberOfLines={1} style={styles.referenceSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  {busyId === item.entityId ? <ActivityIndicator size="small" color={colors.black} /> : <Text style={styles.referenceAction}>{selected ? '✓' : '+'}</Text>}
                </Pressable>
              );
            }}
          />
        </ModalSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 30 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  hero: { paddingTop: 8, paddingBottom: 19 },
  heroSymbol: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.black, marginBottom: 17 },
  heroSymbolText: { color: colors.white, fontSize: 31, fontWeight: '900' },
  eyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heading: { marginTop: 3, color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1 },
  description: { marginTop: 7, color: colors.textMuted, fontSize: 14, lineHeight: 21, maxWidth: 580 },
  count: { marginTop: 10, color: colors.text, fontSize: 12, fontWeight: '800' },
  addButton: { minHeight: 82, padding: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  addPlus: { width: 48, height: 48, textAlign: 'center', lineHeight: 45, borderRadius: 15, backgroundColor: colors.black, color: colors.white, fontSize: 26 },
  addCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
  addTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  addSubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 11 },
  arrow: { color: colors.textMuted, fontSize: 28 },
  filters: { paddingVertical: 16, gap: 8 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.fill },
  filterActive: { backgroundColor: colors.black },
  filterText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  inlineError: { marginBottom: 12, color: colors.danger, fontSize: 12 },
  itemCard: { minHeight: 79, marginBottom: 9, padding: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  typeBadge: { minWidth: 68, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: colors.fillStrong },
  typeBadgeText: { color: colors.text, fontSize: 9, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  itemCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  itemSubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 11 },
  removeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.textMuted, fontSize: 25 },
  empty: { alignItems: 'center', paddingVertical: 45 },
  emptyMark: { color: colors.textMuted, fontSize: 36 },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: 13 },
  deleteCollection: { marginTop: 28, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.separator },
  modalEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  modalTitle: { marginTop: 3, color: colors.text, fontSize: 21, fontWeight: '900' },
  doneButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.black },
  doneText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  searchInput: { minHeight: 50, margin: 16, marginBottom: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, color: colors.text, fontSize: 15 },
  pickerLoader: { marginVertical: 8 },
  referenceList: { padding: 16, paddingTop: 8 },
  referenceRow: { minHeight: 67, marginBottom: 8, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  referenceSelected: { opacity: 0.55 },
  referenceType: { width: 70 },
  referenceTypeText: { color: colors.textMuted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  referenceCopy: { flex: 1, minWidth: 0 },
  referenceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  referenceSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  referenceAction: { width: 34, color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
