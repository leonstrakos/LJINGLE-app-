import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { EntryLinkPicker } from '../components/EntryLinkPicker';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
import { ApiError, entryApi } from '../services/entryApi';
import { emptyEntryLinks, entryLinksApi } from '../services/entryLinksApi';
import {
  getEntryImages,
  pickEntryImages,
  saveEntryImageChanges,
  type EntryImageAttachment,
  type PendingEntryImage,
} from '../services/entryImages';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { createdFeedback } from '../utils/crudFeedback';
import {
  entryTypeLabels,
  entryTypeMarks,
  entryTypes,
  type EntryFormParams,
  type EntryLinks,
  type EntryRequest,
  type EntryType,
} from '../types/entry';

import { celestial, celestialAlpha } from '../theme/celestial';
export type EntryFormScreenProps = {
  navigation: {
    goBack: () => void;
  };
  route: {
    params?: EntryFormParams;
  };
};

// brutusImageRemoveGlyphV1

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');

function normalizeCustomLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('hr-HR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ljingleZapisiVaultR1
export function EntryFormScreen({ navigation, route }: EntryFormScreenProps) {
  // ljingleEntryObsidianUxR1:form
  // A new editor owns a persisted draft immediately; route entries keep their id.
  const routeEntryId = route.params?.entryId;
  const [draftEntryId, setDraftEntryId] = useState<string | null>(null);
  const entryId = routeEntryId ?? draftEntryId ?? undefined;
  const editing = Boolean(entryId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<EntryType>('NOTE');
  const [customLabel, setCustomLabel] = useState('');
  const [knownCustomLabels, setKnownCustomLabels] = useState<string[]>([]);
  const [bookId, setBookId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [links, setLinks] = useState<EntryLinks>(emptyEntryLinks);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const contentInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [entryImages, setEntryImages] = useState<EntryImageAttachment[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingEntryImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [pickingImages, setPickingImages] = useState(false);
  const draftCreateStartedRef = useRef(false);
  const autosaveReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef('');
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  const latestDraftRef = useRef<{
    entryId: string;
    payload: EntryRequest;
    serialized: string;
  } | null>(null);

  const contentHeight = Math.max(
    190,
    44 + content.split('\n').reduce((total, line) => {
      const charactersPerLine = Platform.OS === 'web' ? 82 : 34;
      return total + Math.max(1, Math.ceil(line.length / charactersPerLine));
    }, 0) * 26,
  );

  const updateContent = (value: string) => {
    setContent(value);
    setSaveError(null);
    setFieldErrors((current) => ({ ...current, content: '' }));
  };

  const wrapSelection = (before: string, after = before) => {
    const selected = content.slice(selection.start, selection.end);
    const next = `${content.slice(0, selection.start)}${before}${selected}${after}${content.slice(selection.end)}`;
    updateContent(next);
    const start = selection.start + before.length;
    setSelection({ start, end: start + selected.length });
    requestAnimationFrame(() => contentInputRef.current?.focus());
  };

  const prefixLines = (prefix: string) => {
    const start = content.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
    const endBreak = content.indexOf('\n', selection.end);
    const end = endBreak === -1 ? content.length : endBreak;
    const selected = content.slice(start, end);
    const nextPart = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
    updateContent(`${content.slice(0, start)}${nextPart}${content.slice(end)}`);
    setSelection({ start: start + prefix.length, end: start + prefix.length + selected.length });
    requestAnimationFrame(() => contentInputRef.current?.focus());
  };

  const loadEntry = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setLoadError(null);
    autosaveReadyRef.current = false;
    try {
      const entry = await entryApi.getById(entryId);
      setTitle(entry.title ?? '');
      setContent(entry.content);
      setType(entry.type);
      setCustomLabel(entry.customLabel ?? '');
      setBookId(entry.bookId);
      setTopicId(entry.topicId);
      setActivityId(entry.activityId);
      setEntryImages(await getEntryImages(entryId));
      setPendingImages([]);
      setRemovedImageIds([]);
      // ljingleEntryObsidianUxR1:loaded-snapshot
      lastSavedPayloadRef.current = JSON.stringify({
        title: entry.title?.trim() || null,
        content: entry.content,
        type: entry.type,
        customLabel: entry.customLabel?.trim() || null,
        bookId: entry.bookId,
        topicId: entry.topicId,
        activityId: entry.activityId,
      } satisfies EntryRequest);
      autosaveReadyRef.current = true;
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Zapis se nije mogao učitati.');
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    setLinksError(null);
    try {
      setLinks(await entryLinksApi.getAll(true));
    } catch (caught) {
      setLinksError(
        caught instanceof Error
          ? caught.message
          : 'Poveznice s katalogom nisu se mogle učitati.',
      );
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  const createDraft = useCallback(async () => {
    if (entryId || draftCreateStartedRef.current) return;

    draftCreateStartedRef.current = true;
    setLoading(true);
    setLoadError(null);

    const blankDraft: EntryRequest = {
      title: null,
      content: '',
      type: 'NOTE',
      customLabel: null,
      bookId: null,
      topicId: null,
      activityId: null,
    };

    try {
      const created = await entryApi.create(blankDraft);
      createdFeedback();
      lastSavedPayloadRef.current = JSON.stringify(blankDraft);
      setDraftEntryId(created.entryId);
      // loadEntry runs as soon as the newly-owned entryId becomes active.
    } catch (caught) {
      draftCreateStartedRef.current = false;
      setLoadError(
        caught instanceof Error
          ? caught.message
          : 'Novi zapis se nije mogao kreirati.',
      );
      setLoading(false);
    }
  }, [entryId]);

  // ljingleEntryObsidianUxR1:instant-draft
  useEffect(() => {
    if (!entryId) void createDraft();
  }, [createDraft, entryId]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);
  // ljingleZapisiVaultR1: load reusable custom chips from existing entries.
  useEffect(() => {
    let active = true;
    void entryApi.getAll()
      .then((allEntries) => {
        if (!active) return;
        const labels = new Map<string, string>();
        for (const entry of allEntries) {
          const label = entry.customLabel?.trim();
          if (label) labels.set(normalizeCustomLabel(label), label);
        }
        setKnownCustomLabels(
          [...labels.values()].sort((left, right) => left.localeCompare(right, 'hr-HR')),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);


  const addImages = async () => {
    if (pickingImages || !entryId) return;

    setPickingImages(true);
    setSaveError(null);

    try {
      const picked = await pickEntryImages();

      if (picked.length > 0) {
        // The draft already exists, so image persistence no longer waits for Save.
        await saveEntryImageChanges(entryId, picked, []);
        setEntryImages(await getEntryImages(entryId));
      }
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : 'Odabir slike nije uspio.',
      );
    } finally {
      setPickingImages(false);
    }
  };

  const removeExistingImage = async (attachmentId: string) => {
    if (!entryId) return;

    setSaveError(null);
    try {
      await saveEntryImageChanges(entryId, [], [attachmentId]);
      setEntryImages((current) =>
        current.filter((image) => image.attachmentId !== attachmentId),
      );
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : 'Slika se nije mogla ukloniti.',
      );
    }
  };

  const removePendingImage = (tempId: string) => {
    setPendingImages((current) =>
      current.filter((image) => image.tempId !== tempId),
    );
  };

  const visibleEntryImages = entryImages.filter(
    (image) => !removedImageIds.includes(image.attachmentId),
  );


  // ljingleZapisiVaultR1: restore the canonical save flow if an older cleanup removed it.

  // ljingleEntryObsidianUxR1:autosave
  const autosavePayload: EntryRequest = {
    title: title.trim() || null,
    content,
    type,
    customLabel: customLabel.trim() || null,
    bookId,
    topicId,
    activityId,
  };
  const autosaveSerialized = JSON.stringify(autosavePayload);

  latestDraftRef.current = entryId
    ? {
        entryId,
        payload: autosavePayload,
        serialized: autosaveSerialized,
      }
    : null;

  const queueAutosave = (draft: {
    entryId: string;
    payload: EntryRequest;
    serialized: string;
  }) => {
    autosaveQueueRef.current = autosaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await entryApi.update(draft.entryId, draft.payload);
        lastSavedPayloadRef.current = draft.serialized;
      })
      .then(() => {
        if (!mountedRef.current) return;
        if (latestDraftRef.current?.serialized === draft.serialized) {
          setSaveError(null);
          setFieldErrors({});
        }
      })
      .catch((caught) => {
        if (!mountedRef.current) return;
        if (caught instanceof ApiError && caught.fieldErrors) {
          setFieldErrors(caught.fieldErrors);
        }
        setSaveError(
          caught instanceof Error
            ? caught.message
            : 'Automatsko spremanje nije uspjelo.',
        );
      });
  };

  useEffect(() => {
    const draft = latestDraftRef.current;
    if (!entryId || loading || !autosaveReadyRef.current || !draft) return;
    if (draft.serialized === lastSavedPayloadRef.current) return;

    const timer = setTimeout(() => {
      const latest = latestDraftRef.current;
      if (!latest || latest.entryId !== entryId) return;
      if (latest.serialized === lastSavedPayloadRef.current) return;
      queueAutosave(latest);
    }, 650);

    return () => clearTimeout(timer);
  }, [
    entryId,
    loading,
    title,
    content,
    type,
    customLabel,
    bookId,
    topicId,
    activityId,
  ]);

  // Back/navigation does not need a Save action. Flush the newest render once
  // more on unmount so a very fast "type -> back" does not lose the last edit.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (!autosaveReadyRef.current) return;

      const draft = latestDraftRef.current;
      if (!draft || draft.serialized === lastSavedPayloadRef.current) return;

      autosaveQueueRef.current = autosaveQueueRef.current
        .catch(() => undefined)
        .then(() => entryApi.update(draft.entryId, draft.payload))
        .then(() => {
          lastSavedPayloadRef.current = draft.serialized;
        })
        .catch(() => undefined);
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <AeroAtmosphere variant="entries" />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.black} size="large" />
          <Text style={styles.stateCopy}>Učitavanje zapisa…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <AeroAtmosphere variant="entries" />
        <View style={styles.centerState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.stateTitle}>Zapis se nije učitao</Text>
          <Text style={styles.stateCopy}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void (entryId ? loadEntry() : createDraft())}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="entries" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, celestialMode && styles.celestialHero]}>
            {celestialMode ? <CelestialAtmosphere variant="entries" /> : null}
            <Text style={styles.eyebrow}>{editing ? 'Uređivanje' : 'Novi trag'}</Text>
            <View style={styles.portableTitleRow}>
              <Text
                style={[styles.heading, styles.portableTitleText]}
              >
                {editing ? 'Uredi zapis' : 'Novi zapis'}
              </Text>

            </View>
            {/* portableVisualPolishV1 */}
            <Text style={styles.intro}>
              Sačuvaj misao samostalno ili je poveži s knjigom, temom i aktivnošću.
            </Text>
</View>

          <View style={[styles.vaultEditor, celestialMode && styles.vaultEditorCelestial]}>
            <View pointerEvents="none" style={styles.vaultOrnaments}>
              <Text style={styles.vaultStarTop}>✦</Text>
              <Text style={styles.vaultStarSide}>⋆</Text>
              <Text style={styles.vaultGlyph}>⌑</Text>
            </View>

            <Text style={styles.vaultKicker}>Vrsta zapisa</Text>
            <ScrollView
              contentContainerStyle={styles.vaultTypeRail}
              horizontal
              nestedScrollEnabled
              style={styles.vaultTypeScrollerRepairR2}
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {entryTypes.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => {
                    setType(option);
                    setFieldErrors((current) => ({ ...current, type: '' }));
                  }}
                  style={({ pressed }) => [
                    styles.vaultTypeChip,
                    type === option && styles.vaultTypeChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.vaultTypeMark, type === option && styles.vaultTypeTextActive]}>
                    {entryTypeMarks[option]}
                  </Text>
                  <Text style={[styles.vaultTypeText, type === option && styles.vaultTypeTextActive]}>
                    {entryTypeLabels[option]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.vaultMetaRule} />

            <View style={styles.vaultLabelHeading}>
              <Text style={styles.vaultKicker}>Custom oznaka</Text>
              <Text style={styles.vaultMetaHint}>postaje filter u Zapisima</Text>
            </View>
            <View style={[styles.vaultLabelInput, fieldErrors.customLabel && styles.inputError]}>
              <Text style={styles.vaultHash}>#</Text>
              <TextInput
                autoCapitalize="sentences"
                maxLength={40}
                onChangeText={(value) => {
                  setCustomLabel(value);
                  setSaveError(null);
                  setFieldErrors((current) => ({ ...current, customLabel: '' }));
                }}
                placeholder="npr. IIT, roman, istraživanje…"
                placeholderTextColor={colors.textMuted}
                style={styles.vaultLabelTextInput}
                value={customLabel}
              />
              {customLabel ? (
                <Pressable
                  accessibilityLabel="Ukloni oznaku"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setCustomLabel('')}
                  style={({ pressed }) => [styles.vaultLabelClear, pressed && styles.pressed]}
                >
                  <Text style={styles.vaultLabelClearText}>×</Text>
                </Pressable>
              ) : null}
            </View>
            {fieldErrors.customLabel ? <Text style={styles.fieldError}>{fieldErrors.customLabel}</Text> : null}

            {knownCustomLabels.length > 0 ? (
              <ScrollView
                contentContainerStyle={styles.vaultSuggestions}
                horizontal
                nestedScrollEnabled
                style={styles.vaultSuggestionScrollerRepairR2}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
              >
                {knownCustomLabels.map((label) => (
                  <Pressable
                    accessibilityRole="button"
                    key={label}
                    onPress={() => setCustomLabel(label)}
                    style={({ pressed }) => [
                      styles.vaultSuggestionChip,
                      normalizeCustomLabel(customLabel) === normalizeCustomLabel(label) && styles.vaultSuggestionChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.vaultSuggestionText}>✦ {label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.vaultTitleBlock}>
              <TextInput
                autoCapitalize="sentences"
                maxLength={255}
                multiline
                onChangeText={(value) => {
                  setTitle(value);
                  setSaveError(null);
                  setFieldErrors((current) => ({ ...current, title: '' }));
                }}
                placeholder="Untitled"
                placeholderTextColor={celestialAlpha(celestial.ivory, 0.28)}
                style={[styles.vaultTitleInput, fieldErrors.title && styles.vaultTextError]}
                value={title}
              />
              <Text style={styles.vaultTitleCounter}>{title.length}/255</Text>
            </View>
            {fieldErrors.title ? <Text style={styles.fieldError}>{fieldErrors.title}</Text> : null}

            <View style={styles.vaultWritingRule} />

            <View style={styles.vaultComposerHeading}>
              <Text style={styles.vaultKicker}>Sadržaj</Text>
              <Text style={styles.vaultCounter}>{content.length}/50 000</Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.vaultToolbar}
              horizontal
              nestedScrollEnabled
              style={styles.vaultToolbarScrollerRepairR2}
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              <FormatButton accessibilityLabel="Podebljano" label="B" onPress={() => wrapSelection('**')} strong />
              <FormatButton accessibilityLabel="Marker" label="H" onPress={() => wrapSelection('==')} />
              <FormatButton accessibilityLabel="Link na zapis" label="[[ ]]" onPress={() => wrapSelection('[[', ']]')} />
              <FormatButton accessibilityLabel="Popis" label="•" onPress={() => prefixLines('- ')} />
              <FormatButton accessibilityLabel="Citat" label="❝" onPress={() => prefixLines('> ')} />
            </ScrollView>

            <TextInput
              autoCapitalize="sentences"
              ref={contentInputRef}
              maxLength={50000}
              multiline
              onChangeText={updateContent}
              onSelectionChange={({ nativeEvent }) => setSelection(nativeEvent.selection)}
              scrollEnabled={false}
              placeholder={type === 'QUOTE' ? 'Upiši citat…' : 'Počni pisati…'}
              placeholderTextColor={celestialAlpha(celestial.ivory, 0.30)}
              style={[
                styles.vaultWritingInput,
                type === 'QUOTE' && styles.vaultQuoteInput,
                { height: contentHeight },
                fieldErrors.content && styles.vaultTextError,
              ]}
              textAlignVertical="top"
              selection={selection}
              value={content}
            />
            {fieldErrors.content ? <Text style={styles.fieldError}>{fieldErrors.content}</Text> : null}

            <View pointerEvents="none" style={styles.vaultFooterOrnament}>
              <View style={styles.vaultFooterLine} />
              <Text style={styles.vaultFooterStar}>✦</Text>
              <Text style={styles.vaultFooterStarSmall}>⋆</Text>
              <View style={styles.vaultFooterLine} />
            </View>
          </View>

          <View style={[styles.imagesCard, celestialMode && styles.celestialModule]}>
            <View style={styles.imagesHeading}>
              <View style={styles.imagesHeadingCopy}>
                <Text style={styles.sectionTitle}>Slike</Text>
                <Text style={styles.sectionCopy}>
                  Dodaj fotografije ili slike koje želiš sačuvati uz ovaj zapis.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={pickingImages}
                onPress={() => void addImages()}
                style={({ pressed }) => [
                  styles.addImageButton,
                  pressed && styles.pressed,
                ]}
              >
                {pickingImages ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.addImageButtonText}>+ Dodaj</Text>
                )}
              </Pressable>
            </View>

            {visibleEntryImages.length > 0 || pendingImages.length > 0 ? (
              <ScrollView
                contentContainerStyle={styles.imageStrip}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {visibleEntryImages.map((image) => (
                  <View
                    key={image.attachmentId}
                    style={styles.imagePreviewWrap}
                  >
                    <Image
                      resizeMode="cover"
                      source={{ uri: image.uri }}
                      style={styles.imagePreview}
                    />

                    <Pressable
                      accessibilityLabel="Makni sliku"
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() =>
                        removeExistingImage(image.attachmentId)
                      }
                      style={styles.removeImageButton}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </Pressable>
                  </View>
                ))}

                {pendingImages.map((image) => (
                  <View
                    key={image.tempId}
                    style={styles.imagePreviewWrap}
                  >
                    <Image
                      resizeMode="cover"
                      source={{ uri: image.sourceUri }}
                      style={styles.imagePreview}
                    />

                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>NOVO</Text>
                    </View>

                    <Pressable
                      accessibilityLabel="Makni sliku"
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() =>
                        removePendingImage(image.tempId)
                      }
                      style={styles.removeImageButton}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.imagesEmpty}>
                <Text style={styles.imagesEmptyText}>
                  Nema dodanih slika.
                </Text>
              </View>
            )}
          </View>

                    {editing && entryId ? (
            <EntityRelationsPanel
              entityType="ENTRY"
              entityId={entryId}
              title={title.trim() || 'Untitled'}
              // ljingleConnectedTrailsR1:entry
              intrinsicReferences={[
                ...(bookId
                  ? [
                      {
                        entityType:
                          'BOOK' as const,
                        entityId: bookId,
                        title:
                          links.books.find(
                            (item) =>
                              item.id ===
                              bookId,
                          )?.label ||
                          'Povezana knjiga',
                        subtitle:
                          'Izvor zapisa',
                      },
                    ]
                  : []),
                ...(topicId
                  ? [
                      {
                        entityType:
                          'TOPIC' as const,
                        entityId: topicId,
                        title:
                          links.topics.find(
                            (item) =>
                              item.id ===
                              topicId,
                          )?.label ||
                          'Povezana tema',
                        subtitle:
                          'Tema zapisa',
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
          {/* entryConnectionsCleanupV1 */}


          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FormatButtonProps = {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  strong?: boolean;
};

function FormatButton({ accessibilityLabel, label, onPress, strong = false }: FormatButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.vaultToolButton, pressed && styles.pressed]}
    >
      <Text style={[styles.vaultToolButtonText, strong && styles.vaultToolButtonStrong]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ljingleEntryEditorAndroidLayoutRepairR2
  // ljingleZapisiVaultR1: one calm writing surface instead of nested form boxes.
  vaultEditor: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.38),
    borderRadius: 24,
    backgroundColor: celestial.night,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 3,
  },
  vaultEditorCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.48),
    backgroundColor: celestial.night,
  },
  vaultOrnaments: {
    ...StyleSheet.absoluteFillObject,
  },
  vaultStarTop: {
    position: 'absolute',
    top: 14,
    right: 20,
    color: celestialAlpha(celestial.gold, 0.36),
    fontSize: 17,
  },
  vaultStarSide: {
    position: 'absolute',
    top: 118,
    right: 10,
    color: celestialAlpha(celestial.gold, 0.22),
    fontSize: 22,
  },
  vaultGlyph: {
    position: 'absolute',
    bottom: 58,
    right: 13,
    color: celestialAlpha(celestial.gold, 0.12),
    fontSize: 36,
  },
  vaultKicker: {
    color: celestialAlpha(celestial.gold, 0.82),
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  vaultTypeScrollerRepairR2: {
    minHeight: 56,
    maxHeight: 56,
  },
  vaultTypeRail: {
    minHeight: 56,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 16,
  },
  vaultTypeChip: {
    minHeight: 38,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.24),
    borderRadius: 999,
    backgroundColor: celestialAlpha(celestial.ivory, 0.035),
    paddingHorizontal: 13,
  },
  vaultTypeChipActive: {
    borderColor: celestial.gold,
    backgroundColor: celestial.gold,
  },
  vaultTypeMark: {
    marginRight: 6,
    color: celestial.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  vaultTypeText: {
    color: celestialAlpha(celestial.ivory, 0.76),
    fontSize: 12,
    fontWeight: '700',
  },
  vaultTypeTextActive: {
    color: celestial.night,
  },
  vaultMetaRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 17,
    backgroundColor: celestialAlpha(celestial.gold, 0.18),
  },
  vaultLabelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultMetaHint: {
    color: celestialAlpha(celestial.ivory, 0.40),
    fontSize: 10,
  },
  vaultLabelInput: {
    minHeight: 43,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.22),
    borderRadius: 14,
    backgroundColor: celestialAlpha(celestial.ivory, 0.04),
    paddingLeft: 13,
    paddingRight: 7,
  },
  vaultHash: {
    color: celestial.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  vaultLabelTextInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 9,
    color: celestial.ivory,
    fontSize: 13,
    fontWeight: '600',
  },
  vaultLabelClear: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: celestialAlpha(celestial.ivory, 0.07),
  },
  vaultLabelClearText: {
    color: celestialAlpha(celestial.ivory, 0.72),
    fontSize: 19,
    lineHeight: 21,
  },
  vaultSuggestionScrollerRepairR2: {
    minHeight: 44,
    maxHeight: 44,
  },
  vaultSuggestions: {
    minHeight: 44,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    paddingRight: 14,
  },
  vaultSuggestionChip: {
    marginRight: 7,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.17),
    borderRadius: 999,
    backgroundColor: celestialAlpha(celestial.ivory, 0.025),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  vaultSuggestionChipActive: {
    borderColor: celestialAlpha(celestial.gold, 0.62),
    backgroundColor: celestialAlpha(celestial.gold, 0.09),
  },
  vaultSuggestionText: {
    color: celestialAlpha(celestial.ivory, 0.58),
    fontSize: 10,
    fontWeight: '700',
  },
  vaultTitleBlock: {
    position: 'relative',
    marginTop: 26,
  },
  vaultTitleInput: {
    minHeight: 52,
    padding: 0,
    paddingRight: 58,
    color: celestial.ivory,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.75,
    lineHeight: 35,
  },
  vaultTitleCounter: {
    position: 'absolute',
    right: 0,
    bottom: 5,
    color: celestialAlpha(celestial.ivory, 0.30),
    fontSize: 9,
  },
  vaultWritingRule: {
    height: 1,
    marginTop: 13,
    marginBottom: 14,
    backgroundColor: celestialAlpha(celestial.gold, 0.42),
  },
  vaultComposerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultCounter: {
    color: celestialAlpha(celestial.ivory, 0.32),
    fontSize: 9,
  },
  vaultToolbarScrollerRepairR2: {
    minHeight: 52,
    maxHeight: 52,
  },
  vaultToolbar: {
    minHeight: 52,
    alignItems: 'center',
    paddingTop: 8,
    paddingRight: 14,
    paddingBottom: 8,
  },
  vaultToolButton: {
    minWidth: 38,
    height: 34,
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.20),
    borderRadius: 11,
    backgroundColor: celestialAlpha(celestial.ivory, 0.035),
    paddingHorizontal: 10,
  },
  vaultToolButtonText: {
    color: celestialAlpha(celestial.ivory, 0.74),
    fontSize: 13,
    fontWeight: '700',
  },
  vaultToolButtonStrong: {
    color: celestial.gold,
    fontSize: 17,
    fontWeight: '900',
  },
  vaultWritingInput: {
    minHeight: 190,
    width: '100%',
    paddingHorizontal: 2,
    paddingTop: 10,
    paddingBottom: 18,
    color: celestial.ivory,
    fontSize: 18,
    lineHeight: 29,
  },
  vaultQuoteInput: {
    borderLeftWidth: 2,
    borderLeftColor: celestial.gold,
    paddingLeft: 14,
    color: celestial.gold,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 31,
  },
  vaultTextError: {
    borderBottomWidth: 1,
    borderBottomColor: colors.danger,
  },
  vaultFooterOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  vaultFooterLine: {
    width: 42,
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestialAlpha(celestial.gold, 0.28),
  },
  vaultFooterStar: {
    marginLeft: 8,
    color: celestial.gold,
    fontSize: 12,
  },
  vaultFooterStarSmall: {
    marginHorizontal: 6,
    color: celestialAlpha(celestial.gold, 0.58),
    fontSize: 11,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 64,
  },
  hero: {
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 7,
    color: colors.text,
    fontSize: 43,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 50,
  },
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
  intro: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 28,
  },
  imagesCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 28,
  },
  imagesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imagesHeadingCopy: {
    flex: 1,
    marginRight: 16,
  },
  addImageButton: {
    minWidth: 82,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.black,
    paddingHorizontal: 14,
  },
  addImageButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  imageStrip: {
    paddingTop: 18,
    paddingRight: 10,
  },
  imagePreviewWrap: {
    position: 'relative',
    width: 132,
    height: 132,
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: celestialAlpha(celestial.shadow, 0.72),
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '700',
  },
  pendingBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    borderRadius: 999,
    backgroundColor: celestialAlpha(celestial.shadow, 0.70),
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  imagesEmpty: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.fill,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  imagesEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  linksCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCopy: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  typeGrid: {
    marginTop: 12,
    marginBottom: 17,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeOption: {
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  typeOptionActive: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  typeMark: {
    marginRight: 6,
    color: colors.black,
    fontSize: 15,
    fontWeight: '700',
  },
  typeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: colors.white,
  },
  field: {
    marginTop: 24,
  },
  fieldHeading: {
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  counter: {
    color: colors.textMuted,
    fontSize: 11,
  },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    color: colors.text,
    fontSize: 17,
  },
  contentInput: {
    minHeight: 330,
    paddingTop: 18,
    paddingBottom: 18,
    lineHeight: 26,
  },
  composer: {
    marginBottom: 9,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.fill,
    padding: 10,
  },
  composerHeading: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  composerTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  composerHint: {
    marginLeft: 10,
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  formatToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  formatButton: {
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formatButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  formatButtonStrong: {
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  fieldError: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12,
  },
  linksHeading: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linksHeadingCopy: {
    flex: 1,
    marginRight: 14,
  },
  linksError: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    padding: 11,
  },
  linksErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },
  linksRetry: {
    marginLeft: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  saveError: {
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
  },
  actionItem: {
    flex: 1,
    marginRight: 10,
  },
  actionItemLast: {
    flex: 1.4,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 52,
    textAlign: 'center',
  },
  stateTitle: {
    marginTop: 16,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateCopy: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: { opacity: 0.45 },
  pressed: {
    opacity: 0.72,
  },
  celestialHero: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 0,
    borderBottomColor: celestialAlpha(celestial.gold, 0.28),
  },
  celestialModule: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  celestialChip: {
    borderColor: celestialAlpha(celestial.gold, 0.30),
  },
  celestialInput: {
    borderColor: celestialAlpha(celestial.gold, 0.34),
  },

});
