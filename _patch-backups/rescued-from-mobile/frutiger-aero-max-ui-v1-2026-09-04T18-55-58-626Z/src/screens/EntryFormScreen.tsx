import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { EntryLinkPicker } from '../components/EntryLinkPicker';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { ApiError, entryApi } from '../services/entryApi';
import { sharePortableEntry } from '../services/portableExport';
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
import { ShareGlyph } from '../components/ShareGlyph';
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

const celestialMode = activeVisualSkinId === 'classic';
export function EntryFormScreen({ navigation, route }: EntryFormScreenProps) {
  const entryId = route.params?.entryId;
  const editing = Boolean(entryId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<EntryType>('NOTE');
  const [bookId, setBookId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [links, setLinks] = useState<EntryLinks>(emptyEntryLinks);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const contentInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [entryImages, setEntryImages] = useState<EntryImageAttachment[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingEntryImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [pickingImages, setPickingImages] = useState(false);

  const contentHeight = Math.max(
    330,
    52 + content.split('\n').reduce((total, line) => {
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
    if (!entryId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const entry = await entryApi.getById(entryId);
      setTitle(entry.title ?? '');
      setContent(entry.content);
      setType(entry.type);
      setBookId(entry.bookId);
      setTopicId(entry.topicId);
      setActivityId(entry.activityId);
      setEntryImages(await getEntryImages(entryId));
      setPendingImages([]);
      setRemovedImageIds([]);
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

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const addImages = async () => {
    if (pickingImages) return;

    setPickingImages(true);
    setSaveError(null);

    try {
      const picked = await pickEntryImages();

      if (picked.length > 0) {
        setPendingImages((current) => [...current, ...picked]);
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

  const removeExistingImage = (attachmentId: string) => {
    setRemovedImageIds((current) =>
      current.includes(attachmentId)
        ? current
        : [...current, attachmentId],
    );
  };

  const removePendingImage = (tempId: string) => {
    setPendingImages((current) =>
      current.filter((image) => image.tempId !== tempId),
    );
  };

  const visibleEntryImages = entryImages.filter(
    (image) => !removedImageIds.includes(image.attachmentId),
  );

  const validate = (): EntryRequest | null => {
    const nextErrors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (trimmedTitle.length > 255) {
      nextErrors.title = 'Naslov smije imati najviše 255 znakova.';
    }
    if (!trimmedContent) {
      nextErrors.content = 'Sadržaj zapisa je obavezan.';
    } else if (trimmedContent.length > 50000) {
      nextErrors.content = 'Sadržaj smije imati najviše 50 000 znakova.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      title: trimmedTitle || null,
      content: trimmedContent,
      type,
      bookId,
      topicId,
      activityId,
    };
  };

  const shareEntry = async () => {
    if (!entryId || sharing) return;

    setSharing(true);
    setSaveError(null);

    try {
      await sharePortableEntry(entryId);
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setSharing(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const payload = validate();
    if (!payload) return;

    setSaving(true);
    setSaveError(null);
    try {
      let savedEntryId = entryId;

      if (entryId) {
        await entryApi.update(entryId, payload);
      } else {
        const created = await entryApi.create(payload);
        savedEntryId = created.entryId;
        createdFeedback();
      }

      if (savedEntryId) {
        try {
          await saveEntryImageChanges(
            savedEntryId,
            pendingImages,
            removedImageIds,
          );
        } catch {
          Alert.alert(
            'Zapis je spremljen',
            'Tekst je spremljen, ali neke slike nisu. Zapis možeš ponovno otvoriti i pokušati ih dodati.',
          );
        }
      }

      navigation.goBack();
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors) {
        setFieldErrors(caught.fieldErrors);
      }
      setSaveError(caught instanceof Error ? caught.message : 'Spremanje nije uspjelo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
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
        <View style={styles.centerState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.stateTitle}>Zapis se nije učitao</Text>
          <Text style={styles.stateCopy}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadEntry()}
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

              {editing && entryId ? (
                <Pressable
                  accessibilityLabel="Share zapis"
                  accessibilityRole="button"
                  disabled={sharing}
                  onPress={() => void shareEntry()}
                  style={({ pressed }) => [
                    styles.portableShare,
                    pressed && styles.pressed,
                    sharing && styles.disabled,
                  ]}
                >
                  <ShareGlyph />
                </Pressable>
              ) : null}
            </View>
            {/* portableVisualPolishV1 */}
            <Text style={styles.intro}>
              Sačuvaj misao samostalno ili je poveži s knjigom, temom i aktivnošću.
            </Text>
</View>

          <View style={[styles.formCard, celestialMode && styles.celestialModule]}>
            <Text style={styles.sectionTitle}>Vrsta zapisa</Text>
            <View style={styles.typeGrid}>
              {entryTypes.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => {
                    setType(option);
                    setFieldErrors((current) => ({ ...current, type: '' }));
                  }}
                  style={({ pressed }) => [
                    styles.typeOption,
                    celestialMode && styles.celestialChip,
                    type === option && styles.typeOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.typeMark, type === option && styles.typeTextActive]}>
                    {entryTypeMarks[option]}
                  </Text>
                  <Text style={[styles.typeText, type === option && styles.typeTextActive]}>
                    {entryTypeLabels[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {fieldErrors.type ? <Text style={styles.fieldError}>{fieldErrors.type}</Text> : null}

            <View style={styles.field}>
              <View style={styles.fieldHeading}>
                <Text style={styles.label}>Naslov</Text>
                <Text style={styles.counter}>{title.length}/255</Text>
              </View>
              <TextInput
                autoCapitalize="sentences"
                onChangeText={(value) => {
                  setTitle(value);
                  setSaveError(null);
                  setFieldErrors((current) => ({ ...current, title: '' }));
                }}
                placeholder="Neobavezni naslov"
                placeholderTextColor="#98989D"
                style={[styles.input, celestialMode && styles.celestialInput, fieldErrors.title && styles.inputError]}
                value={title}
              />
              {fieldErrors.title ? (
                <Text style={styles.fieldError}>{fieldErrors.title}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <View style={styles.fieldHeading}>
                <Text style={styles.label}>Sadržaj *</Text>
                <Text style={styles.counter}>{content.length}/50 000</Text>
              </View>
              <View style={styles.composer}>
                <View style={styles.composerHeading}>
                  <Text style={styles.composerTitle}>Formatiranje</Text>
                  <Text style={styles.composerHint}>Označi tekst, zatim odaberi alat.</Text>
                </View>
                <View style={styles.formatToolbar}>
                  <FormatButton label="B" onPress={() => wrapSelection('**')} strong />
                  <FormatButton label="Marker" onPress={() => wrapSelection('==')} />
                  <FormatButton label="Link na zapis" onPress={() => wrapSelection('[[', ']]')} />
                  <FormatButton label="Popis" onPress={() => prefixLines('- ')} />
                  <FormatButton label="Citat" onPress={() => prefixLines('> ')} />
                </View>
              </View>
              <TextInput
                autoCapitalize="sentences"
                ref={contentInputRef}
                multiline
                onChangeText={updateContent}
                onSelectionChange={({ nativeEvent }) => setSelection(nativeEvent.selection)}
                scrollEnabled={false}
                placeholder={type === 'QUOTE' ? 'Upiši citat…' : 'Što želiš sačuvati?'}
                placeholderTextColor="#98989D"
                style={[
                  styles.input,
                  styles.contentInput,
                  celestialMode && styles.celestialInput,
                  { height: contentHeight },
                  fieldErrors.content && styles.inputError,
                ]}
                textAlignVertical="top"
                selection={selection}
                value={content}
              />
              {fieldErrors.content ? (
                <Text style={styles.fieldError}>{fieldErrors.content}</Text>
              ) : null}
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
              title={title.trim() || 'Zapis'}
            />
          ) : null}
          {/* entryConnectionsCleanupV1 */}


          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
<View style={styles.actions}>
            <View style={styles.actionItem}>
              <PrimaryButton
                disabled={saving}
                label="Odustani"
                onPress={navigation.goBack}
                variant="secondary"
              />
            </View>
<View style={styles.actionItemLast}>
              <PrimaryButton
                label={editing ? 'Spremi promjene' : 'Spremi zapis'}
                loading={saving}
                onPress={() => void save()}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FormatButtonProps = {
  label: string;
  onPress: () => void;
  strong?: boolean;
};

function FormatButton({ label, onPress, strong = false }: FormatButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.formatButton, pressed && styles.pressed]}>
      <Text style={[styles.formatButtonText, strong && styles.formatButtonStrong]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 28,
    paddingTop: 42,
    paddingBottom: 64,
  },
  hero: {
    marginBottom: 30,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
