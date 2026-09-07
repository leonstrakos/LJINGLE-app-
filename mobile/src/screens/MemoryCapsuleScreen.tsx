// memoryCapsuleBoxedV1
// boxedThemeSafeR4
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collectionApi } from '../services/collectionApi';
import {
  addCollectionToMemoryCapsule,
  deleteMemoryCapsule,
  getMemoryCapsule,
  getMemoryCapsules,
  isMemoryCapsuleLocked,
  markMemoryCapsuleOpened,
  memoryCapsuleDateLabel,
  pickAndAddMemoryCapsuleImages,
  removeCollectionFromMemoryCapsule,
  removeMemoryCapsuleImage,
  sealMemoryCapsule,
} from '../services/memoryCapsules';
import {
  activeAccentColor,
  colors,
} from '../theme/colors';
import { themeColorWithAlpha, themeInkOn } from '../theme/themeColorUtils';
import type {
  CollectionDetail,
  EntityReference,
} from '../types/collection';
import type { RootStackParamList } from '../types/navigation';
import type {
  MemoryCapsule,
  MemoryCapsuleDetail,
} from '../types/memoryCapsule';
import { LjingleBoxedReveal } from '../components/LjingleBoxedReveal';
import { MemoryCapsuleEditorModal } from '../components/MemoryCapsuleEditorModal';
import { MemoryCapsuleActionModal } from '../components/MemoryCapsuleActionModal';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'MemoryCapsule'
>;

function openItem(
  navigation: Props['navigation'],
  item: CollectionDetail['items'][number],
) {
  const rootNavigation = navigation as unknown as {
    navigate: (screen: string, params?: unknown) => void;
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
      rootNavigation.navigate('Entries', {
        focusEntryId: item.entityId,
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
}

export function MemoryCapsuleScreen({
  route,
  navigation,
}: Props) {
  const { capsuleId } = route.params;
  const [capsule, setCapsule] =
    useState<MemoryCapsuleDetail | null>(null);
  const [backing, setBacking] =
    useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [collectionPickerVisible, setCollectionPickerVisible] =
    useState(false);
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [referenceQuery, setReferenceQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [allCollections, setAllCollections] = useState<
    Awaited<ReturnType<typeof collectionApi.getAll>>
  >([]);
  const [showReveal, setShowReveal] = useState(false);
  const [packingMode, setPackingMode] = useState(false);
  // ljingleMemoryCapsuleActionContrastR9:screen
  const [confirmAction, setConfirmAction] =
    useState<'seal' | 'delete' | null>(null);
  const [confirmError, setConfirmError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextCapsule = await getMemoryCapsule(capsuleId);
      setCapsule(nextCapsule);

      const nextBacking = await collectionApi.getById(
        nextCapsule.backingCollectionId,
      );
      setBacking(nextBacking);

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Memory Capsule se nije učitala.',
      );
    } finally {
      setLoading(false);
    }
  }, [capsuleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!capsule?.openedAt) return;
    setShowReveal(false);
  }, [capsule?.openedAt]);

  // ljingleMemoryCapsuleTrueSealR8:screen
  const sealed = Boolean(capsule?.sealedAt);
  const locked = capsule
    ? isMemoryCapsuleLocked(capsule)
    : false;
  const canOpen = Boolean(
    capsule &&
      sealed &&
      !locked &&
      !capsule.openedAt,
  );
  const editable = Boolean(
    capsule &&
      !sealed &&
      !capsule.openedAt &&
      packingMode,
  );
  const contentVisible = Boolean(
    capsule?.openedAt || editable,
  );

  const memberKeys = useMemo(
    () =>
      new Set(
        backing?.items.map(
          (item) => item.entityType + ':' + item.entityId,
        ) || [],
      ),
    [backing],
  );

  const openItemPicker = async () => {
    if (!editable) return;
    setItemPickerVisible(true);
    setPickerLoading(true);
    setReferenceQuery('');
    try {
      setReferences(await collectionApi.searchReferences(''));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Arhiv se nije učitao.',
      );
    } finally {
      setPickerLoading(false);
    }
  };

  const searchReferences = async (value: string) => {
    setReferenceQuery(value);
    setPickerLoading(true);
    try {
      setReferences(
        await collectionApi.searchReferences(value),
      );
    } catch {
      // Keep the previous results while typing through a transient failure.
    } finally {
      setPickerLoading(false);
    }
  };

  const addReference = async (reference: EntityReference) => {
    if (!capsule || !backing || busy || !editable) return;
    setBusy(true);
    setError(null);
    try {
      const item = await collectionApi.addItem(
        capsule.backingCollectionId,
        reference.entityType,
        reference.entityId,
      );
      setBacking({
        ...backing,
        items: [...backing.items, item],
      });
      setCapsule(await getMemoryCapsule(capsuleId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Stavka nije dodana.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeReference = async (itemId: string) => {
    if (!capsule || !backing || busy || !editable) return;
    setBusy(true);
    setError(null);
    try {
      await collectionApi.removeItem(
        capsule.backingCollectionId,
        itemId,
      );
      setBacking({
        ...backing,
        items: backing.items.filter(
          (item) => item.itemId !== itemId,
        ),
      });
      setCapsule(await getMemoryCapsule(capsuleId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Stavka nije uklonjena.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openCollectionPicker = async () => {
    if (!editable) return;
    setCollectionPickerVisible(true);
    setPickerLoading(true);
    try {
      const [collections, capsules] = await Promise.all([
        collectionApi.getAll(),
        getMemoryCapsules(),
      ]);
      const backingIds = new Set(
        capsules.map((item) => item.backingCollectionId),
      );
      setAllCollections(
        collections.filter(
          (collection) =>
            !backingIds.has(collection.collectionId),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcije se nisu učitale.',
      );
    } finally {
      setPickerLoading(false);
    }
  };

  const addLinkedCollection = async (collectionId: string) => {
    if (!capsule || busy || !editable) return;
    setBusy(true);
    try {
      setCapsule(
        await addCollectionToMemoryCapsule(
          capsuleId,
          collectionId,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Kolekcija nije dodana.',
      );
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async () => {
    if (!editable || busy) return;
    setBusy(true);
    setError(null);
    try {
      setCapsule(
        await pickAndAddMemoryCapsuleImages(capsuleId),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Slika nije dodana.',
      );
    } finally {
      setBusy(false);
    }
  };

  const finishPacking = () => {
    if (!capsule || busy || !editable) return;

    setConfirmError(null);
    setConfirmAction('seal');
  };

  const destroy = () => {
    // Delete is intentionally allowed whether the capsule is packing,
    // sealed, ready, or already opened.
    if (!capsule || busy) return;

    setConfirmError(null);
    setConfirmAction('delete');
  };

  const cancelCapsuleAction = () => {
    if (busy) return;

    setConfirmAction(null);
    setConfirmError(null);
  };

  const confirmCapsuleAction = async () => {
    if (!capsule || busy || !confirmAction) return;

    setBusy(true);
    setConfirmError(null);
    setError(null);

    try {
      if (confirmAction === 'seal') {
        const sealedCapsule =
          await sealMemoryCapsule(capsuleId);

        setCapsule(sealedCapsule);
        setPackingMode(false);
        setConfirmAction(null);
        return;
      }

      await deleteMemoryCapsule(capsuleId);
      setConfirmAction(null);
      navigation.goBack();
    } catch (caught) {
      setConfirmError(
        caught instanceof Error
          ? caught.message
          : confirmAction === 'seal'
            ? 'Kapsula se nije mogla zapečatiti.'
            : 'Memory Capsule nije obrisana.',
      );
    } finally {
      setBusy(false);
    }
  };

  const capsuleActionModal = capsule ? (
    <MemoryCapsuleActionModal
      confirmLabel={
        confirmAction === 'delete'
          ? 'Obriši'
          : 'Zapečati'
      }
      errorMessage={confirmError}
      loading={busy}
      message={
        confirmAction === 'delete'
          ? 'Kapsula i njezine vlastite slike bit će trajno obrisane. Originalne knjige, filmovi, igre, Zapisi, Frekvencije i povezane kolekcije ostaju.'
          : capsule.openOn
            ? 'Nakon zapečaćivanja sadržaj se više ne može mijenjati. Kapsula ostaje zaključana do postavljenog datuma.'
            : 'Nakon zapečaćivanja sadržaj se više ne može mijenjati. Kapsulu ćeš moći otvoriti odmah.'
      }
      onCancel={cancelCapsuleAction}
      onConfirm={() => void confirmCapsuleAction()}
      title={
        confirmAction === 'delete'
          ? 'Obrisati Memory Capsule?'
          : 'Zapečatiti Memory Capsule?'
      }
      tone={
        confirmAction === 'delete'
          ? 'danger'
          : 'accent'
      }
      visible={confirmAction !== null}
    />
  ) : null;

  if (loading && !capsule) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          color={activeAccentColor}
          size="large"
        />
      </SafeAreaView>
    );
  }

  if (!capsule || !backing) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>
          {error || 'Memory Capsule nije pronađena.'}
        </Text>
      </SafeAreaView>
    );
  }

  if (!capsule.openedAt && !packingMode) {
    return (
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={styles.safe}
      >
        <ScrollView contentContainerStyle={styles.lockedContent}>
          <View
            style={[
              styles.sealedCard,
              sealed && !locked && styles.sealedCardReady,
            ]}
          >
            <Text style={styles.sealedStar}>✦</Text>
            <Text style={styles.sealedEyebrow}>
              {!sealed
                ? 'LJINGLE BOXED · PAKIRANJE'
                : locked
                  ? 'LJINGLE BOXED · ZAPEČAĆENO'
                  : 'LJINGLE BOXED · SPREMNO'}
            </Text>

            <Text style={styles.sealedTitle}>
              {capsule.title}
            </Text>

            {capsule.description ? (
              <Text style={styles.sealedDescription}>
                {capsule.description}
              </Text>
            ) : null}

            {!sealed && capsule.openOn ? (
              <View style={styles.dateSeal}>
                <Text style={styles.dateSealLabel}>
                  PLANIRANO OTVARANJE
                </Text>
                <Text style={styles.dateSealValue}>
                  {memoryCapsuleDateLabel(capsule.openOn)}
                </Text>
              </View>
            ) : sealed && locked ? (
              <View style={styles.dateSeal}>
                <Text style={styles.dateSealLabel}>
                  OTVARA SE
                </Text>
                <Text style={styles.dateSealValue}>
                  {memoryCapsuleDateLabel(capsule.openOn)}
                </Text>
              </View>
            ) : canOpen ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowReveal(true)}
                style={({ pressed }) => [
                  styles.readyOpenButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.readyOpenText}>
                  OTVORI LJINGLE BOX
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.lockedHint}>
            {!sealed
              ? 'Kapsula još nije zapečaćena. Dovrši sadržaj, zatim odaberi ZAVRŠI PAKIRANJE.'
              : locked
                ? 'Sadržaj je zapečaćen i ne može se mijenjati do otvaranja.'
                : 'Kapsula je zapečaćena i spremna za prvo otvaranje.'}
          </Text>

          {!sealed ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPackingMode(true)}
                style={({ pressed }) => [
                  styles.packButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.packButtonText}>
                  PAKIRAJ KAPSULU
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setEditorVisible(true)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Uredi naslov i datum
                </Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={destroy}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.deleteText}>
              Obriši Memory Capsule
            </Text>
          </Pressable>
        </ScrollView>

        <LjingleBoxedReveal
          actionLabel="OTVORI"
          label="LJINGLE BOXED · MEMORY CAPSULE"
          onOpened={async () => {
            const opened =
              await markMemoryCapsuleOpened(capsuleId);
            setCapsule(opened);
            setShowReveal(false);
          }}
          onRequestClose={() => setShowReveal(false)}
          subtitle={capsule.description}
          title={capsule.title}
          visible={showReveal && canOpen}
        />

        <MemoryCapsuleEditorModal
          capsule={capsule}
          onClose={() => setEditorVisible(false)}
          onSaved={(saved) => {
            setCapsule({
              ...capsule,
              ...saved,
            });
          }}
          visible={editorVisible && !sealed}
        />

        {capsuleActionModal}
      </SafeAreaView>
    );
  }

  const linkedCollectionIds = new Set(
    capsule.collections.map(
      (collection) => collection.collectionId,
    ),
  );

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={styles.safe}
    >
      <FlatList
        contentContainerStyle={styles.content}
        data={backing.items}
        keyExtractor={(item) => item.itemId}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>
                MEMORY CAPSULE · {packingMode ? 'PAKIRANJE' : 'OTVORENO'}
              </Text>
              <Text style={styles.heading}>
                {capsule.title}
              </Text>
              {capsule.description ? (
                <Text style={styles.intro}>
                  {capsule.description}
                </Text>
              ) : null}

              {packingMode ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={finishPacking}
                  style={({ pressed }) => [
                    styles.openBoxButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.openBoxText}>
                    ZAVRŠI PAKIRANJE
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.openedPill}>
                  <Text style={styles.openedPillText}>
                    ✦ LJINGLE BOXED · OPEN
                  </Text>
                </View>
              )}
            </View>

            {error ? (
              <Text style={styles.errorBanner}>{error}</Text>
            ) : null}

            {contentVisible ? (
              <>
                {editable ? (
                  <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void openItemPicker()}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.actionMark}>＋</Text>
                    <Text style={styles.actionText}>Stvar</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void addPhotos()}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.actionMark}>▧</Text>
                    <Text style={styles.actionText}>Slika</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void openCollectionPicker()}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.actionMark}>▣</Text>
                    <Text style={styles.actionText}>Kolekcija</Text>
                  </Pressable>
                  </View>
                ) : null}

                {capsule.images.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>SLIKE</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {capsule.images.map((image) => (
                        <View
                          key={image.imageId}
                          style={styles.imageCard}
                        >
                          <Image
                            source={{ uri: image.uri }}
                            style={styles.image}
                          />
                          {editable ? (
                          <Pressable
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => {
                              void removeMemoryCapsuleImage(
                                capsuleId,
                                image.imageId,
                              ).then(setCapsule);
                            }}
                            style={styles.imageDelete}
                          >
                            <Text style={styles.imageDeleteText}>
                              ×
                            </Text>
                          </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {capsule.collections.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                      KOLEKCIJE
                    </Text>
                    {capsule.collections.map((collection) => (
                      <Pressable
                        key={collection.collectionId}
                        accessibilityRole="button"
                        onPress={() =>
                          navigation.navigate('CollectionDetails', {
                            collectionId:
                              collection.collectionId,
                          })
                        }
                        style={({ pressed }) => [
                          styles.linkedCollection,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.linkedSymbol}>
                          {collection.symbol || '◇'}
                        </Text>
                        <View style={styles.linkedCopy}>
                          <Text style={styles.linkedTitle}>
                            {collection.name}
                          </Text>
                          <Text style={styles.linkedMeta}>
                            {collection.itemCount} stvari
                          </Text>
                        </View>
                        {editable ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            void removeCollectionFromMemoryCapsule(
                              capsuleId,
                              collection.collectionId,
                            ).then(setCapsule);
                          }}
                          style={styles.unlink}
                        >
                          <Text style={styles.unlinkText}>×</Text>
                        </Pressable>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionLabel}>
                    STVARI
                  </Text>
                  <Text style={styles.sectionCount}>
                    {backing.items.length}
                  </Text>
                </View>
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          contentVisible ? (
            <View style={styles.empty}>
              <Text style={styles.emptyMark}>✧</Text>
              <Text style={styles.emptyTitle}>
                Kapsula je otvorena
              </Text>
              <Text style={styles.emptyText}>
                Dodaj Zapis, pjesmu, knjigu, film, igru, sliku ili cijelu kolekciju.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          contentVisible ? (
            <View style={styles.itemRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openItem(navigation, item)}
                style={({ pressed }) => [
                  styles.itemOpen,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.itemType}>
                  {item.entityType}
                </Text>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      numberOfLines={1}
                      style={styles.itemSubtitle}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {editable ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void removeReference(item.itemId)}
                style={styles.itemDelete}
              >
                <Text style={styles.itemDeleteText}>×</Text>
              </Pressable>
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          contentVisible ? (
            <View style={styles.footer}>
              {editable ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditorVisible(true)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Uredi kapsulu
                </Text>
              </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={destroy}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.deleteText}>
                  Obriši Memory Capsule
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      <LjingleBoxedReveal
        actionLabel="OTVORI"
        label="LJINGLE BOXED · MEMORY CAPSULE"
        onOpened={async () => {
          const opened =
            await markMemoryCapsuleOpened(capsuleId);
          setCapsule(opened);
          setShowReveal(false);
        }}
        onRequestClose={() => setShowReveal(false)}
        subtitle={capsule.description}
        title={capsule.title}
        visible={showReveal && canOpen}
      />

      <MemoryCapsuleEditorModal
        capsule={capsule}
        onClose={() => setEditorVisible(false)}
        onSaved={(saved) => {
          setCapsule({
            ...capsule,
            ...saved,
          });
        }}
        visible={editorVisible && editable}
      />

        {capsuleActionModal}

      <Modal
        animationType="slide"
        onRequestClose={() => setItemPickerVisible(false)}
        visible={itemPickerVisible}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setItemPickerVisible(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>‹</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              Dodaj iz LJinglea
            </Text>
          </View>

          <TextInput
            autoCapitalize="none"
            onChangeText={(value) =>
              void searchReferences(value)
            }
            placeholder="Pretraži knjige, filmove, igre, Zapise, Frekvencije…"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            value={referenceQuery}
          />

          {pickerLoading ? (
            <ActivityIndicator
              color={activeAccentColor}
              style={styles.pickerSpinner}
            />
          ) : null}

          <FlatList
            contentContainerStyle={styles.modalList}
            data={references}
            keyExtractor={(item) =>
              item.entityType + ':' + item.entityId
            }
            renderItem={({ item }) => {
              const selected = memberKeys.has(
                item.entityType + ':' + item.entityId,
              );

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={selected || busy}
                  onPress={() => void addReference(item)}
                  style={({ pressed }) => [
                    styles.referenceRow,
                    selected && styles.referenceSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.referenceType}>
                    {item.entityType}
                  </Text>
                  <View style={styles.referenceCopy}>
                    <Text
                      numberOfLines={1}
                      style={styles.referenceTitle}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text
                        numberOfLines={1}
                        style={styles.referenceSubtitle}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.referenceAction}>
                    {selected ? '✓' : '＋'}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() =>
          setCollectionPickerVisible(false)
        }
        visible={collectionPickerVisible}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() =>
                setCollectionPickerVisible(false)
              }
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>‹</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              Dodaj kolekciju
            </Text>
          </View>

          {pickerLoading ? (
            <ActivityIndicator
              color={activeAccentColor}
              style={styles.pickerSpinner}
            />
          ) : (
            <FlatList
              contentContainerStyle={styles.modalList}
              data={allCollections}
              keyExtractor={(item) => item.collectionId}
              renderItem={({ item }) => {
                const selected =
                  linkedCollectionIds.has(item.collectionId);
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={selected || busy}
                    onPress={() =>
                      void addLinkedCollection(
                        item.collectionId,
                      )
                    }
                    style={({ pressed }) => [
                      styles.referenceRow,
                      selected &&
                        styles.referenceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.collectionGlyph}>
                      {item.symbol || '◇'}
                    </Text>
                    <View style={styles.referenceCopy}>
                      <Text style={styles.referenceTitle}>
                        {item.name}
                      </Text>
                      <Text style={styles.referenceSubtitle}>
                        {item.itemCount} stvari
                      </Text>
                    </View>
                    <Text style={styles.referenceAction}>
                      {selected ? '✓' : '＋'}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  hero: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heading: {
    marginTop: 8,
    color: colors.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
  },
  intro: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  openBoxButton: {
    minHeight: 52,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: activeAccentColor,
  },
  openBoxText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  openedPill: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
  },
  openedPillText: {
    color: activeAccentColor,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 9,
  },
  actionButton: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  actionMark: {
    color: activeAccentColor,
    fontSize: 19,
    fontWeight: '900',
  },
  actionText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  section: { marginTop: 24 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  sectionTitleRow: {
    marginTop: 26,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionCount: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
  },
  imageCard: {
    width: 132,
    height: 168,
    marginTop: 10,
    marginRight: 10,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  image: { width: '100%', height: '100%' },
  imageDelete: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: themeColorWithAlpha(colors.text, 0.72),
  },
  imageDeleteText: {
    color: themeInkOn(colors.text),
    fontSize: 18,
    lineHeight: 20,
  },
  linkedCollection: {
    minHeight: 68,
    marginTop: 9,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  linkedSymbol: {
    width: 42,
    color: activeAccentColor,
    fontSize: 20,
    textAlign: 'center',
  },
  linkedCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 7,
  },
  linkedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  linkedMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
  },
  unlink: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkText: {
    color: colors.textMuted,
    fontSize: 22,
  },
  itemRow: {
    minHeight: 72,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  itemOpen: {
    flex: 1,
    minWidth: 0,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemType: {
    width: 74,
    color: activeAccentColor,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  itemSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
  },
  itemDelete: {
    width: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.separator,
  },
  itemDeleteText: {
    color: colors.textMuted,
    fontSize: 22,
  },
  empty: {
    minHeight: 180,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyMark: {
    color: activeAccentColor,
    fontSize: 28,
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    maxWidth: 360,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  deleteButton: {
    minHeight: 48,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    color: colors.danger,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  lockedContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 22,
    paddingBottom: 50,
  },
  sealedCard: {
    minHeight: 390,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  sealedCardReady: {
    borderColor: activeAccentColor,
  },
  readyOpenButton: {
    minWidth: 210,
    minHeight: 52,
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: activeAccentColor,
  },
  readyOpenText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  packButton: {
    minHeight: 50,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  packButtonText: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  sealedStar: {
    color: activeAccentColor,
    fontSize: 42,
  },
  sealedEyebrow: {
    marginTop: 16,
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  sealedTitle: {
    maxWidth: 440,
    marginTop: 12,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  sealedDescription: {
    maxWidth: 430,
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  dateSeal: {
    minWidth: 190,
    marginTop: 26,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  dateSealLabel: {
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  dateSealValue: {
    marginTop: 5,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  lockedHint: {
    marginVertical: 16,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    minHeight: 70,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface,
  },
  modalClose: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: colors.text,
    fontSize: 34,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  search: {
    minHeight: 50,
    margin: 14,
    paddingHorizontal: 14,
    color: colors.text,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  pickerSpinner: { marginVertical: 14 },
  modalList: {
    paddingHorizontal: 14,
    paddingBottom: 30,
  },
  referenceRow: {
    minHeight: 68,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  referenceSelected: { opacity: 0.48 },
  referenceType: {
    width: 76,
    color: activeAccentColor,
    fontSize: 8,
    fontWeight: '900',
  },
  collectionGlyph: {
    width: 52,
    color: activeAccentColor,
    fontSize: 20,
    textAlign: 'center',
  },
  referenceCopy: { flex: 1, minWidth: 0 },
  referenceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  referenceSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10.5,
  },
  referenceAction: {
    width: 34,
    color: activeAccentColor,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});
