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

import { CollectionEditorForm } from '../components/CollectionEditorForm';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { collectionApi } from '../services/collectionApi';
// forkFCollectionManageV1
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';
import { sharePortableCollection } from '../services/portableExport';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import {
  entityTypeLabels,
  type CollectionDetail,
  type EntityReference,
  type EntityReferenceType,
} from '../types/collection';
import type { RootStackParamList } from '../types/navigation';
import { deletedFeedback } from '../utils/crudFeedback';
import { ShareGlyph } from '../components/ShareGlyph';

import { celestial, celestialAlpha } from '../theme/celestial';
type Props = NativeStackScreenProps<RootStackParamList, 'CollectionDetails'>;

// forkN2CelestialCollectionsTopicsV2
const celestialMode = activeVisualSkinId === 'classic';
const CELESTIAL_GOLD = celestial.gold;

type Filter = 'ALL' | EntityReferenceType;
const filters: Filter[] = ['ALL', 'BOOK', 'MEDIA', 'GAME', 'ENTRY', 'FREQUENCY', 'TOPIC'];
const filterLabels: Record<Filter, string> = {
  ALL: 'Sve', BOOK: 'Knjige', MEDIA: 'Media', GAME: 'Igre', TOPIC: 'Teme',FREQUENCY: 'Frekvencije', ENTRY: 'Zapisi',
};

// forkLCollectionsMemoryBoxV2
const COLLECTION_ENTITY_MARKS: Record<EntityReferenceType, string> = {
  BOOK: '▣',
  MEDIA: '▷',
  GAME: '⌘',
  ENTRY: '✎',
  FREQUENCY: '♫',
  TOPIC: '✦',
};

const STAR_GOLD = '#D3A11B';

export function CollectionDetailsScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expandedTypes, setExpandedTypes] =
    useState<Set<EntityReferenceType>>(
      () =>
        new Set([
          'BOOK',
          'MEDIA',
          'GAME',
          'ENTRY',
          'FREQUENCY',
          'TOPIC',
        ]),
    );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [query, setQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSymbol, setEditSymbol] = useState(DEFAULT_COLLECTION_SYMBOL);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const groupedItems = useMemo(() => {
    if (!collection) return [];

    const order: EntityReferenceType[] = [
      'BOOK',
      'MEDIA',
      'GAME',
      'ENTRY',
      'FREQUENCY',
      'TOPIC',
    ];

    return order
      .map((entityType) => ({
        entityType,
        items: collection.items.filter(
          (item) =>
            item.entityType === entityType,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [collection]);

  const toggleGroup = (
    entityType: EntityReferenceType,
  ) => {
    setExpandedTypes((current) => {
      const next = new Set(current);

      if (next.has(entityType)) {
        next.delete(entityType);
      } else {
        next.add(entityType);
      }

      return next;
    });
  };

  const shareCollection = async () => {
    if (!collection || deleting) return;

    setError(null);
    try {
      await sharePortableCollection(collectionId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    }
  };

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

  const openCollectionItem = (
    item: CollectionDetail['items'][number],
  ) => {
    const rootNavigation = navigation as unknown as {
      navigate: (
        screen: string,
        params?: unknown,
      ) => void;
    };

    switch (item.entityType) {
      case 'BOOK':
        rootNavigation.navigate('BookDetails', {
          bookId: item.entityId,
        });
        return;

      case 'TOPIC':
        rootNavigation.navigate('TopicDetails', {
          topicId: item.entityId,
        });
        return;

      case 'ENTRY':
        rootNavigation.navigate('EntryForm', {
          entryId: item.entityId,
        });
        return;

      case 'GAME':
        rootNavigation.navigate('Games', {
          screen: 'GameDetails',
          params: { gameId: item.entityId },
        });
        return;

      case 'MEDIA':
        rootNavigation.navigate('Media', {
          screen: 'MediaDetails',
          params: { mediaId: item.entityId },
        });
        return;

      case 'FREQUENCY':
        rootNavigation.navigate('MemoryRadio', {
          trackId: item.entityId,
        });
        return;

      default:
        return;
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

  const openEdit = () => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDescription(collection.description ?? '');
    setEditSymbol(collection.symbol ?? DEFAULT_COLLECTION_SYMBOL);
    setError(null);
    setEditError(null);
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!collection || !editName.trim() || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await collectionApi.update(collectionId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        symbol: editSymbol,
      });
      setCollection({
        ...collection,
        name: updated.name,
        description: updated.description,
        symbol: updated.symbol,
      });
      setEditVisible(false);
    } catch (caught) {
      setEditError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcija nije spremljena.',
      );
    } finally {
      setEditSaving(false);
    }
  };

  const askToDeleteCollection = () => {
    if (deleting) return;
    setDeleteError(null);
    setConfirmDeleteVisible(true);
  };

  const removeCollection = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await collectionApi.remove(collectionId);
      deletedFeedback();
      setConfirmDeleteVisible(false);
      navigation.goBack();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcija nije obrisana.',
      );
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
        data={
          filter === 'ALL'
            ? []
            : visibleItems
        }
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <CelestialAtmosphere variant="collections" />
              <View style={styles.heroStars} pointerEvents="none">
                <Text style={styles.heroStar}>✦</Text>
                <Text style={styles.heroStarDot}>·</Text>
                <Text style={styles.heroStar}>✧</Text>
              </View>

              <View style={styles.heroTop}>
                <View style={styles.heroSymbolFrame}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={styles.heroSymbolText}
                  >
                    {collection.symbol || DEFAULT_COLLECTION_SYMBOL}
                  </Text>
                </View>

                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>MEMORY BOX</Text>
                  <View style={styles.portableTitleRow}>
                    <Text
                      numberOfLines={2}
                      style={[styles.heading, styles.portableTitleText, celestialMode && styles.headingCelestial]}
                    >
                      {collection.name}
                    </Text>

                    <Pressable
                      accessibilityLabel="Share collection"
                      accessibilityRole="button"
                      onPress={() => void shareCollection()}
                      style={({ pressed }) => [
                        styles.portableShare,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ShareGlyph />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Text style={styles.description}>
                {collection.description ||
                  'Playlist · scrapbook · osobni arhiv'}
              </Text>

              <View style={styles.boxMetaRow}>
                <Text style={styles.count}>
                  {collection.items.length}{' '}
                  {collection.items.length === 1 ? 'stvar' : 'stvari'}
                </Text>
                <Text style={styles.boxMeta}>LJINGLE ARCHIVE</Text>
              </View>

              <View style={styles.boxRule}>
                <Text style={styles.boxRuleStar}>✦</Text>
                <View style={styles.boxRuleLine} />
                <Text style={styles.boxRuleStar}>✧</Text>
              </View>
            </View>

            
            <Pressable
              onPress={() => void openPicker()}
              style={({ pressed }) => [
                styles.addButton,
                celestialMode && styles.addButtonCelestial,
                pressed && styles.pressed,
              ]}
            >
              {celestialMode ? <Text pointerEvents="none" style={styles.addButtonStar}>✦</Text> : null}
              <Text style={[styles.addPlus, celestialMode && styles.addPlusCelestial]}>＋</Text>
              <View style={styles.addCopy}>
                <Text style={styles.addTitle}>Dodaj u Memory Box</Text>
                <Text style={styles.addSubtitle}>Knjigu, film, igru, temu, zapis ili frekvenciju</Text>
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
                <Pressable onPress={() => setFilter(item)} style={[
                  styles.filter,
                  celestialMode && styles.filterCelestial,
                  filter === item && styles.filterActive,
                  celestialMode && filter === item && styles.filterActiveCelestial,
                ]}>
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{filterLabels[item]}</Text>
                </Pressable>
              )}
            />

            {/* architectureBatchA_collectionGroups */}
            {filter === 'ALL' ? (
              <View style={styles.groupedContents}>
                {groupedItems.map((group) => {
                  const expanded =
                    expandedTypes.has(
                      group.entityType,
                    );

                  return (
                    <View
                      key={group.entityType}
                      style={[styles.group, celestialMode && styles.groupCelestial]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          toggleGroup(
                            group.entityType,
                          )
                        }
                        style={styles.groupHeader}
                      >
                        <View style={styles.groupHeaderCopy}>
                          <View style={styles.groupMark}>
                            <Text style={styles.groupMarkText}>
                              {COLLECTION_ENTITY_MARKS[group.entityType]}
                            </Text>
                          </View>
                          <Text style={[styles.groupTitle, celestialMode && styles.groupTitleCelestial]}>
                            {filterLabels[
                              group.entityType
                            ]}
                          </Text>
                          <Text style={styles.groupCount}>
                            {group.items.length}
                          </Text>
                        </View>

                        <Text style={styles.groupChevron}>
                          {expanded ? '−' : '+'}
                        </Text>
                      </Pressable>

                      {expanded ? (
                        <View style={styles.groupItems}>
                          {group.items.map((item) => (
                            <View
                              key={item.itemId}
                              style={[styles.itemCard, celestialMode && styles.itemCardCelestial]}
                            >
                              <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                  openCollectionItem(
                                    item,
                                  )
                                }
                                style={({
                                  pressed,
                                }) => [
                                  styles.itemOpen,
                                  pressed &&
                                    styles.pressed,
                                ]}
                              >
                                <View
                                  style={[styles.typeBadge, celestialMode && styles.typeBadgeCelestial]}
                                >
                                  <Text
                                    style={
                                      styles.typeBadgeText
                                    }
                                  >
                                    {
                                      COLLECTION_ENTITY_MARKS[item.entityType] +
                                      ' ' +
                                      entityTypeLabels[item.entityType]
                                    }
                                  </Text>
                                </View>

                                <View
                                  style={styles.itemCopy}
                                >
                                  <Text
                                    numberOfLines={2}
                                    style={
                                      styles.itemTitle
                                    }
                                  >
                                    {item.title}
                                  </Text>

                                  {item.subtitle ? (
                                    <Text
                                      numberOfLines={1}
                                      style={
                                        styles.itemSubtitle
                                      }
                                    >
                                      {item.subtitle}
                                    </Text>
                                  ) : null}
                                </View>
                              </Pressable>

                              <Pressable
                                disabled={
                                  busyId === item.itemId
                                }
                                onPress={() =>
                                  void remove(
                                    item.itemId,
                                  )
                                }
                                style={
                                  styles.removeButton
                                }
                              >
                                {busyId ===
                                item.itemId ? (
                                  <ActivityIndicator
                                    color={
                                      colors.textMuted
                                    }
                                    size="small"
                                  />
                                ) : (
                                  <Text
                                    style={
                                      styles.removeText
                                    }
                                  >
                                    ×
                                  </Text>
                                )}
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          filter === 'ALL' &&
          collection.items.length > 0
            ? null
            : <View style={styles.empty}><Text style={styles.emptyMark}>◇</Text><Text style={styles.emptyTitle}>Ovdje još nema ničega</Text><Text style={styles.emptyText}>Dodaj sadržaj ili promijeni filter.</Text></View>
        }
        renderItem={({ item }) => (
          <View style={[styles.itemCard, celestialMode && styles.itemCardCelestial]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openCollectionItem(item)}
              style={({ pressed }) => [
                styles.itemOpen,
                pressed && styles.pressed,
              ]}
            >
<View style={[styles.typeBadge, celestialMode && styles.typeBadgeCelestial]}><Text style={styles.typeBadgeText}>{COLLECTION_ENTITY_MARKS[item.entityType]} {entityTypeLabels[item.entityType]}</Text></View>
            <View style={styles.itemCopy}>
              <Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text>
              {item.subtitle ? <Text numberOfLines={1} style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
            </View>
            </Pressable>
            <Pressable disabled={busyId === item.itemId} onPress={() => void remove(item.itemId)} style={styles.removeButton}>
              {busyId === item.itemId ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Text style={styles.removeText}>×</Text>}
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={[styles.actions, celestialMode && styles.actionsCelestial]}>
            <PrimaryButton
              label="Uredi kolekciju"
              onPress={openEdit}
              variant="secondary"
            />
            <View style={styles.actionGap} />
            <PrimaryButton
              label="Obriši kolekciju"
              onPress={askToDeleteCollection}
              loading={deleting}
              variant="danger"
            />
          </View>
        }
      />

      <Modal animationType="slide" visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <ModalSafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.modalEyebrow}>MEMORY BOX · DODAJ</Text><Text style={styles.modalTitle}>{collection.name}</Text></View>
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

      <Modal
        animationType="slide"
        visible={editVisible}
        onRequestClose={() => {
          if (!editSaving) setEditVisible(false);
        }}
      >
        <ModalSafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>MEMORY BOX</Text>
              <Text style={styles.modalTitle}>Uredi kolekciju</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={editSaving}
              onPress={() => setEditVisible(false)}
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.doneText}>Gotovo</Text>
            </Pressable>
          </View>
          <CollectionEditorForm
            name={editName}
            description={editDescription}
            symbol={editSymbol}
            saving={editSaving}
            submitLabel="Spremi promjene"
            errorMessage={editError}
            onNameChange={setEditName}
            onDescriptionChange={setEditDescription}
            onSymbolChange={setEditSymbol}
            onSubmit={() => void saveEdit()}
          />
        </ModalSafeAreaView>
      </Modal>

      <DeleteConfirmationModal
        visible={confirmDeleteVisible}
        itemTitle={collection.name}
        title="Obrisati kolekciju?"
        message={`Kolekcija „${collection.name}” bit će uklonjena. Stavke u njoj ostaju sigurno spremljene u katalogu.`}
        loading={deleting}
        errorMessage={deleteError}
        onCancel={() => {
          if (!deleting) {
            setDeleteError(null);
            setConfirmDeleteVisible(false);
          }
        }}
        onConfirm={() => void removeCollection()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroStars: {
    position: 'absolute',
    right: 16,
    top: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    opacity: 0.58,
  },
  heroStar: { color: STAR_GOLD, fontSize: 12 },
  heroStarDot: { color: STAR_GOLD, fontSize: 13 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroSymbolFrame: {
    width: 72,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
  },
  boxMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  boxMeta: {
    color: colors.textMuted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  boxRule: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boxRuleStar: {
    color: STAR_GOLD,
    fontSize: 10,
    opacity: 0.78,
  },
  boxRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: STAR_GOLD,
    opacity: 0.2,
  },
  groupMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.fill,
  },
  groupMarkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  groupedContents: {
    marginBottom: 4,
    gap: 10,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  groupHeader: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeaderCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  groupCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    textAlign: 'center',
    lineHeight: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  groupChevron: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '500',
  },
  groupItems: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 30 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  hero: {
    position: 'relative',
    marginBottom: 16,
    padding: 19,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  identitySymbol: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.fillStrong, borderWidth: 1, borderColor: colors.separator },
  identitySymbolText: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  heroSymbol: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.black, marginBottom: 17 },
  heroSymbolText: {
    maxWidth: 64,
    color: colors.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
  },
  eyebrow: {
    color: STAR_GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  heading: { marginTop: 3, color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1 },
  portableTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  portableTitleText: {
    flexShrink: 1,
    minWidth: 0,
  },
  portableShare: {
    width: 30,
    height: 30,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  portableShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  description: { marginTop: 7, color: colors.textMuted, fontSize: 14, lineHeight: 21, maxWidth: 580 },
  count: { marginTop: 10, color: colors.text, fontSize: 12, fontWeight: '800' },
  shareButton: {
    minHeight: 46,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  addButton: {
    minHeight: 80,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.black,
  },
  addPlus: {
    width: 50,
    color: colors.white,
    fontSize: 29,
    textAlign: 'center',
  },
  addCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
  addTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  addSubtitle: {
    marginTop: 3,
    color: '#C7C7CC',
    fontSize: 11,
  },
  arrow: { color: colors.textMuted, fontSize: 28 },
  filters: { paddingVertical: 16, gap: 8 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.fill },
  filterActive: { backgroundColor: colors.black },
  filterText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  inlineError: { marginBottom: 12, color: colors.danger, fontSize: 12 },
  itemCard: {
    minHeight: 76,
    marginBottom: 7,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  itemOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    minWidth: 82,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
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
  actions: { marginTop: 28 },
  actionGap: { height: 10 },
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
  heroCelestial: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.36),
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  memoryBoxSeal: {
    marginBottom: 12,
    color: CELESTIAL_GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.1,
    textAlign: 'right',
    opacity: 0.82,
  },
  identitySymbolCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.60),
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
  },
  identitySymbolTextCelestial: {
    color: colors.text,
  },
  eyebrowCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.7,
  },
  headingCelestial: {
    letterSpacing: -0.35,
  },
  descriptionCelestial: {
    maxWidth: 520,
  },
  countCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  addButtonCelestial: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: celestialAlpha(celestial.gold, 0.48),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 1,
  },
  addButtonStar: {
    position: 'absolute',
    right: 12,
    top: 8,
    color: CELESTIAL_GOLD,
    fontSize: 9,
    opacity: 0.65,
  },
  addPlusCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.62),
    color: CELESTIAL_GOLD,
  },
  filterCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.22),
    backgroundColor: colors.surface,
  },
  filterActiveCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.72),
  },
  groupCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  groupTitleCelestial: {
    letterSpacing: 0.35,
  },
  itemCardCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.24),
  },
  typeBadgeCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.34),
    backgroundColor: celestialAlpha(celestial.gold, 0.07),
  },
  actionsCelestial: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: celestialAlpha(celestial.gold, 0.26),
  },
  archiveControls: {
    marginBottom: 12,
    color: CELESTIAL_GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    opacity: 0.75,
  },
});
