// collectionBigBoxesV1
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionSymbolPicker } from './CollectionSymbolPicker';
import {
  createCollectionBigBox,
  deleteCollectionBigBox,
  updateCollectionBigBox,
  type CollectionBigBox,
} from '../services/collectionBigBoxes';
import { activeAccentColor, colors } from '../theme/colors';
import type { CollectionSummary } from '../types/collection';
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';

type Props = {
  visible: boolean;
  box: CollectionBigBox | null;
  allBoxes: CollectionBigBox[];
  collections: CollectionSummary[];
  onClose: () => void;
  onSaved: (boxes: CollectionBigBox[]) => void;
};

export function CollectionBigBoxEditorModal({
  visible,
  box,
  allBoxes,
  collections,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState(DEFAULT_COLLECTION_SYMBOL);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(box?.name || '');
    setSymbol(box?.symbol || '▣');
    setSelected(box?.collectionIds || []);
    setError(null);
    setBusy(false);
  }, [box, visible]);

  const membership = new Map<string, string>();
  for (const candidate of allBoxes) {
    if (candidate.bigBoxId === box?.bigBoxId) continue;
    for (const collectionId of candidate.collectionIds) {
      membership.set(collectionId, candidate.name);
    }
  }

  const toggle = (collectionId: string) => {
    setSelected((current) =>
      current.includes(collectionId)
        ? current.filter((id) => id !== collectionId)
        : [...current, collectionId],
    );
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        symbol,
        collectionIds: selected,
      };

      const next = box
        ? await updateCollectionBigBox(box.bigBoxId, payload)
        : await createCollectionBigBox(payload);

      onSaved(next);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Big Box nije spremljen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!box || busy) return;

    Alert.alert(
      'Obriši Big Box?',
      'Kolekcije se neće obrisati. Samo će se vratiti na glavni popis.',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši Big Box',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setError(null);
            void deleteCollectionBigBox(box.bigBoxId)
              .then((next) => {
                onSaved(next);
                onClose();
              })
              .catch((caught) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : 'Big Box nije obrisan.',
                );
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.back,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>BIG BOX</Text>
            <Text style={styles.title}>
              {box ? 'Uredi Big Box' : 'Novi Big Box'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Naziv</Text>
          <TextInput
            autoFocus={!box}
            maxLength={80}
            onChangeText={setName}
            placeholder="npr. Film, Research, Seasons"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Znak</Text>
          <CollectionSymbolPicker
            value={symbol}
            onChange={setSymbol}
          />

          <View style={styles.collectionHeader}>
            <View>
              <Text style={styles.label}>Kolekcije unutra</Text>
              <Text style={styles.hint}>
                {selected.length} odabrano · jedna kolekcija može biti u jednom Big Boxu
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            {collections.map((collection) => {
              const active = selected.includes(collection.collectionId);
              const otherBox = membership.get(collection.collectionId);

              return (
                <Pressable
                  key={collection.collectionId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  onPress={() => toggle(collection.collectionId)}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      active && styles.checkActive,
                    ]}
                  >
                    <Text style={styles.checkText}>
                      {active ? '✓' : ''}
                    </Text>
                  </View>

                  <View style={styles.collectionSymbol}>
                    <Text style={styles.collectionSymbolText}>
                      {collection.symbol || '◇'}
                    </Text>
                  </View>

                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {collection.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowMeta}>
                      {otherBox
                        ? 'Trenutno u: ' + otherBox + ' · premjestit će se'
                        : collection.itemCount +
                          (collection.itemCount === 1 ? ' stvar' : ' stvari')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!name.trim() || busy}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.save,
              (!name.trim() || busy) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveText}>
                {box ? 'Spremi Big Box' : 'Napravi Big Box'}
              </Text>
            )}
          </Pressable>

          {box ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={remove}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteText}>Obriši Big Box</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  back: {
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
  },
  headerCopy: { flex: 1, marginLeft: 4 },
  eyebrow: {
    color: activeAccentColor,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  label: {
    marginTop: 18,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  hint: {
    marginTop: -3,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  collectionHeader: { marginTop: 8 },
  list: { marginTop: 8 },
  row: {
    minHeight: 72,
    marginBottom: 9,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  rowActive: {
    borderColor: activeAccentColor,
    backgroundColor: colors.fill,
  },
  check: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fill,
  },
  checkActive: {
    borderColor: activeAccentColor,
    backgroundColor: activeAccentColor,
  },
  checkText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  collectionSymbol: {
    width: 42,
    height: 42,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.fillStrong,
  },
  collectionSymbolText: {
    color: colors.text,
    fontSize: 19,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10.5,
  },
  error: {
    marginTop: 14,
    padding: 11,
    color: colors.danger,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },
  save: {
    minHeight: 54,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.black,
  },
  saveText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  deleteButton: {
    minHeight: 50,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
});
