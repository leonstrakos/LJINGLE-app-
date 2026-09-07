import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collectionApi } from '../services/collectionApi';
import { entryApi } from '../services/entryApi';
import { colors } from '../theme/colors';
import { openCollectionReference, openEntityReference } from '../utils/entityNavigation';
import { connectionDirectionCopy } from '../utils/connectionDirection';
import { semanticSearch, suggestSemanticLinks } from '../intelligence/semanticIndex';
import { mergeReferencesQuietly, rankReferencesQuietly } from '../intelligence/quietRanking';
// forkK5QuietIntelligenceV1
import {
  entityTypeLabels,
  relationTypeLabels,
  relationTypes,
  type CollectionSummary,
  type EntityLink,
  type EntityReference,
  type EntityReferenceType,
  type RelationType,
} from '../types/collection';
import { emitSemanticAlive } from '../motion/semanticAlive';

type Props = {
  entityType: EntityReferenceType;
  entityId: string;
  title: string;
  intrinsicReferences?: EntityReference[];
};

// connectionsUnifyV1 — link modals open instantly.
// compactConnectionsComposerV1
// navigableGraphV2
// graphDirectionV4 — direction-aware backlinks + separate notes
// editExistingConnectionV3
export function EntityRelationsPanel({
  entityType,
  entityId,
  title,
  intrinsicReferences = [],
}: Props) {
  // ljingleConnectedTrailsR1:panel
  const navigation = useNavigation();
  const [allCollections, setAllCollections] = useState<CollectionSummary[]>([]);
  const [memberships, setMemberships] = useState<CollectionSummary[]>([]);
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [entryBacklinks, setEntryBacklinks] =
    useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionModal, setCollectionModal] = useState(false);
  const [linkModal, setLinkModal] = useState(false);
  const [busyCollection, setBusyCollection] = useState<string | null>(null);
  const [references, setReferences] = useState<EntityReference[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EntityReference | null>(null);
  const [relationType, setRelationType] = useState<RelationType>('RELATED');
  const [note, setNote] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<EntityLink | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entryBacklinkRequest =
        entityType === 'BOOK'
          ? entryApi.getAll({
              bookId: entityId,
            })
          : entityType === 'TOPIC'
            ? entryApi.getAll({
                topicId: entityId,
              })
            : Promise.resolve([]);

      const [
        collections,
        entityCollections,
        entityLinks,
        linkedEntries,
      ] = await Promise.all([
        collectionApi.getAll(),
        collectionApi.getForEntity(
          entityType,
          entityId,
        ),
        collectionApi.getLinks(
          entityType,
          entityId,
        ),
        entryBacklinkRequest,
      ]);

      setAllCollections(collections);
      setMemberships(entityCollections);
      setLinks(entityLinks);
      setEntryBacklinks(
        linkedEntries.map((entry) => ({
          entityType: 'ENTRY' as const,
          entityId: entry.entryId,
          title:
            entry.title?.trim() ||
            entry.content
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 86) ||
            'Zapis',
          subtitle:
            entityType === 'BOOK'
              ? 'Zapis iz knjige'
              : 'Zapis uz temu',
        })),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Veze se nisu učitale.');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const membershipIds = useMemo(() => new Set(memberships.map((item) => item.collectionId)), [memberships]);

  const automaticReferences = useMemo(() => {
    const seen = new Set<string>();
    const result: EntityReference[] = [];

    for (const item of [
      ...intrinsicReferences,
      ...entryBacklinks,
    ]) {
      const key =
        item.entityType + ':' + item.entityId;

      if (
        key === entityType + ':' + entityId ||
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);
      result.push(item);
    }

    return result;
  }, [
    entityId,
    entityType,
    entryBacklinks,
    intrinsicReferences,
  ]);

  const automaticReferenceKeys = useMemo(
    () =>
      new Set(
        automaticReferences.map(
          (item) =>
            item.entityType + ':' + item.entityId,
        ),
      ),
    [automaticReferences],
  );

  const visibleManualLinks = useMemo(
    () =>
      links.filter((link) => {
        const other =
          link.sourceType === entityType &&
          link.sourceId === entityId
            ? link.target
            : link.source;

        return !automaticReferenceKeys.has(
          other.entityType +
            ':' +
            other.entityId,
        );
      }),
    [
      automaticReferenceKeys,
      entityId,
      entityType,
      links,
    ],
  );

  const toggleCollection = async (collection: CollectionSummary) => {
    if (busyCollection) return;
    setBusyCollection(collection.collectionId);
    setError(null);
    try {
      if (membershipIds.has(collection.collectionId)) {
        const detail = await collectionApi.getById(collection.collectionId);
        const item = detail.items.find((candidate) => candidate.entityType === entityType && candidate.entityId === entityId);
        if (item) await collectionApi.removeItem(collection.collectionId, item.itemId);
      } else {
        await collectionApi.addItem(collection.collectionId, entityType, entityId);
      // ljingleSemanticAliveR1:collection-transfer
      emitSemanticAlive({
        type: 'COLLECTION_ADD',
        entityKey: entityType + ':' + entityId,
      });
      }
      const [collections, entityCollections] = await Promise.all([
        collectionApi.getAll(),
        collectionApi.getForEntity(entityType, entityId),
      ]);
      setAllCollections(collections);
      setMemberships(entityCollections);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kolekcija nije promijenjena.');
    } finally {
      setBusyCollection(null);
    }
  };

  const openLinks = async () => {
    setEditingLink(null);
    setLinkModal(true);
    setSelected(null);
    setSearch('');
    setRelationType('RELATED');
    setNote('');
    try {
      const [found, semantic] = await Promise.all([
        collectionApi.searchReferences(''),
        suggestSemanticLinks(entityType, entityId, {
          limit: 10,
          entityTypes: ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'],
          minimumScore: 0.16,
        }).catch(() => []),
      ]);
      const filtered = found.filter((item) => !(item.entityType === entityType && item.entityId === entityId));
      setReferences(rankReferencesQuietly(filtered, semantic));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stavke se nisu učitale.');
    }
  };

  const searchReferences = async (value: string) => {
    setSearch(value);

    if (value.trim().length < 2) {
      setReferences([]);
      return;
    }

    try {
      const [found, semantic] = await Promise.all([
        collectionApi.searchReferences(value),
        semanticSearch(value, {
          limit: 10,
          entityTypes: ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'],
          minimumScore: 0.12,
        }).catch(() => []),
      ]);

      setReferences(
        mergeReferencesQuietly(
          found,
          semantic,
          { entityType, entityId },
        ).slice(0, 30),
      );
    } catch {
      // Keep the current results while typing if a local lookup momentarily fails.
    }
  };

  const saveLink = async () => {
    if (!selected || linkSaving) return;
    setLinkSaving(true);
    setError(null);
    try {
      const created = editingLink
        ? await collectionApi.updateLink(
            editingLink.linkId,
            {
              relationType,
              note: note.trim() || null,
            },
          )
        : await collectionApi.createLink({
            sourceType: entityType,
            sourceId: entityId,
            targetType: selected.entityType,
            targetId: selected.entityId,
            relationType,
            note: note.trim() || null,
          });

      setLinks((current) =>
        editingLink
          ? current.map((link) =>
              link.linkId === created.linkId
                ? created
                : link,
            )
          : [created, ...current],
      );
      setLinkModal(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poveznica nije spremljena.');
    } finally {
      setLinkSaving(false);
    }
  };

  const removeLink = async (linkId: string) => {
    if (deletingLink) return;
    setDeletingLink(linkId);
    try {
      await collectionApi.removeLink(linkId);
      setLinks((current) => current.filter((link) => link.linkId !== linkId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poveznica nije uklonjena.');
    } finally {
      setDeletingLink(null);
    }
  };

  const otherSide = (link: EntityLink) =>
    link.sourceType === entityType && link.sourceId === entityId ? link.target : link.source;

  const beginEditLink = (link: EntityLink) => {
    const target = otherSide(link);
    setEditingLink(link);
    setSelected(target);
    setRelationType(link.relationType);
    setNote(link.note ?? '');
    setSearch('');
    setReferences([]);
    setError(null);
    setLinkModal(true);
  };



  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>POVEZANO</Text>
          <Text style={styles.heading}>Tragovi kroz arhiv</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.textMuted} size="small" /> : null}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Memory Box</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setCollectionModal(true)
            }
            style={styles.smallAction}
          >
            <Text style={styles.smallActionText}>
              Uredi
            </Text>
          </Pressable>
        </View>
        {memberships.length > 0 ? (
          <View style={styles.chips}>
            {memberships.map((item) => (
              <Pressable
                key={item.collectionId}
                accessibilityRole="button"
                accessibilityLabel={
                  'Otvori Memory Box ' + item.name
                }
                onPress={() =>
                  openCollectionReference(
                    navigation,
                    item.collectionId,
                  )
                }
                style={({ pressed }) => [
                  styles.collectionChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.collectionSymbol}>{item.symbol || '◇'}</Text>
                <Text style={styles.collectionChipText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Nije u nijednom Memory Boxu.
          </Text>
        )}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Veze</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openLinks()}
            style={styles.smallAction}
          >
            <Text style={styles.smallActionText}>
              ＋ Poveži
            </Text>
          </Pressable>
        </View>
        {automaticReferences.map((other) => (
          <View
            key={
              'AUTO:' +
              other.entityType +
              ':' +
              other.entityId
            }
            style={styles.linkRow}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                'Otvori ' +
                entityTypeLabels[
                  other.entityType
                ] +
                ' ' +
                other.title
              }
              onPress={() =>
                openEntityReference(
                  navigation,
                  other,
                )
              }
              style={({ pressed }) => [
                styles.linkOpen,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.linkType}>
                <Text style={styles.linkTypeText}>
                  {
                    entityTypeLabels[
                      other.entityType
                    ]
                  }
                </Text>
              </View>

              <View style={styles.linkCopy}>
                <Text
                  numberOfLines={1}
                  style={styles.linkTitle}
                >
                  {other.title}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.linkRelation}
                >
                  {other.subtitle ||
                    'Izravno povezano'}
                </Text>
              </View>

              <Text style={styles.linkArrow}>
                ›
              </Text>
            </Pressable>
          </View>
        ))}

        {visibleManualLinks.length > 0 ? visibleManualLinks.map((link) => {
          const other = otherSide(link);
          const direction =
            connectionDirectionCopy(
              link,
              entityType,
              entityId,
            );
          return (
            <View key={link.linkId} style={styles.linkRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  openEntityReference(
                    navigation,
                    other,
                  )
                }
                style={({ pressed }) => [
                  styles.linkOpen,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.linkType}><Text style={styles.linkTypeText}>{entityTypeLabels[other.entityType]}</Text></View>
              <View style={styles.linkCopy}>
                <Text numberOfLines={1} style={styles.linkTitle}>{other.title}</Text>
                <View style={styles.connectionMeaningRow}>
                    <Text style={styles.directionMarker}>
                      {direction.marker}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.linkRelation}
                    >
                      {direction.label}
                    </Text>
                  </View>

                  {link.note ? (
                    <Text
                      numberOfLines={2}
                      style={styles.connectionNote}
                    >
                      {link.note}
                    </Text>
                  ) : null}
              </View>
                <Text style={styles.linkArrow}>›</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Uredi poveznicu"
                accessibilityRole="button"
                onPress={() => void beginEditLink(link)}
                style={({ pressed }) => [
                  styles.editLinkButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.editLinkText}>•••</Text>
              </Pressable>
              <Pressable disabled={deletingLink === link.linkId} onPress={() => void removeLink(link.linkId)} style={styles.unlinkButton}>
                {deletingLink === link.linkId ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Text style={styles.unlinkText}>×</Text>}
              </Pressable>
            </View>
          );
        }) : automaticReferences.length === 0 ? (
          <Text style={styles.emptyText}>
            Još nema povezanih tragova.
          </Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal animationType="none" presentationStyle="fullScreen" statusBarTranslucent={false} visible={collectionModal} onRequestClose={() => setCollectionModal(false)}>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Natrag"
              hitSlop={12}
              onPress={() => setCollectionModal(false)}
              style={({ pressed }) => [
                styles.modalBackButton,
                pressed && styles.modalBackButtonPressed,
              ]}
            >
              <View style={styles.modalBackGlyph} />
            </Pressable>

            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalKicker}>Dodaj u kolekciju</Text>
              <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
            </View>
          </View>
          <FlatList
            data={allCollections}
            keyExtractor={(item) => item.collectionId}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const checked = membershipIds.has(item.collectionId);
              return (
                <Pressable onPress={() => void toggleCollection(item)} style={[styles.collectionOption, checked && styles.collectionOptionChecked]}>
                  <View style={styles.optionSymbol}><Text style={styles.optionSymbolText}>{item.symbol || '◇'}</Text></View>
                  <View style={styles.optionCopy}><Text style={styles.optionTitle}>{item.name}</Text><Text style={styles.optionSubtitle}>{item.itemCount} stavki</Text></View>
                  {busyCollection === item.collectionId ? <ActivityIndicator color={colors.black} size="small" /> : <Text style={styles.check}>{checked ? '✓' : '+'}</Text>}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal animationType="none" presentationStyle="fullScreen" statusBarTranslucent={false} visible={linkModal} onRequestClose={() => setLinkModal(false)}>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Natrag"
              hitSlop={12}
              onPress={() => setLinkModal(false)}
              style={({ pressed }) => [styles.modalBackButton, pressed && { opacity: 0.55 }]}
            >
              <View style={styles.modalBackGlyph} />
            </Pressable>

            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalKicker}>
                {editingLink ? 'Uredi poveznicu' : 'Nova poveznica'}
              </Text>
              <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
            </View>
          </View>
          <View style={styles.linkComposer}>
            <Text style={styles.fieldLabel}>Vrsta veze</Text>
            <View style={styles.relationList}>
              {relationTypes.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setRelationType(item)}
                  style={[
                    styles.relationChip,
                    relationType === item && styles.relationChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.relationText,
                      relationType === item && styles.relationTextActive,
                    ]}
                  >
                    {relationTypeLabels[item]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Poveži s</Text>
            {selected ? (
              <Pressable
                  disabled={Boolean(editingLink)}
                  onPress={() => {
                    if (!editingLink) setSelected(null);
                  }}
                  style={[
                    styles.selectedReference,
                    editingLink && styles.selectedReferenceLocked,
                  ]}
                >
                <View style={styles.selectedCopy}><Text style={styles.selectedTitle}>{selected.title}</Text><Text style={styles.selectedSubtitle}>{entityTypeLabels[selected.entityType]} · tap to change</Text></View><Text style={styles.check}>✓</Text>
              </Pressable>
            ) : (
              <>
                <TextInput value={search} onChangeText={(value) => void searchReferences(value)} placeholder="Search books, media, games, topics, notes…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
                <FlatList
                  data={references}
                  keyExtractor={(item) => `${item.entityType}:${item.entityId}`}
                  style={styles.referenceScroller}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable onPress={() => setSelected(item)} style={styles.referenceRow}>
                      <Text style={styles.referenceType}>{entityTypeLabels[item.entityType]}</Text>
                      <View style={styles.referenceCopy}><Text numberOfLines={1} style={styles.referenceTitle}>{item.title}</Text>{item.subtitle ? <Text numberOfLines={1} style={styles.referenceSubtitle}>{item.subtitle}</Text> : null}</View>
                      <Text style={styles.check}>+</Text>
                    </Pressable>
                  )}
                />
              </>
            )}
            <Text style={styles.fieldLabel}>Bilješka · neobavezno</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Zašto su povezani?" placeholderTextColor={colors.textMuted} style={styles.noteInput} />
            <Pressable disabled={!selected || linkSaving} onPress={() => void saveLink()} style={[styles.saveLink, (!selected || linkSaving) && styles.disabled]}>
              {linkSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveLinkText}>
                  {editingLink ? 'Spremi promjene' : 'Spremi poveznicu'}
                </Text>}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 22,
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 4,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  block: { marginTop: 18 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  smallAction: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: colors.fillStrong },
  smallActionText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  chips: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  collectionChip: { paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: colors.fill },
  collectionSymbol: { marginRight: 5, color: colors.text, fontSize: 12 },
  collectionChipText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16, backgroundColor: colors.separator },
  emptyText: { marginTop: 8, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  linkRow: { minHeight: 57, marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  linkOpen: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkArrow: {
    width: 24,
    color: colors.textMuted,
    fontSize: 20,
    textAlign: 'center',
  },
  linkType: { minWidth: 70, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.fill },
  linkTypeText: { color: colors.textMuted, fontSize: 8, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  linkCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  linkTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  connectionMeaningRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directionMarker: {
    minWidth: 29,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
    textAlign: 'center',
  },
  connectionNote: {
    marginTop: 4,
    paddingRight: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  linkRelation: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  editLinkButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  editLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unlinkButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  unlinkText: { color: colors.textMuted, fontSize: 22 },
  error: { marginTop: 12, color: colors.danger, fontSize: 11 },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.separator },
  modalBackButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  modalBackButtonPressed: { opacity: 0.5 },
  modalBackGlyph: {
    width: 13,
    height: 13,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 5,
  },
  modalHeaderCopy: { flex: 1, minWidth: 0, marginLeft: 4 },
  modalKicker: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  modalTitle: { maxWidth: 260, marginTop: 3, color: colors.text, fontSize: 20, fontWeight: '900' },
  done: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: colors.black },
  doneText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  modalList: { padding: 16 },
  collectionOption: { minHeight: 71, marginBottom: 9, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  collectionOptionChecked: { borderColor: colors.black, backgroundColor: colors.fill },
  optionSymbol: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.fillStrong },
  optionSymbolText: { color: colors.text, fontSize: 20 },
  optionCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  optionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  optionSubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 10 },
  check: { marginLeft: 9, color: colors.text, fontSize: 18, fontWeight: '900' },
  linkComposer: { padding: 16, paddingBottom: 24 },
  fieldLabel: { marginTop: 8, marginBottom: 7, color: colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  relationList: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 8 },
  relationChip: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.fill },
  relationChipActive: { backgroundColor: colors.black },
  relationText: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  relationTextActive: { color: colors.onAccent },
  searchInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 14 },
  referenceScroller: { maxHeight: 170, marginTop: 8, flexGrow: 0 },
  referenceRow: { minHeight: 58, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  referenceType: { width: 72, color: colors.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  referenceCopy: { flex: 1, minWidth: 0 },
  referenceTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  referenceSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  selectedReference: { minHeight: 61, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.fill },
  selectedReferenceLocked: {
    opacity: 1,
  },
  selectedCopy: { flex: 1 },
  selectedTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  selectedSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  noteInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 14 },
  saveLink: { minHeight: 48, marginTop: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.black },
  saveLinkText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: {
    opacity: 0.72,
  },
  disabled: { opacity: 0.45 },
});
