// ljingleContrastTargetedR3
// forkLCollectionsMemoryBoxV2
// collectionBigBoxesV1
// memoryCapsuleBoxedV1
// boxedThemeSafeR4
// collectionsCtaVisualPolishR1
import {
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView as ModalSafeAreaView,
  StyleSheet,
  Text,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { CollectionEditorForm } from '../components/CollectionEditorForm';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { CollectionMemoryBoxCard } from '../components/CollectionMemoryBoxCard';
import { CollectionMemoryBoxGlyph } from '../components/CollectionMemoryBoxGlyph';
import { CollectionBigBoxCard } from '../components/CollectionBigBoxCard';
import { CollectionBigBoxEditorModal } from '../components/CollectionBigBoxEditorModal';
import { MemoryCapsuleCard } from '../components/MemoryCapsuleCard';
import { MemoryCapsuleEditorModal } from '../components/MemoryCapsuleEditorModal';
import { collectionApi } from '../services/collectionApi';
import {
  getCollectionBigBoxes,
  moveCollectionToBigBox,
  reorderCollectionBigBox,
  type CollectionBigBox,
} from '../services/collectionBigBoxes';
import { getMemoryCapsules } from '../services/memoryCapsules';
import type { MemoryCapsule } from '../types/memoryCapsule';
import { activeAccentColor, colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { CollectionSummary } from '../types/collection';
import type { RootStackParamList } from '../types/navigation';
import { createdFeedback } from '../utils/crudFeedback';
import { setPaletteInteractionLock } from '../utils/paletteInteractionLock';
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';

import { celestial, celestialAlpha } from '../theme/celestial';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { updateCelestialParallax } from '../motion/celestialParallax';
type Props = NativeStackScreenProps<RootStackParamList, 'Collections'>;

// forkN2CelestialCollectionsTopicsV2
const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const CELESTIAL_GOLD = celestial.gold;

const STAR_GOLD = '#D3A11B';

// collectionReorderEngineV1: let the real keyed rows animate their slot changes on Android.
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const REORDER_LAYOUT_ANIMATION = {
  duration: 145,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function collectionsForView(
  collections: CollectionSummary[],
  boxes: CollectionBigBox[],
  activeBigBoxId: string | null,
) {
  if (activeBigBoxId) {
    const box = boxes.find(
      (candidate) => candidate.bigBoxId === activeBigBoxId,
    );
    if (!box) return [];

    const byId = new Map(
      collections.map((collection) => [
        collection.collectionId,
        collection,
      ]),
    );

    return box.collectionIds
      .map((collectionId) => byId.get(collectionId))
      .filter(
        (collection): collection is CollectionSummary =>
          Boolean(collection),
      );
  }

  const boxedIds = new Set(
    boxes.flatMap((box) => box.collectionIds),
  );

  return collections.filter(
    (collection) => !boxedIds.has(collection.collectionId),
  );
}

function mergeVisibleOrder(
  allCollections: CollectionSummary[],
  visibleCollections: CollectionSummary[],
) {
  const visibleIds = new Set(
    visibleCollections.map((item) => item.collectionId),
  );
  let visibleIndex = 0;

  return allCollections.map((item) => {
    if (!visibleIds.has(item.collectionId)) return item;
    const replacement = visibleCollections[visibleIndex];
    visibleIndex += 1;
    return replacement || item;
  });
}

export function CollectionsScreen({ navigation }: Props) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const collectionsRef = useRef<CollectionSummary[]>([]);
  collectionsRef.current = collections;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState(DEFAULT_COLLECTION_SYMBOL);
  const [saving, setSaving] = useState(false);

  const [capsules, setCapsules] = useState<MemoryCapsule[]>([]);
  const [memoryCapsuleEditorVisible, setMemoryCapsuleEditorVisible] =
    useState(false);

  const [bigBoxes, setBigBoxes] = useState<CollectionBigBox[]>([]);
  const bigBoxesRef = useRef<CollectionBigBox[]>([]);
  bigBoxesRef.current = bigBoxes;
  const [activeBigBoxId, setActiveBigBoxId] =
    useState<string | null>(null);
  const activeBigBoxIdRef = useRef<string | null>(null);
  activeBigBoxIdRef.current = activeBigBoxId;
  const [bigBoxEditorVisible, setBigBoxEditorVisible] =
    useState(false);
  const [editingBigBox, setEditingBigBox] =
    useState<CollectionBigBox | null>(null);

  const activeBigBox =
    bigBoxes.find((box) => box.bigBoxId === activeBigBoxId) ||
    null;
  const capsuleBackingIds = new Set(
    capsules.map((capsule) => capsule.backingCollectionId),
  );
  const visibleCollections = collectionsForView(
    collections,
    bigBoxes,
    activeBigBoxId,
  ).filter(
    (collection) =>
      !capsuleBackingIds.has(collection.collectionId),
  );

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const reorderSavingRef = useRef(false);
  const reorderDirtyRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [loaded, loadedBoxes, loadedCapsules] =
        await Promise.all([
          collectionApi.getAll(),
          getCollectionBigBoxes(),
          getMemoryCapsules(),
        ]);

      collectionsRef.current = loaded;
      setCollections(loaded);
      bigBoxesRef.current = loadedBoxes;
      setBigBoxes(loadedBoxes);
      setCapsules(loadedCapsules);

      if (
        activeBigBoxIdRef.current &&
        !loadedBoxes.some(
          (box) => box.bigBoxId === activeBigBoxIdRef.current,
        )
      ) {
        activeBigBoxIdRef.current = null;
        setActiveBigBoxId(null);
      }

      reorderDirtyRef.current = false;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcije se nisu učitale.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    setPaletteInteractionLock(
      'collections-reorder',
      reorderMode,
    );

    return () => {
      setPaletteInteractionLock(
        'collections-reorder',
        false,
      );
    };
  }, [reorderMode]);

  const create = async () => {
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);

    try {
      const created = await collectionApi.create({
        name: name.trim(),
        description: description.trim() || null,
        symbol,
      });

      createdFeedback();

      if (activeBigBoxIdRef.current) {
        const nextBoxes = await moveCollectionToBigBox(
          created.collectionId,
          activeBigBoxIdRef.current,
        );
        bigBoxesRef.current = nextBoxes;
        setBigBoxes(nextBoxes);
      }

      setCollections((current) =>
        [...current, created].sort(
          (left, right) => left.position - right.position,
        ),
      );

      setName('');
      setDescription('');
      setSymbol(DEFAULT_COLLECTION_SYMBOL);
      setCreateVisible(false);

      navigation.navigate('CollectionDetails', {
        collectionId: created.collectionId,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcija nije spremljena.',
      );
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = useCallback(async () => {
    if (reorderSavingRef.current) return false;

    reorderSavingRef.current = true;
    setReorderSaving(true);
    setError(null);

    try {
      const activeId = activeBigBoxIdRef.current;

      if (activeId) {
        const box = bigBoxesRef.current.find(
          (candidate) => candidate.bigBoxId === activeId,
        );
        if (!box) return false;

        const savedBoxes = await reorderCollectionBigBox(
          activeId,
          box.collectionIds,
        );
        bigBoxesRef.current = savedBoxes;
        setBigBoxes(savedBoxes);
      } else {
        const source = collectionsRef.current;
        if (source.length === 0) return false;

        const saved = await collectionApi.reorder(
          source.map((item) => item.collectionId),
        );
        collectionsRef.current = saved;
        setCollections(saved);
      }

      reorderDirtyRef.current = false;
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Redoslijed nije spremljen.',
      );
      return false;
    } finally {
      reorderSavingRef.current = false;
      setReorderSaving(false);
    }
  }, []);

  const markOrderDirty = () => {
    reorderDirtyRef.current = true;
  };

  const moveDuringDrag = (fromIndex: number, toIndex: number) => {
    const activeId = activeBigBoxIdRef.current;

    LayoutAnimation.configureNext(REORDER_LAYOUT_ANIMATION);

    if (activeId) {
      const boxes = bigBoxesRef.current;
      const boxIndex = boxes.findIndex(
        (candidate) => candidate.bigBoxId === activeId,
      );
      if (boxIndex < 0) return;

      const box = boxes[boxIndex]!;
      const movedIds = moveItem(
        box.collectionIds,
        fromIndex,
        toIndex,
      );
      if (movedIds === box.collectionIds) return;

      const nextBoxes = [...boxes];
      nextBoxes[boxIndex] = {
        ...box,
        collectionIds: movedIds,
      };
      bigBoxesRef.current = nextBoxes;
      setBigBoxes(nextBoxes);
      markOrderDirty();
      return;
    }

    const all = collectionsRef.current;
    const visible = collectionsForView(
      all,
      bigBoxesRef.current,
      null,
    );
    const movedVisible = moveItem(
      visible,
      fromIndex,
      toIndex,
    );
    if (movedVisible === visible) return;

    const next = mergeVisibleOrder(all, movedVisible);
    collectionsRef.current = next;
    setCollections(next);
    markOrderDirty();
  };

  const finishDrag = (moved: boolean) => {
    if (!moved || !reorderDirtyRef.current) return;
    void persistOrder();
  };

  const moveWithButton = (fromIndex: number, toIndex: number) => {
    moveDuringDrag(fromIndex, toIndex);
    if (reorderDirtyRef.current) {
      void persistOrder();
    }
  };

  const finishReorder = async () => {
    if (dragging || reorderSavingRef.current) return;

    if (reorderDirtyRef.current) {
      const saved = await persistOrder();
      if (!saved) return;
    }

    setReorderMode(false);
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['left', 'right', 'bottom']}
    >
      <AeroAtmosphere variant="collections" />
      <FlatList
        data={visibleCollections}
        keyExtractor={(item) => item.collectionId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
        removeClippedSubviews={false}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, celestialMode && styles.heroCelestial]}>
              {/* ljingleCelestialMotionLanguageR1:collections */}
              <CelestialMotionLayer preset="collections" />
              {celestialMode ? <CelestialAtmosphere variant="collections" /> : null}
              <View style={styles.starRail}>
                <Text style={styles.star}>✦</Text>
                <View style={styles.starLine} />
                <Text style={styles.star}>✧</Text>
                <View style={styles.starLine} />
                <Text style={styles.star}>✦</Text>
              </View>

              <View style={styles.heroTitleRow}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.eyebrow, celestialMode && styles.eyebrowCelestial]}>
                    {activeBigBox
                      ? 'LJINGLE · BIG BOX'
                      : 'LJINGLE · MEMORY BOXES'}
                  </Text>
                  <Text style={[styles.heading, celestialMode && styles.headingCelestial]}>
                    {activeBigBox ? activeBigBox.name : 'Kolekcije'}
                  </Text>
                </View>

                {visibleCollections.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={reorderSaving || dragging}
                    onPress={() => {
                      if (reorderMode) {
                        void finishReorder();
                      } else {
                        setReorderMode(true);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.reorderButton,
                      reorderMode && styles.reorderButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    {reorderSaving ? (
                      <ActivityIndicator
                        color={
                          reorderMode
                            ? colors.white
                            : colors.text
                        }
                        size="small"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.reorderButtonText,
                          reorderMode &&
                            styles.reorderButtonTextActive,
                        ]}
                      >
                        {reorderMode ? 'Gotovo' : 'Redoslijed'}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.intro, celestialMode && styles.introCelestial]}>
                {activeBigBox
                  ? activeBigBox.collectionIds.length +
                    (activeBigBox.collectionIds.length === 1
                      ? ' kolekcija u ovoj većoj kutiji.'
                      : ' kolekcije u ovoj većoj kutiji.')
                  : 'Playliste, scrapbookovi, police i mali arhivi.'}
              </Text>

              <View style={styles.definition}>
                <Text style={styles.definitionStar}>✧</Text>
                <Text style={styles.definitionText}>
                  {activeBigBox
                    ? 'Big Box = kolekcije koje pripadaju zajedno.'
                    : 'Collection = što pripada zajedno.'}
                </Text>
              </View>
            </View>

            {reorderMode ? (
              <View style={styles.reorderNotice}>
                <Text style={styles.reorderNoticeMark}>≡</Text>
                <View style={styles.reorderNoticeCopy}>
                  <Text style={styles.reorderNoticeTitle}>
                    Uredi redoslijed
                  </Text>
                  <Text style={styles.reorderNoticeText}>
                    {activeBigBox
                      ? 'Povuci kolekcije unutar ovog Big Boxa.'
                      : 'Povuci ručku ili koristi strelice. Big Box kolekcije ostaju skrivene na rootu.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {activeBigBox ? (
                  <View style={styles.bigBoxToolbar}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setActiveBigBoxId(null);
                        activeBigBoxIdRef.current = null;
                        setReorderMode(false);
                      }}
                      style={({ pressed }) => [
                        styles.bigBoxToolbarButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.bigBoxToolbarText}>
                        ‹ Svi Big Boxevi
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingBigBox(activeBigBox);
                        setBigBoxEditorVisible(true);
                      }}
                      style={({ pressed }) => [
                        styles.bigBoxToolbarButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.bigBoxToolbarText}>
                        Uredi Big Box
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateVisible(true)}
                  style={({ pressed }) => [
                    styles.createCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.createMark}>
                    {celestialMode ? (
                      <Text pointerEvents="none" style={styles.createStar}>
                        ✦
                      </Text>
                    ) : null}
                    <Text
                      allowFontScaling={false}
                      style={[styles.createPlus, styles.createPlusContrastR1]}
                    >
                      ＋
                    </Text>
                    <Text style={styles.createStar}>✦</Text>
                  </View>

                  <View style={styles.createCopy}>
                    <Text style={styles.createTitle}>
                      Nova Memory Box
                    </Text>
                    <Text style={styles.createSubtitle}>
                      {activeBigBox
                        ? 'Nova kolekcija ide direktno u ' +
                          activeBigBox.name
                        : 'Playlist, scrapbook, research packet ili sezona'}
                    </Text>
                  </View>

                  <Text style={styles.createArrow}>›</Text>
                </Pressable>

                {!activeBigBox ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setMemoryCapsuleEditorVisible(true)
                      }
                      style={({ pressed }) => [
                        styles.memoryCapsuleCreateCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.memoryCapsuleCreateIcon}>
                        {/* ljingleCelestialMotionLanguageR1:capsule-cta */}
                        <CelestialMotionLayer preset="capsule" />
                        <View style={styles.memoryCapsuleClockBadge}>
                          <View style={styles.memoryCapsuleClockCrown} />
                          <View style={styles.memoryCapsuleClockFace}>
                            <View style={styles.memoryCapsuleClockCenter} />
                            <View style={styles.memoryCapsuleClockHandLong} />
                            <View style={styles.memoryCapsuleClockHandShort} />
                          </View>
                        </View>
                        <CollectionMemoryBoxGlyph
                          color={activeAccentColor}
                          size={34}
                        />
                      </View>
                      <View style={styles.createCopy}>
                        <Text style={styles.memoryCapsuleCreateTitle}>
                          Nova Memory Capsule
                        </Text>
                        <Text style={styles.memoryCapsuleCreateSubtitle}>
                          Zapakiraj stvari sada · otvori ih kasnije
                        </Text>
                      </View>
                      <Text style={styles.bigBoxCreateArrow}>›</Text>
                    </Pressable>

                    {capsules.length > 0 ? (
                      <View style={styles.memoryCapsuleSection}>
                        <View style={styles.bigBoxSectionHeading}>
                          <Text style={styles.bigBoxSectionLabel}>
                            MEMORY CAPSULES
                          </Text>
                          <Text style={styles.bigBoxSectionCount}>
                            {capsules.length}
                          </Text>
                        </View>

                        {capsules.map((capsule) => (
                          <MemoryCapsuleCard
                            key={capsule.capsuleId}
                            capsule={capsule}
                            onPress={() =>
                              navigation.navigate('MemoryCapsule', {
                                capsuleId: capsule.capsuleId,
                              })
                            }
                          />
                        ))}
                      </View>
                    ) : null}

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingBigBox(null);
                        setBigBoxEditorVisible(true);
                      }}
                      style={({ pressed }) => [
                        styles.bigBoxCreateCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.bigBoxCreateGlyph}>
                        <Text
                          allowFontScaling={false}
                          style={styles.bigBoxParcelEmoji}
                        >
                          {'\u{1F4E6}'}
                        </Text>
                      </View>
                      <View style={styles.createCopy}>
                        <Text style={styles.bigBoxCreateTitle}>
                          Novi Big Box
                        </Text>
                        <Text style={styles.bigBoxCreateSubtitle}>
                          Spremi više Memory Boxeva u jednu veću kutiju
                        </Text>
                      </View>
                      <Text style={styles.bigBoxCreateArrow}>›</Text>
                    </Pressable>

                    {bigBoxes.length > 0 ? (
                      <View style={styles.bigBoxSection}>
                        <View style={styles.bigBoxSectionHeading}>
                          <Text style={styles.bigBoxSectionLabel}>
                            BIG BOXES
                          </Text>
                          <Text style={styles.bigBoxSectionCount}>
                            {bigBoxes.length}
                          </Text>
                        </View>

                        {bigBoxes.map((box) => {
                          const byId = new Map(
                            collections.map((collection) => [
                              collection.collectionId,
                              collection.name,
                            ]),
                          );

                          return (
                            <CollectionBigBoxCard
                              key={box.bigBoxId}
                              box={box}
                              childNames={box.collectionIds
                                .map((collectionId) => byId.get(collectionId))
                                .filter(
                                  (value): value is string =>
                                    Boolean(value),
                                )}
                              onOpen={() => {
                                setActiveBigBoxId(box.bigBoxId);
                                activeBigBoxIdRef.current = box.bigBoxId;
                                setReorderMode(false);
                              }}
                              onEdit={() => {
                                setEditingBigBox(box);
                                setBigBoxEditorVisible(true);
                              }}
                            />
                          );
                        })}
                      </View>
                    ) : null}

                    {bigBoxes.length > 0 &&
                    visibleCollections.length > 0 ? (
                      <Text style={styles.unboxedLabel}>
                        NEPOSPREMLJENE KOLEKCIJE
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </>
            )}

            {error ? (
              <Pressable
                onPress={() => void load()}
                style={styles.errorBanner}
              >
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>Pokušaj ponovno</Text>
              </Pressable>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.black}
              size="large"
              style={styles.loader}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyMark}>✧</Text>
              <Text style={styles.emptyTitle}>
                {activeBigBox
                  ? 'Big Box je prazan'
                  : bigBoxes.length > 0 || capsules.length > 0
                    ? 'Sve je pospremljeno'
                    : 'Nema Memory Boxeva'}
              </Text>
              <Text style={styles.emptyText}>
                {activeBigBox
                  ? 'Dodaj postojeće kolekcije kroz Uredi Big Box ili napravi novu ovdje.'
                  : bigBoxes.length > 0 || capsules.length > 0
                    ? 'Sve tvoje kolekcije su trenutno pospremljene u Big Boxeve ili Memory Capsules.'
                    : 'Napravi prvu kutiju i u nju složi stvari koje prirodno pripadaju zajedno.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <CollectionMemoryBoxCard
            collection={item}
            index={index}
            count={visibleCollections.length}
            reorderMode={reorderMode}
            reorderBusy={reorderSaving}
            onOpen={() =>
              navigation.navigate('CollectionDetails', {
                collectionId: item.collectionId,
              })
            }
            onMove={moveDuringDrag}
            onDrop={finishDrag}
            onMoveButton={moveWithButton}
            onDragStateChange={setDragging}
          />
        )}
      
        onScroll={(event) => {
          // ljingleSemanticAliveR1:scroll-collections
          updateCelestialParallax(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
      />

      <Modal
        animationType="slide"
        visible={createVisible}
        onRequestClose={() => setCreateVisible(false)}
      >
        <ModalSafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Natrag na kolekcije"
              hitSlop={12}
              onPress={() => setCreateVisible(false)}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>MEMORY BOX</Text>
              <Text style={styles.modalTitle}>Nova kolekcija</Text>
            </View>
          </View>

          <CollectionEditorForm
            name={name}
            description={description}
            symbol={symbol}
            saving={saving}
            submitLabel="Spremi Memory Box"
            errorMessage={error}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onSymbolChange={setSymbol}
            onSubmit={() => void create()}
          />
        </ModalSafeAreaView>
      </Modal>

      <MemoryCapsuleEditorModal
        visible={memoryCapsuleEditorVisible}
        onClose={() => setMemoryCapsuleEditorVisible(false)}
        onSaved={(saved) => {
          setCapsules((current) => [
            saved,
            ...current.filter(
              (capsule) =>
                capsule.capsuleId !== saved.capsuleId,
            ),
          ]);
          navigation.navigate('MemoryCapsule', {
            capsuleId: saved.capsuleId,
          });
        }}
      />

      <CollectionBigBoxEditorModal
        visible={bigBoxEditorVisible}
        box={editingBigBox}
        allBoxes={bigBoxes}
        collections={collections.filter(
          (collection) =>
            !capsuleBackingIds.has(collection.collectionId),
        )}
        onClose={() => {
          setBigBoxEditorVisible(false);
          setEditingBigBox(null);
        }}
        onSaved={(nextBoxes) => {
          bigBoxesRef.current = nextBoxes;
          setBigBoxes(nextBoxes);

          if (
            activeBigBoxIdRef.current &&
            !nextBoxes.some(
              (box) =>
                box.bigBoxId === activeBigBoxIdRef.current,
            )
          ) {
            activeBigBoxIdRef.current = null;
            setActiveBigBoxId(null);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 54,
  },
  hero: { paddingTop: 10, paddingBottom: 20 },
  starRail: {
    width: 154,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  star: { color: STAR_GOLD, fontSize: 12, opacity: 0.82 },
  starLine: {
    flex: 1,
    height: 1,
    backgroundColor: STAR_GOLD,
    opacity: 0.24,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    marginTop: 5,
    color: colors.text,
    fontSize: 41,
    lineHeight: 47,
    fontWeight: '900',
    letterSpacing: -1.25,
  },
  intro: {
    marginTop: 8,
    maxWidth: 610,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  definition: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: colors.fill,
  },
  definitionStar: { color: STAR_GOLD, fontSize: 11 },
  definitionText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  reorderButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  reorderButtonActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  reorderButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  reorderButtonTextActive: { color: colors.white },
  reorderNotice: {
    minHeight: 78,
    marginBottom: 17,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STAR_GOLD,
    backgroundColor: colors.surface,
  },
  reorderNoticeMark: {
    width: 42,
    color: STAR_GOLD,
    fontSize: 25,
    textAlign: 'center',
    fontWeight: '900',
  },
  reorderNoticeCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  reorderNoticeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  reorderNoticeText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  createCard: {
    minHeight: 88,
    marginBottom: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.black,
    overflow: 'hidden',
  },
  createMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  createPlus: {
    color: colors.onAccent,
    fontSize: 30,
    textAlign: 'center',
  },
  createStar: {
    position: 'absolute',
    right: 0,
    top: 0,
    color: colors.onAccent,
    fontSize: 11,
  },
  createCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  createTitle: { color: colors.onAccent, fontSize: 17, fontWeight: '900' },
  createSubtitle: {
    marginTop: 3,
    color: colors.onAccent,
    fontSize: 11,
    lineHeight: 15,
  },
  createArrow: {
    marginLeft: 10,
    color: colors.onAccent,
    fontSize: 30,
    fontWeight: '300',
    opacity: 1,
  },
  memoryCapsuleCreateCard: {
    minHeight: 88,
    marginTop: -6,
    marginBottom: 13,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  memoryCapsuleCreateIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    overflow: 'visible',
  },
  memoryCapsuleClockBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    width: 17,
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  memoryCapsuleClockCrown: {
    position: 'absolute',
    top: 0,
    left: 6.5,
    width: 4,
    height: 3,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: activeAccentColor,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  memoryCapsuleClockFace: {
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6.5,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.fillStrong,
  },
  memoryCapsuleClockCenter: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: activeAccentColor,
  },
  memoryCapsuleClockHandLong: {
    position: 'absolute',
    width: 1.5,
    height: 4.5,
    borderRadius: 1,
    backgroundColor: activeAccentColor,
    transform: [{ translateY: -1.5 }],
  },
  memoryCapsuleClockHandShort: {
    position: 'absolute',
    width: 3.5,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: activeAccentColor,
    transform: [{ translateX: 1.5 }],
  },
  memoryCapsuleCreateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  memoryCapsuleCreateSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 14,
  },
  memoryCapsuleSection: {
    marginBottom: 15,
  },
  bigBoxToolbar: {
    marginBottom: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  bigBoxToolbarButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  bigBoxToolbarText: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '900',
  },
  createPlusContrastR1: {
    color: colors.onAccent,
    opacity: 1,
    zIndex: 2,
  },
  bigBoxCreateCard: {
    minHeight: 92,
    marginTop: -6,
    marginBottom: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  bigBoxCreateGlyph: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    overflow: 'visible',
  },
  bigBoxParcelEmoji: {
    fontSize: 43,
    lineHeight: 52,
    textAlign: 'center',
    includeFontPadding: false,
  },
  bigBoxParcel: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBoxParcelBody: {
    position: 'relative',
    width: 34,
    height: 30,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  bigBoxParcelTape: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 12,
    width: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.fillStrong,
  },
  bigBoxParcelTopLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 9,
    height: 1.5,
    backgroundColor: activeAccentColor,
  },
  bigBoxParcelFoldLeft: {
    position: 'absolute',
    left: -2,
    top: 4,
    width: 21,
    height: 1.5,
    backgroundColor: activeAccentColor,
    transform: [{ rotate: '27deg' }],
  },
  bigBoxParcelFoldRight: {
    position: 'absolute',
    right: -2,
    top: 4,
    width: 21,
    height: 1.5,
    backgroundColor: activeAccentColor,
    transform: [{ rotate: '-27deg' }],
  },
  bigBoxCreateGlyphText: {
    color: activeAccentColor,
    fontSize: 24,
    fontWeight: '800',
  },
  bigBoxCreateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  bigBoxCreateSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 14,
  },
  bigBoxCreateArrow: {
    marginLeft: 10,
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '300',
  },
  bigBoxSection: {
    marginBottom: 7,
  },
  bigBoxSectionHeading: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigBoxSectionLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  bigBoxSectionCount: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
  },
  unboxedLabel: {
    marginTop: 7,
    marginBottom: 12,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  errorBanner: {
    marginBottom: 15,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  retryText: {
    marginTop: 4,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  loader: { marginTop: 50 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyMark: { color: STAR_GOLD, fontSize: 40 },
  emptyTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 330,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  backButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  backText: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '400',
  },
  modalHeaderCopy: { flex: 1, minWidth: 0, marginLeft: 4 },
  modalEyebrow: {
    color: STAR_GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  modalTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  pressed: { opacity: 0.7 },
  heroCelestial: {
    marginTop: 8,
    marginBottom: 18,
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: 17,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.34),
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrowCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.8,
  },
  headingCelestial: {
    letterSpacing: -0.45,
  },
  introCelestial: {
    maxWidth: 520,
  },
  celestialHeroSeal: {
    marginTop: 16,
    color: CELESTIAL_GOLD,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 2.1,
    textAlign: 'center',
    opacity: 0.82,
  },
  createCardCelestial: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.60),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 3,
  },
  createPlusCelestial: {
    color: CELESTIAL_GOLD,
  },
  createTitleCelestial: {
    color: celestial.ivory,
    letterSpacing: 0.15,
  },
  createSubtitleCelestial: {
    color: celestial.ivoryMuted,
  },
  cardCelestial: {
    position: 'relative',
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 1,
  },
  cardCelestialEdge: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 5,
    height: 1,
    backgroundColor: celestialAlpha(celestial.gold, 0.24),
  },
  cardCelestialStar: {
    position: 'absolute',
    top: 10,
    right: 13,
    color: CELESTIAL_GOLD,
    fontSize: 9,
    opacity: 0.62,
  },
  symbolCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.52),
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
  },
  symbolTextCelestial: {
    color: colors.text,
  },
  cardTitleCelestial: {
    letterSpacing: 0.05,
  },
  cardCountCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
});
