// forkLCollectionsMemoryBoxV2
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionEditorForm } from '../components/CollectionEditorForm';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { CollectionMemoryBoxCard } from '../components/CollectionMemoryBoxCard';
import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { CollectionSummary } from '../types/collection';
import type { RootStackParamList } from '../types/navigation';
import { createdFeedback } from '../utils/crudFeedback';
import { setPaletteInteractionLock } from '../utils/paletteInteractionLock';
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';

import { celestial, celestialAlpha } from '../theme/celestial';
type Props = NativeStackScreenProps<RootStackParamList, 'Collections'>;

// forkN2CelestialCollectionsTopicsV2
const celestialMode = activeVisualSkinId === 'classic';
const CELESTIAL_GOLD = celestial.gold;

const STAR_GOLD = '#D3A11B';

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

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [reorderDirty, setReorderDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  // forkN51FinalMotionRadioProfileV1
  const [dragPreview, setDragPreview] = useState<{
    fromIndex: number;
    targetIndex: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setCollections(await collectionApi.getAll());
      setReorderDirty(false);
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

  const persistOrder = useCallback(
    async (nextCollections?: CollectionSummary[]) => {
      const source = nextCollections ?? collectionsRef.current;

      if (reorderSaving || source.length === 0) return false;

      setReorderSaving(true);
      setError(null);

      try {
        const saved = await collectionApi.reorder(
          source.map((item) => item.collectionId),
        );

        setCollections(saved);
        setReorderDirty(false);
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Redoslijed nije spremljen.',
        );
        return false;
      } finally {
        setReorderSaving(false);
      }
    },
    [reorderSaving],
  );

  const moveDuringDrag = (fromIndex: number, toIndex: number) => {
    // forkN51FinalMotionRadioProfileV1: during the gesture siblings are already visually occupying
    // their future slots. Commit the real array exactly once after the dragged
    // card lands; no second LayoutAnimation is needed here.
    const next = moveItem(
      collectionsRef.current,
      fromIndex,
      toIndex,
    );

    if (next === collectionsRef.current) {
      setDragPreview(null);
      return;
    }

    setCollections(next);
    setDragPreview(null);
    setReorderDirty(true);

    // Persist the exact committed order instead of waiting for a render/ref tick.
    void persistOrder(next);
  };

  const moveWithButton = (fromIndex: number, toIndex: number) => {
    const next = moveItem(collections, fromIndex, toIndex);
    if (next === collections) return;

    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut,
    );

    setCollections(next);
    setReorderDirty(true);
    void persistOrder(next);
  };

  const finishReorder = async () => {
    if (dragging || reorderSaving) return;

    if (reorderDirty) {
      const saved = await persistOrder();
      if (!saved) return;
    }

    setDragPreview(null);
    setReorderMode(false);
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['left', 'right', 'bottom']}
    >
      <FlatList
        data={collections}
        keyExtractor={(item) => item.collectionId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, celestialMode && styles.heroCelestial]}>
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
                    LJINGLE · MEMORY BOXES
                  </Text>
                  <Text style={[styles.heading, celestialMode && styles.headingCelestial]}>Kolekcije</Text>
                </View>

                {collections.length > 1 ? (
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
                Playliste, scrapbookovi, police i mali arhivi.
              </Text>

              <View style={styles.definition}>
                <Text style={styles.definitionStar}>✧</Text>
                <Text style={styles.definitionText}>
                  Collection = što pripada zajedno.
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
                    Povuci ručku ili koristi strelice. Command Palette
                    je privremeno zaključan dok uređuješ.
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreateVisible(true)}
                style={({ pressed }) => [
                  styles.createCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.createMark}>
                  {celestialMode ? <Text pointerEvents="none" style={styles.createStar}>✦</Text> : null}
              <Text style={[styles.createPlus, celestialMode && styles.createPlusCelestial]}>＋</Text>
                  <Text style={styles.createStar}>✦</Text>
                </View>

                <View style={styles.createCopy}>
                  <Text style={styles.createTitle}>Nova Memory Box</Text>
                  <Text style={styles.createSubtitle}>
                    Playlist, scrapbook, research packet ili sezona
                  </Text>
                </View>

                <Text style={styles.createArrow}>›</Text>
              </Pressable>
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
              <Text style={styles.emptyTitle}>Nema Memory Boxeva</Text>
              <Text style={styles.emptyText}>
                Napravi prvu kutiju i u nju složi stvari koje
                prirodno pripadaju zajedno.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <CollectionMemoryBoxCard
            collection={item}
            index={index}
            count={collections.length}
            reorderMode={reorderMode}
            previewFromIndex={dragPreview?.fromIndex ?? null}
            previewTargetIndex={dragPreview?.targetIndex ?? null}
            onOpen={() =>
              navigation.navigate('CollectionDetails', {
                collectionId: item.collectionId,
              })
            }
            onMove={moveDuringDrag}
            onDrop={() => {
              // Drag commits persist inside moveDuringDrag with the exact order.
            }}
            onPreviewMove={(fromIndex, targetIndex) => {
              setDragPreview({
                fromIndex,
                targetIndex,
              });
            }}
            onPreviewClear={() => {
              setDragPreview(null);
            }}
            onMoveButton={moveWithButton}
            onDragStateChange={setDragging}
          />
        )}
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
    color: colors.white,
    fontSize: 30,
    textAlign: 'center',
  },
  createStar: {
    position: 'absolute',
    right: 0,
    top: 0,
    color: STAR_GOLD,
    fontSize: 11,
  },
  createCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  createTitle: { color: colors.white, fontSize: 17, fontWeight: '900' },
  createSubtitle: {
    marginTop: 3,
    color: '#C7C7CC',
    fontSize: 11,
    lineHeight: 15,
  },
  createArrow: {
    marginLeft: 10,
    color: colors.white,
    fontSize: 30,
    fontWeight: '300',
    opacity: 0.75,
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
