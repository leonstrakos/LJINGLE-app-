const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const frequencyPanel = path.join(SRC, 'components', 'FrequencyLinksPanel.tsx');
const relationsPanel = path.join(SRC, 'components', 'EntityRelationsPanel.tsx');
const entryForm = path.join(SRC, 'screens', 'EntryFormScreen.tsx');

for (const file of [frequencyPanel, relationsPanel, entryForm]) {
  if (!fs.existsSync(file)) {
    throw new Error('SAFE STOP - missing ' + path.relative(ROOT, file));
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'connections-unify-v1-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

for (const file of [frequencyPanel, relationsPanel, entryForm]) backup(file);

// ============================================================================
// 1) FREQUENCY LINKS
//    Same meaning / terminology as catalogue EntityRelationsPanel.
//    - "↗ Link"
//    - existing LJingle entities only
//    - explicit no-results message
//    - target selection + relation + optional note + save
//    - instant modal
//    - tap dimmed backdrop to close on mobile/web
// ============================================================================

const frequencySource = `import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { entityLinksApi } from '../services/entityLinksApi';
import { colors } from '../theme/colors';
import {
  entityTypeLabels,
  relationTypeLabels,
  relationTypes,
  type EntityLink,
  type EntityReference,
  type RelationType,
} from '../types/collection';
import type { MemoryTrack } from '../types/memoryRadio';

type Props = {
  frequency: MemoryTrack;
};

function otherSide(link: EntityLink) {
  if (link.sourceType === 'FREQUENCY') {
    return link.target;
  }

  return link.source;
}

function stop(event: GestureResponderEvent) {
  event.stopPropagation();
}

// connectionsUnifyV1
export function FrequencyLinksPanel({
  frequency,
}: Props) {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityReference[]>([]);
  const [selected, setSelected] = useState<EntityReference | null>(null);
  const [relation, setRelation] = useState<RelationType>('RELATED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLinks(
        await entityLinksApi.getFor(
          'FREQUENCY',
          frequency.trackId,
        ),
      );
    } catch {
      setLinks([]);
    }
  };

  useEffect(() => {
    void load();
  }, [frequency.trackId]);

  useEffect(() => {
    const clean = query.trim();

    if (!visible || selected || clean.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      void entityLinksApi
        .searchReferences(clean)
        .then((items) => {
          if (cancelled) return;

          setResults(
            items.filter(
              (item) =>
                !(
                  item.entityType === 'FREQUENCY' &&
                  item.entityId === frequency.trackId
                ),
            ),
          );
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    frequency.trackId,
    query,
    selected,
    visible,
  ]);

  const related = useMemo(
    () =>
      links.map((link) => ({
        link,
        target: otherSide(link),
      })),
    [links],
  );

  const open = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setRelation('RELATED');
    setNote('');
    setError(null);
    setVisible(true);
  };

  const close = () => {
    if (busy) return;
    setVisible(false);
    setQuery('');
    setResults([]);
    setSelected(null);
    setNote('');
    setError(null);
  };

  const connect = async () => {
    if (!selected || busy) return;

    setBusy(true);
    setError(null);

    try {
      await entityLinksApi.create({
        sourceType: 'FREQUENCY',
        sourceId: frequency.trackId,
        targetType: selected.entityType,
        targetId: selected.entityId,
        relationType: relation,
        note: note.trim() || null,
      });

      setVisible(false);
      setQuery('');
      setResults([]);
      setSelected(null);
      setNote('');
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Poveznica nije spremljena.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (linkId: string) => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await entityLinksApi.remove(linkId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Poveznica nije uklonjena.',
      );
    } finally {
      setBusy(false);
    }
  };

  const cleanQuery = query.trim();
  const showNoResults =
    !selected &&
    !searching &&
    cleanQuery.length >= 2 &&
    results.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Connected</Text>

        <Pressable
          accessibilityRole="button"
          onPress={open}
          style={({ pressed }) => [
            styles.linkAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.linkActionText}>↗ Link</Text>
        </Pressable>
      </View>

      {related.length === 0 ? (
        <Text style={styles.empty}>
          Još nema ručnih veza s drugim stvarima.
        </Text>
      ) : (
        <View style={styles.links}>
          {related.map(({ link, target }) => (
            <View
              key={link.linkId}
              style={styles.linkRow}
            >
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {entityTypeLabels[target.entityType]}
                </Text>
              </View>

              <View style={styles.linkCopy}>
                <Text
                  numberOfLines={1}
                  style={styles.linkTitle}
                >
                  {target.title}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.linkMeta}
                >
                  {relationTypeLabels[link.relationType]}
                  {link.note ? ' · ' + link.note : ''}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Ukloni poveznicu"
                disabled={busy}
                onPress={() => void remove(link.linkId)}
                style={({ pressed }) => [
                  styles.unlink,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.unlinkText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error && !visible ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Modal
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <Pressable
          accessibilityLabel="Zatvori poveznicu"
          onPress={close}
          style={styles.backdrop}
        >
          <Pressable
            onPress={stop}
            style={styles.sheet}
          >
            <SafeAreaView
              edges={['left', 'right', 'bottom']}
              style={styles.sheetSafe}
            >
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.sheetEyebrow}>
                    CREATE CONNECTION
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={styles.sheetTitle}
                  >
                    {frequency.trackTitle}
                  </Text>
                </View>

                <Pressable
                  onPress={close}
                  style={styles.done}
                >
                  <Text style={styles.doneText}>Gotovo</Text>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.label}>VRSTA VEZE</Text>

                <ScrollView
                  contentContainerStyle={styles.relations}
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                >
                  {relationTypes.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setRelation(item)}
                      style={[
                        styles.relationChip,
                        relation === item &&
                          styles.relationChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.relationText,
                          relation === item &&
                            styles.relationTextActive,
                        ]}
                      >
                        {relationTypeLabels[item]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.label}>LINK TO</Text>

                {selected ? (
                  <View style={styles.selected}>
                    <View style={styles.selectedCopy}>
                      <Text
                        numberOfLines={1}
                        style={styles.selectedTitle}
                      >
                        {selected.title}
                      </Text>
                      <Text style={styles.selectedMeta}>
                        {entityTypeLabels[selected.entityType]}
                      </Text>
                    </View>

                    <Pressable
                      disabled={busy}
                      onPress={() => {
                        setSelected(null);
                        setQuery('');
                        setResults([]);
                      }}
                      style={styles.change}
                    >
                      <Text style={styles.changeText}>Promijeni</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setQuery}
                      placeholder="Search books, media, games, topics, notes, frequencies…"
                      placeholderTextColor={colors.textMuted}
                      style={styles.search}
                      value={query}
                    />

                    {cleanQuery.length > 0 &&
                    cleanQuery.length < 2 ? (
                      <Text style={styles.helper}>
                        Upiši najmanje 2 znaka.
                      </Text>
                    ) : null}

                    {searching ? (
                      <ActivityIndicator
                        color={colors.textMuted}
                        style={styles.busy}
                      />
                    ) : null}

                    {showNoResults ? (
                      <View style={styles.noResults}>
                        <Text style={styles.noResultsTitle}>
                          Nema rezultata za “{cleanQuery}”.
                        </Text>
                        <Text style={styles.noResultsCopy}>
                          Link nije slobodan tag. Možeš povezati samo
                          postojeću stvar iz LJinglea.
                        </Text>
                      </View>
                    ) : null}

                    {results.length > 0 ? (
                      <View style={styles.results}>
                        {results.map((item) => (
                          <Pressable
                            key={
                              item.entityType +
                              ':' +
                              item.entityId
                            }
                            onPress={() => setSelected(item)}
                            style={({ pressed }) => [
                              styles.result,
                              pressed && styles.pressed,
                            ]}
                          >
                            <View style={styles.resultType}>
                              <Text style={styles.resultTypeText}>
                                {entityTypeLabels[item.entityType]}
                              </Text>
                            </View>

                            <View style={styles.resultCopy}>
                              <Text
                                numberOfLines={1}
                                style={styles.resultTitle}
                              >
                                {item.title}
                              </Text>

                              {item.subtitle ? (
                                <Text
                                  numberOfLines={1}
                                  style={styles.resultMeta}
                                >
                                  {item.subtitle}
                                </Text>
                              ) : null}
                            </View>

                            <Text style={styles.resultPlus}>+</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}

                <Text style={styles.label}>NOTE (OPTIONAL)</Text>

                <TextInput
                  editable={!busy}
                  onChangeText={setNote}
                  placeholder="Zašto su povezani?"
                  placeholderTextColor={colors.textMuted}
                  style={styles.note}
                  value={note}
                />

                {error ? (
                  <Text style={styles.error}>{error}</Text>
                ) : null}

                <Pressable
                  disabled={!selected || busy}
                  onPress={() => void connect()}
                  style={({ pressed }) => [
                    styles.save,
                    (!selected || busy) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveText}>
                      CREATE CONNECTION
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  linkAction: {
    minHeight: 32,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  linkActionText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  empty: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  links: {
    marginTop: 7,
  },
  linkRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  typeBadge: {
    minWidth: 62,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.fill,
  },
  typeBadgeText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  linkMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 9,
  },
  unlink: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkText: {
    color: colors.textMuted,
    fontSize: 20,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  sheet: {
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  sheetSafe: {
    backgroundColor: colors.background,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sheetTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  done: {
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.black,
  },
  doneText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 34,
  },
  label: {
    marginTop: 15,
    marginBottom: 8,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  relations: {
    gap: 7,
    paddingRight: 10,
  },
  relationChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  relationChipActive: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  relationText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  relationTextActive: {
    color: colors.white,
  },
  search: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 13,
  },
  helper: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 10,
  },
  busy: {
    marginTop: 12,
  },
  noResults: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.fill,
  },
  noResultsTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  noResultsCopy: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  results: {
    marginTop: 8,
  },
  result: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  resultType: {
    width: 68,
  },
  resultTypeText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
  },
  resultPlus: {
    width: 30,
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  selected: {
    minHeight: 58,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.black,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  selectedCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  change: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  changeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  note: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 13,
  },
  save: {
    minHeight: 48,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  saveText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  error: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 10,
    lineHeight: 15,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
`;

write(frequencyPanel, frequencySource);

// ============================================================================
// 2) EXISTING CATALOGUE/GAME LINK MODALS
//    Keep them exactly where they are, but kill slide animation.
//    This makes the behavior consistent with the new frequency composer.
// ============================================================================

{
  let text = read(relationsPanel);

  if (!text.includes('EntityRelationsPanel')) {
    fail('EntityRelationsPanel source unexpected');
  }

  const slideCount = (text.match(/animationType="slide"/g) || []).length;

  if (slideCount > 0) {
    text = text.replace(/animationType="slide"/g, 'animationType="none"');
  }

  if (!text.includes('// connectionsUnifyV1')) {
    const marker = 'export function EntityRelationsPanel';
    const index = text.indexOf(marker);

    if (index < 0) fail('EntityRelationsPanel export anchor missing');

    text =
      text.slice(0, index) +
      '// connectionsUnifyV1 — link modals open instantly.\n' +
      text.slice(index);
  }

  write(relationsPanel, text);
}

// ============================================================================
// 3) NOTES / ZAPISI
//    Keep existing Book/Topic/Activity context fields.
//    Add the SAME generic Collections & connections panel used by catalogue.
//    Only for an already-saved entry because entity_links need a stable entry_id.
// ============================================================================

{
  let text = read(entryForm);

  if (!text.includes("from '../components/EntityRelationsPanel'")) {
    const importAnchor =
      "import { EntryLinkPicker } from '../components/EntryLinkPicker';";

    if (text.includes(importAnchor)) {
      text = text.replace(
        importAnchor,
        importAnchor +
          "\nimport { EntityRelationsPanel } from '../components/EntityRelationsPanel';",
      );
    } else {
      const importLines = [...text.matchAll(/^import .*;$/gm)];

      if (!importLines.length) {
        fail('EntryForm import block missing');
      }

      const last = importLines[importLines.length - 1];
      const insertAt = last.index + last[0].length;

      text =
        text.slice(0, insertAt) +
        "\nimport { EntityRelationsPanel } from '../components/EntityRelationsPanel';" +
        text.slice(insertAt);
    }
  }

  if (!text.includes('entityType="ENTRY"')) {
    const actionsAnchor =
      '          <View style={styles.actions}>';

    const index = text.indexOf(actionsAnchor);

    if (index < 0) {
      fail('EntryForm actions anchor changed');
    }

    const panel = `          {editing && entryId ? (
            <EntityRelationsPanel
              entityType="ENTRY"
              entityId={entryId}
              title={title.trim() || 'Zapis'}
            />
          ) : null}
          {/* connectionsUnifyV1 */}

`;

    text =
      text.slice(0, index) +
      panel +
      text.slice(index);
  }

  write(entryForm, text);
}

console.log('');
console.log('CONNECTIONS UNIFY V1 INSTALLED');
console.log('✓ Frequency now uses ↗ Link language like catalogue/games');
console.log('✓ Frequency link modal opens instantly');
console.log('✓ Tap outside the frequency sheet closes it');
console.log('✓ Random text is NOT saved as a tag/link');
console.log('✓ No-result searches explain that only existing LJingle items can be linked');
console.log('✓ Frequency link flow now selects target before saving');
console.log('✓ Relation type + optional note preserved');
console.log('✓ Catalogue/game relation modals no longer slide');
console.log('✓ Saved Zapisi now get the same Collections & connections panel');
console.log('✓ Existing Zapis Book/Topic/Activity context fields are preserved');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync('npx tsc --noEmit', {
    cwd: MOBILE,
    stdio: 'inherit',
    shell: true,
  });

  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error('TYPESCRIPT FAILED');
  console.error('Backup:', backupDir);
  process.exitCode = 1;
}
