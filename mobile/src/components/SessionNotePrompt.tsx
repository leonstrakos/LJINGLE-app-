import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { activityApi } from '../services/activityApi';
import { entityLinksApi } from '../services/entityLinksApi';
import {
  getSessionCompletionDetails,
  saveBookReadingPage,
  saveSessionNote,
  subscribeSessionStopped,
  type SessionCompletionDetails,
  type SessionStoppedEvent,
} from '../services/sessionNotes';
import { colors } from '../theme/colors';
import {
  entityTypeLabels,
  type EntityReference,
} from '../types/collection';

import { collectionApi } from '../services/collectionApi';
import { entryApi } from '../services/entryApi';
import { topicApi } from '../services/topicApi';
import {
  isImplicitEntityPhrase,
  parseDeterministicMutationCommand,
  type EntityPhrase,
} from '../intelligence/deterministicMutation';
import { fuzzyTextIncludes } from '../intelligence/deterministicLanguage';
// postSessionDeterministicV1

export function SessionNotePrompt() {
  const [pending, setPending] = useState<SessionStoppedEvent | null>(null);
  const [details, setDetails] = useState<SessionCompletionDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [note, setNote] = useState('');
  const [page, setPage] = useState('');
  const [pageDirty, setPageDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityReference[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState('');
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [quickActionBusy, setQuickActionBusy] = useState(false);

  useEffect(() => {
    return subscribeSessionStopped((event) => {
      Keyboard.dismiss();
      setNote('');
      setPage('');
      setPageDirty(false);
      setQuery('');
      setResults([]);
      setDetails(null);
      setPending(event);
      setLoadingDetails(true);

      void getSessionCompletionDetails(event.sessionId, event.activityId)
        .then((next) => {
          setDetails(next);
          setPage(
            next.book?.currentPage == null
              ? ''
              : String(next.book.currentPage),
          );
          setPageDirty(false);
        })
        .catch(() => {
          // Session is already stored. The prompt can still work as a note box.
          setDetails(null);
        })
        .finally(() => setLoadingDetails(false));
    });
  }, []);

  const linkedKeys = useMemo(
    () =>
      new Set(
        (details?.contexts ?? []).map(
          (item) => `${item.entityType}:${item.entityId}`,
        ),
      ),
    [details?.contexts],
  );

  const showLinking =
    details?.activityType === 'GLOBAL' ||
    (details !== null && details.contexts.length === 0);

  useEffect(() => {
    if (!pending || !showLinking || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);

      void entityLinksApi
        .searchReferences(query.trim())
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [pending, query, showLinking]);

  const reset = () => {
    setPending(null);
    setDetails(null);
    setNote('');
    setPage('');
    setPageDirty(false);
    setQuery('');
    setResults([]);
    setLinkingKey(null);
    setQuickAction('');
    setQuickActionError(null);
    setQuickActionBusy(false);
  };

  const close = () => {
    if (saving || linkingKey) return;
    Keyboard.dismiss();
    reset();
  };

  const save = async () => {
    if (!pending || saving) return;

    const trimmedNote = note.trim();
    const trimmedPage = page.trim();
    const numericPage = trimmedPage ? Number(trimmedPage) : undefined;

    if (
      pageDirty &&
      trimmedPage &&
      (numericPage === undefined ||
        !Number.isInteger(numericPage) ||
        numericPage < 1 ||
        numericPage > 100000)
    ) {
      Alert.alert(
        'Provjeri stranicu',
        'Upiši cijeli broj stranice, npr. 44.',
      );
      return;
    }

    if (!trimmedNote && !(pageDirty && trimmedPage)) {
      close();
      return;
    }

    setSaving(true);

    try {
      // Session was already committed before this modal appeared.
      // These are optional post-session enrichments only.
      if (trimmedNote) {
        await saveSessionNote(pending.sessionId, trimmedNote);
      }

      if (details?.book && pageDirty && numericPage !== undefined) {
        await saveBookReadingPage(
          pending.sessionId,
          details.book.bookId,
          numericPage,
        );
      }

      reset();
    } catch (caught) {
      Alert.alert(
        'Detalji nisu spremljeni',
        caught instanceof Error
          ? `${caught.message}\n\nTimer je ipak sigurno spremljen.`
          : 'Timer je spremljen, ali dodatni detalji nisu. Pokušaj ponovno.',
      );
    } finally {
      setSaving(false);
    }
  };

  const link = async (reference: EntityReference) => {
    if (!pending) return;

    const key = `${reference.entityType}:${reference.entityId}`;
    if (linkedKeys.has(key) || linkingKey) return;

    setLinkingKey(key);

    try {
      await activityApi.addSessionContext(
        pending.sessionId,
        reference.entityType,
        reference.entityId,
      );

      const refreshed = await getSessionCompletionDetails(
        pending.sessionId,
        pending.activityId,
      );
      setDetails(refreshed);
      setPage(
        refreshed.book?.currentPage == null
          ? ''
          : String(refreshed.book.currentPage),
      );
      setPageDirty(false);
    } catch (caught) {
      Alert.alert(
        'Poveznica nije spremljena',
        caught instanceof Error
          ? caught.message
          : 'Pokušaj ponovno.',
      );
    } finally {
      setLinkingKey(null);
    }
  };

  const sessionPrimary = useMemo(() => {
    const contexts = details?.contexts ?? [];
    const concrete = contexts.filter((item) => item.entityType !== 'TOPIC');
    if (concrete.length === 1) return concrete[0] ?? null;
    if (concrete.length > 1) {
      const owned = concrete.filter((item) => item.source === 'ACTIVITY');
      return owned.length === 1 ? owned[0] ?? null : null;
    }
    return contexts.length === 1 ? contexts[0] ?? null : null;
  }, [details?.contexts]);

  const quickMutation = useMemo(
    () => parseDeterministicMutationCommand(quickAction),
    [quickAction],
  );

  const phraseMatchesSession = (
    phrase: EntityPhrase,
    entity: SessionCompletionDetails['contexts'][number],
  ) => {
    if (phrase.kindHint && phrase.kindHint !== entity.entityType) return false;
    if (isImplicitEntityPhrase(phrase)) return true;
    return fuzzyTextIncludes([entity.title, entity.subtitle ?? ''].join(' '), phrase.query);
  };

  const quickActionLabel = useMemo(() => {
    if (!quickMutation) return null;
    if (quickMutation.kind === 'UPDATE_BOOK_PAGE') {
      if (!details?.book) return null;
      if (!isImplicitEntityPhrase(quickMutation.subject) &&
          !fuzzyTextIncludes(details.book.title, quickMutation.subject.query)) return null;
      return 'Potvrdi: ' + details.book.title + ' → str. ' + quickMutation.page;
    }
    if (quickMutation.kind === 'CREATE_NOTE_TO_COLLECTION') {
      return 'Potvrdi: note “' + quickMutation.content + '” → #' + quickMutation.collectionQuery;
    }
    if (quickMutation.kind === 'CREATE_NOTE_TO_TOPIC') {
      return 'Potvrdi: note “' + quickMutation.content + '” → @' + quickMutation.topicQuery;
    }
    const sourcePhrase = quickMutation.kind === 'LINK' ? quickMutation.source : quickMutation.subject;
    if (!sessionPrimary || !phraseMatchesSession(sourcePhrase, sessionPrimary)) return null;
    if (quickMutation.kind === 'ADD_TO_COLLECTION') {
      return 'Potvrdi: ' + sessionPrimary.title + ' → #' + quickMutation.collectionQuery;
    }
    if (quickMutation.kind === 'ADD_TO_TOPIC') {
      return 'Potvrdi: ' + sessionPrimary.title + ' ↔ @' + quickMutation.topicQuery;
    }
    if (quickMutation.kind === 'LINK' && quickMutation.target.kindHint === 'TOPIC') {
      return 'Potvrdi: ' + sessionPrimary.title + ' ↔ @' + quickMutation.target.query;
    }
    return null;
  }, [details?.book, quickMutation, sessionPrimary]);

  const runPostSessionQuickAction = async () => {
    if (!pending || !quickMutation || !quickActionLabel || quickActionBusy) return;
    setQuickActionBusy(true);
    setQuickActionError(null);
    let createdCollectionId: string | null = null;
    let createdTopicId: string | null = null;
    let createdEntryId: string | null = null;
    try {
      const ensureCollection = async (name: string) => {
        const all = await collectionApi.getAll();
        const exact = all.find((item) => normalizeSession(item.name) === normalizeSession(name));
        if (exact) return exact;
        const fuzzy = all.filter((item) => fuzzyTextIncludes(item.name, name));
        if (fuzzy.length === 1) return fuzzy[0]!;
        const created = await collectionApi.create({ name, description: null, symbol: '◇' });
        createdCollectionId = created.collectionId;
        return created;
      };
      const ensureTopic = async (name: string) => {
        const all = await topicApi.getAll();
        const exact = all.find((item) => normalizeSession(item.name) === normalizeSession(name));
        if (exact) return exact;
        const fuzzy = all.filter((item) => fuzzyTextIncludes(item.name, name));
        if (fuzzy.length === 1) return fuzzy[0]!;
        const created = await topicApi.create({ name });
        createdTopicId = created.topicId;
        return created;
      };

      if (quickMutation.kind === 'UPDATE_BOOK_PAGE') {
        if (!details?.book) throw new Error('Ova završena sesija nema jednoznačnu knjigu.');
        await saveBookReadingPage(pending.sessionId, details.book.bookId, quickMutation.page);
        setPage(String(quickMutation.page));
        setPageDirty(false);
        setQuickAction('');
        return;
      }
      if (quickMutation.kind === 'CREATE_NOTE_TO_COLLECTION') {
        const collection = await ensureCollection(quickMutation.collectionQuery);
        const entry = await entryApi.create({
          title: null, content: quickMutation.content, type: 'NOTE',
          bookId: null, topicId: null, activityId: pending.activityId,
        });
        createdEntryId = entry.entryId;
        await collectionApi.addItem(collection.collectionId, 'ENTRY', entry.entryId);
        setQuickAction('');
        return;
      }
      if (quickMutation.kind === 'CREATE_NOTE_TO_TOPIC') {
        const topic = await ensureTopic(quickMutation.topicQuery);
        const entry = await entryApi.create({
          title: null, content: quickMutation.content, type: 'NOTE',
          bookId: null, topicId: topic.topicId, activityId: pending.activityId,
        });
        createdEntryId = entry.entryId;
        setQuickAction('');
        return;
      }
      if (!sessionPrimary) throw new Error('Završena sesija nema jednoznačnu glavnu stavku.');
      if (quickMutation.kind === 'ADD_TO_COLLECTION') {
        const collection = await ensureCollection(quickMutation.collectionQuery);
        const detail = await collectionApi.getById(collection.collectionId);
        const exists = detail.items.some((item) =>
          item.entityType === sessionPrimary.entityType && item.entityId === sessionPrimary.entityId,
        );
        if (!exists) await collectionApi.addItem(collection.collectionId, sessionPrimary.entityType, sessionPrimary.entityId);
        setQuickAction('');
        return;
      }
      const topicQuery = quickMutation.kind === 'ADD_TO_TOPIC'
        ? quickMutation.topicQuery
        : quickMutation.kind === 'LINK' && quickMutation.target.kindHint === 'TOPIC'
          ? quickMutation.target.query
          : null;
      if (!topicQuery) throw new Error('U post-session modu link koristi @temu ili #kolekciju; arbitrary X ↔ Y radi u Paletteu.');
      const topic = await ensureTopic(topicQuery);
      await entityLinksApi.create({
        sourceType: sessionPrimary.entityType, sourceId: sessionPrimary.entityId,
        targetType: 'TOPIC', targetId: topic.topicId, relationType: 'RELATED',
      });
      setQuickAction('');
    } catch (caught) {
      if (createdEntryId) await entryApi.remove(createdEntryId).catch(() => undefined);
      if (createdCollectionId) await collectionApi.remove(createdCollectionId).catch(() => undefined);
      if (createdTopicId) await topicApi.remove(createdTopicId).catch(() => undefined);
      setQuickActionError(caught instanceof Error ? caught.message : 'Brza akcija nije uspjela.');
    } finally {
      setQuickActionBusy(false);
    }
  };

  const normalizeSession = (value: string) =>
    value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible={pending !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          onPress={close}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.cardContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>SESIJA SPREMLJENA</Text>

            <Text style={styles.title}>Kako je prošlo?</Text>

            <Text style={styles.copy}>
              Timer je već sigurno spremljen. Ovdje samo dodaj kontekst koji će ti kasnije biti koristan.
            </Text>

            {loadingDetails ? (
              <ActivityIndicator style={styles.detailsLoader} />
            ) : null}

            {details ? (
              <View style={styles.activityStrip}>
                <Text style={styles.activityLabel} numberOfLines={1}>
                  {details.activityLabel}
                </Text>
                <Text style={styles.activityType}>
                  {details.activityType === 'GLOBAL'
                    ? 'QUICK TIMER'
                    : details.activityType}
                </Text>
              </View>
            ) : null}

            {details?.contexts.length ? (
              <View style={styles.contextSection}>
                <Text style={styles.fieldLabel}>POVEZANO</Text>
                <View style={styles.contextList}>
                  {details.contexts.map((item) => (
                    <View
                      key={`${item.entityType}:${item.entityId}`}
                      style={styles.contextChip}
                    >
                      <Text style={styles.contextType}>
                        {entityTypeLabels[item.entityType]}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={styles.contextTitle}
                      >
                        {item.title}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {details?.book ? (
              <View style={styles.smartCard}>
                <Text style={styles.smartEyebrow}>KNJIGA · BRZI UPDATE</Text>
                <Text style={styles.smartTitle} numberOfLines={2}>
                  Gdje si stao u „{details.book.title}”?
                </Text>
                <Text style={styles.smartCopy}>
                  Upiši stvarnu stranicu. Ne pretvaramo broj stranice u postotak.
                </Text>

                <View style={styles.pageRow}>
                  <Text style={styles.pagePrefix}>Stranica</Text>
                  <TextInput
                    editable={!saving}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => {
                      setPage(value.replace(/[^0-9]/g, ''));
                      setPageDirty(true);
                    }}
                    placeholder="44"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    selectTextOnFocus
                    style={styles.pageInput}
                    value={page}
                  />
                </View>
              </View>
            ) : null}

            {showLinking ? (
              <View style={styles.linkSection}>
                <Text style={styles.fieldLabel}>POVEŽI S… · NEOBAVEZNO</Text>
                <Text style={styles.linkHint}>
                  Ako je ovo bio Quick Timer ili slobodna aktivnost, poveži sesiju s onim čemu je stvarno pripadala.
                </Text>

                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                  onChangeText={setQuery}
                  placeholder="Knjiga, tema, film, igra, zapis, frekvencija…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  value={query}
                />

                {searching ? (
                  <ActivityIndicator style={styles.searchLoader} />
                ) : null}

                {results.length ? (
                  <View style={styles.results}>
                    {results.slice(0, 8).map((item) => {
                      const key = `${item.entityType}:${item.entityId}`;
                      const linked = linkedKeys.has(key);
                      const linking = linkingKey === key;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          disabled={linked || Boolean(linkingKey)}
                          key={key}
                          onPress={() => void link(item)}
                          style={({ pressed }) => [
                            styles.result,
                            linked && styles.resultLinked,
                            pressed && !linked && styles.pressed,
                          ]}
                        >
                          <View style={styles.resultCopy}>
                            <Text numberOfLines={1} style={styles.resultTitle}>
                              {item.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.resultMeta}>
                              {entityTypeLabels[item.entityType]}
                              {item.subtitle ? ` · ${item.subtitle}` : ''}
                            </Text>
                          </View>
                          {linking ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <Text style={styles.resultAction}>
                              {linked ? '✓' : '+'}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.quickActionSection}>
              <Text style={styles.fieldLabel}>BRZA AKCIJA · NEOBAVEZNO</Text>
              <Text style={styles.quickActionHint}>
                Isti deterministic jezik kao Palette. Ovdje “ovo / zadnje / recent” prvo znači upravo završena sesija.
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!quickActionBusy && !saving}
                onChangeText={(value) => { setQuickAction(value); setQuickActionError(null); }}
                placeholder="str 44 · dodaj ovo #winter · link ovo @jung"
                placeholderTextColor={colors.textMuted}
                style={styles.quickActionInput}
                value={quickAction}
              />
              {quickActionLabel ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={quickActionBusy || saving}
                  onPress={() => void runPostSessionQuickAction()}
                  style={({ pressed }) => [styles.quickActionConfirm, pressed && { opacity: 0.82 }]}
                >
                  {quickActionBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.quickActionConfirmEyebrow}>POTVRDA</Text>
                      <Text style={styles.quickActionConfirmText}>{quickActionLabel}</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
              {quickActionError ? <Text style={styles.quickActionError}>{quickActionError}</Text> : null}
            </View>

            <View style={styles.noteSection}>
              <Text style={styles.fieldLabel}>BILJEŠKA · NEOBAVEZNO</Text>
              <TextInput
                editable={!saving}
                maxLength={240}
                multiline
                onChangeText={setNote}
                placeholder="Što si napravio, pročitao, riješio…"
                placeholderTextColor={colors.textMuted}
                style={styles.noteInput}
                textAlignVertical="top"
                value={note}
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                disabled={saving || Boolean(linkingKey)}
                onPress={close}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.skipText}>Preskoči</Text>
              </Pressable>

              <Pressable
                disabled={saving || Boolean(linkingKey)}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveText}>
                    {details?.book ? 'Spremi detalje' : 'Spremi'}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 20,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  title: {
    marginTop: 7,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  copy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  detailsLoader: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  activityStrip: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: colors.fill,
  },
  activityLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  activityType: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  contextSection: {
    marginTop: 16,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  contextList: {
    marginTop: 8,
    gap: 7,
  },
  contextChip: {
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.fill,
  },
  contextType: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  contextTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  smartCard: {
    marginTop: 16,
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  smartEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  smartTitle: {
    marginTop: 5,
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  smartCopy: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  pageRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pagePrefix: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  pageInput: {
    width: 96,
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  linkSection: {
    marginTop: 18,
  },
  linkHint: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  searchInput: {
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.fill,
    color: colors.text,
    fontSize: 14,
  },
  searchLoader: {
    marginTop: 10,
  },
  results: {
    marginTop: 9,
    gap: 7,
  },
  result: {
    minHeight: 52,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },
  resultLinked: {
    opacity: 0.58,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 9.5,
  },
  resultAction: {
    marginLeft: 10,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  quickActionSection: {
    marginTop: 18, padding: 13, borderWidth: 1, borderColor: colors.separator,
    borderRadius: 15, backgroundColor: colors.surface,
  },
  quickActionHint: { marginTop: 5, color: colors.textMuted, fontSize: 10.5, lineHeight: 15 },
  quickActionInput: {
    minHeight: 46, marginTop: 9, paddingHorizontal: 12, borderWidth: 1,
    borderColor: colors.separator, borderRadius: 12, backgroundColor: colors.surface,
    color: colors.text, fontSize: 13,
  },
  quickActionConfirm: {
    minHeight: 50, marginTop: 9, paddingHorizontal: 12, paddingVertical: 9,
    justifyContent: 'center', borderRadius: 12, backgroundColor: '#111111',
  },
  quickActionConfirmEyebrow: { color: '#C7C7CC', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  quickActionConfirmText: { marginTop: 3, color: '#FFFFFF', fontSize: 12.5, lineHeight: 17, fontWeight: '900' },
  quickActionError: { marginTop: 8, color: '#B3261E', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  noteSection: {
    marginTop: 18,
  },
  noteInput: {
    marginTop: 8,
    minHeight: 78,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.fill,
    color: colors.text,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  skipButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  skipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1.2,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  saveText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
