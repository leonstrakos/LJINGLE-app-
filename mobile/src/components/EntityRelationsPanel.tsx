import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { collectionApi } from '../services/collectionApi';
import { colors } from '../theme/colors';
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

type Props = {
  entityType: EntityReferenceType;
  entityId: string;
  title: string;
};

export function EntityRelationsPanel({ entityType, entityId, title }: Props) {
  const [allCollections, setAllCollections] = useState<CollectionSummary[]>([]);
  const [memberships, setMemberships] = useState<CollectionSummary[]>([]);
  const [links, setLinks] = useState<EntityLink[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collections, entityCollections, entityLinks] = await Promise.all([
        collectionApi.getAll(),
        collectionApi.getForEntity(entityType, entityId),
        collectionApi.getLinks(entityType, entityId),
      ]);
      setAllCollections(collections);
      setMemberships(entityCollections);
      setLinks(entityLinks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Veze se nisu učitale.');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const membershipIds = useMemo(() => new Set(memberships.map((item) => item.collectionId)), [memberships]);

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
    setLinkModal(true);
    setSelected(null);
    setSearch('');
    setRelationType('RELATED');
    setNote('');
    try {
      const found = await collectionApi.searchReferences('');
      setReferences(found.filter((item) => !(item.entityType === entityType && item.entityId === entityId)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stavke se nisu učitale.');
    }
  };

  const searchReferences = async (value: string) => {
    setSearch(value);
    try {
      const found = await collectionApi.searchReferences(value);
      setReferences(found.filter((item) => !(item.entityType === entityType && item.entityId === entityId)));
    } catch {
      // Keep the current results while typing if a local lookup momentarily fails.
    }
  };

  const saveLink = async () => {
    if (!selected || linkSaving) return;
    setLinkSaving(true);
    setError(null);
    try {
      const created = await collectionApi.createLink({
        sourceType: entityType,
        sourceId: entityId,
        targetType: selected.entityType,
        targetId: selected.entityId,
        relationType,
        note: note.trim() || null,
      });
      setLinks((current) => [created, ...current]);
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

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Organize & connect</Text>
          <Text style={styles.heading}>Collections & connections</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.textMuted} size="small" /> : null}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Collections</Text>
          <Pressable onPress={() => setCollectionModal(true)} style={styles.smallAction}><Text style={styles.smallActionText}>＋ Add</Text></Pressable>
        </View>
        {memberships.length > 0 ? (
          <View style={styles.chips}>
            {memberships.map((item) => (
              <Pressable key={item.collectionId} onPress={() => setCollectionModal(true)} style={styles.collectionChip}>
                <Text style={styles.collectionSymbol}>{item.symbol || '◇'}</Text>
                <Text style={styles.collectionChipText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : <Text style={styles.emptyText}>Nije još ni na jednoj polici/listi.</Text>}
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Connected</Text>
          <Pressable onPress={() => void openLinks()} style={styles.smallAction}><Text style={styles.smallActionText}>↗ Link</Text></Pressable>
        </View>
        {links.length > 0 ? links.slice(0, 5).map((link) => {
          const other = otherSide(link);
          return (
            <View key={link.linkId} style={styles.linkRow}>
              <View style={styles.linkType}><Text style={styles.linkTypeText}>{entityTypeLabels[other.entityType]}</Text></View>
              <View style={styles.linkCopy}>
                <Text numberOfLines={1} style={styles.linkTitle}>{other.title}</Text>
                <Text style={styles.linkRelation}>{relationTypeLabels[link.relationType]}{link.note ? ` · ${link.note}` : ''}</Text>
              </View>
              <Pressable disabled={deletingLink === link.linkId} onPress={() => void removeLink(link.linkId)} style={styles.unlinkButton}>
                {deletingLink === link.linkId ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Text style={styles.unlinkText}>×</Text>}
              </Pressable>
            </View>
          );
        }) : <Text style={styles.emptyText}>Još nema ručnih veza s drugim stvarima.</Text>}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal animationType="slide" visible={collectionModal} onRequestClose={() => setCollectionModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
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

      <Modal animationType="slide" visible={linkModal} onRequestClose={() => setLinkModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
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
              <Text style={styles.modalKicker}>Nova poveznica</Text>
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
            <Text style={styles.fieldLabel}>Pove?i s</Text>
            {selected ? (
              <Pressable onPress={() => setSelected(null)} style={styles.selectedReference}>
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
            <Text style={styles.fieldLabel}>Bilje?ka ? neobavezno</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Zašto su povezani?" placeholderTextColor={colors.textMuted} style={styles.noteInput} />
            <Pressable disabled={!selected || linkSaving} onPress={() => void saveLink()} style={[styles.saveLink, (!selected || linkSaving) && styles.disabled]}>
              {linkSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveLinkText}>Spremi poveznicu</Text>}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 18, padding: 17, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  heading: { marginTop: 3, color: colors.text, fontSize: 17, fontWeight: '900' },
  block: { marginTop: 16 },
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
  linkType: { minWidth: 70, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.fill },
  linkTypeText: { color: colors.textMuted, fontSize: 8, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  linkCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  linkTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  linkRelation: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
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
  linkComposer: { flex: 1, padding: 16 },
  fieldLabel: { marginTop: 8, marginBottom: 7, color: colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  relationList: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 8 },
  relationChip: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.fill },
  relationChipActive: { backgroundColor: colors.black },
  relationText: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  relationTextActive: { color: colors.white },
  searchInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 14 },
  referenceScroller: { maxHeight: 280, marginTop: 8 },
  referenceRow: { minHeight: 58, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  referenceType: { width: 72, color: colors.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  referenceCopy: { flex: 1, minWidth: 0 },
  referenceTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  referenceSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  selectedReference: { minHeight: 61, padding: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.fill },
  selectedCopy: { flex: 1 },
  selectedTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  selectedSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  noteInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, color: colors.text, fontSize: 14 },
  saveLink: { minHeight: 51, marginTop: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.black },
  saveLinkText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
