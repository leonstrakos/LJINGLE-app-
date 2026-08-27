const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  importPanel: path.join(SRC, 'components', 'PortableImportPanel.tsx'),
  collection: path.join(SRC, 'screens', 'CollectionDetailsScreen.tsx'),
  entry: path.join(SRC, 'screens', 'EntryFormScreen.tsx'),
  topic: path.join(SRC, 'screens', 'TopicDetailsScreen.tsx'),
  radio: path.join(SRC, 'screens', 'MemoryRadioScreen.tsx'),
  portableExport: path.join(SRC, 'services', 'portableExport.ts'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SAFE STOP - missing ' + name + ': ' + path.relative(ROOT, file),
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-visual-polish-v1-' + stamp,
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

function removePressableContaining(text, needle) {
  const needleIndex = text.indexOf(needle);
  if (needleIndex < 0) return text;

  const start = text.lastIndexOf('<Pressable', needleIndex);
  const endTag = '</Pressable>';
  const endStart = text.indexOf(endTag, needleIndex);

  if (start < 0 || endStart < 0) {
    fail('could not isolate Pressable containing: ' + needle);
  }

  let end = endStart + endTag.length;

  // Eat one trailing newline so we do not leave a giant blank gap.
  if (text[end] === '\n') end += 1;

  return text.slice(0, start) + text.slice(end);
}

function replaceStyleObject(text, key, replacement) {
  const marker = '  ' + key + ':';
  const start = text.indexOf(marker);
  if (start < 0) fail('style not found: ' + key);

  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) fail('style brace not found: ' + key);

  let depth = 0;
  let braceEnd = -1;

  for (let i = braceStart; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceEnd < 0) fail('style closing brace not found: ' + key);

  let end = braceEnd + 1;
  if (text[end] === ',') end += 1;

  return text.slice(0, start) + replacement + text.slice(end);
}

function insertStylesBefore(text, anchorKey, styleSource) {
  const marker = '  ' + anchorKey + ':';
  const index = text.indexOf(marker);
  if (index < 0) fail('style anchor not found: ' + anchorKey);
  return text.slice(0, index) + styleSource + text.slice(index);
}

for (const file of Object.values(files)) backup(file);

// ============================================================================
// 1) SETTINGS — compact Portable Import, no nested giant card
// ============================================================================

const compactImportPanel = `import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  importPortablePackage,
  readPortablePackageFile,
  type PortablePreview,
} from '../services/portableImport';
import { colors } from '../theme/colors';

function bytesLabel(value: number) {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

export function PortableImportPanel() {
  const [preview, setPreview] = useState<PortablePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async () => {
    if (busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/json',
          'text/plain',
          'application/octet-stream',
          '*/*',
        ],
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) throw new Error('Nije odabrana datoteka.');

      setPreview(await readPortablePackageFile(asset.uri));
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'LJingle paket se nije mogao otvoriti.',
      );
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview || busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const result = await importPortablePackage(preview.pack);

      setMessage(
        'Uvezeno ' +
          result.imported +
          ' · postojeće ' +
          result.reused +
          ' · veze ' +
          result.relationships,
      );

      setPreview(null);

      Alert.alert(
        'LJingle import gotov',
        'Paket je dodan u tvoju lokalnu arhivu.',
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Import nije uspio.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.copyColumn}>
          <Text style={styles.title}>Import .ljingle</Text>
          <Text style={styles.copy}>
            Otvori poslani Zapis, frekvenciju ili Memory Box.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void pick()}
          style={({ pressed }) => [
            styles.pickButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy && !preview ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.pickButtonText}>ODABERI</Text>
          )}
        </Pressable>
      </View>

      {preview ? (
        <View style={styles.preview}>
          <View style={styles.previewTop}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewKicker}>{preview.pack.kind}</Text>
              <Text numberOfLines={2} style={styles.previewTitle}>
                {preview.pack.title}
              </Text>
            </View>

            <Text style={styles.previewSize}>
              {bytesLabel(preview.embeddedBytes)}
            </Text>
          </View>

          <Text style={styles.meta}>
            {preview.pack.objects.length} objekata · {preview.imageCount} slika ·{' '}
            {preview.audioCount} audio
          </Text>

          <View style={styles.previewActions}>
            <Pressable
              disabled={busy}
              onPress={() => setPreview(null)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Odustani</Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={() => void doImport()}
              style={({ pressed }) => [
                styles.importButton,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.importText}>IMPORTIRAJ</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
    marginBottom: 16,
  },
  headerRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copyColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  copy: {
    marginTop: 4,
    maxWidth: 520,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  pickButton: {
    minWidth: 92,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  pickButtonText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  preview: {
    marginTop: 7,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  previewTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  previewSize: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  meta: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 10,
  },
  previewActions: {
    marginTop: 11,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  importButton: {
    minWidth: 108,
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.black,
  },
  importText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  message: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});
`;

write(files.importPanel, compactImportPanel);

// ============================================================================
// 2) COLLECTION — remove giant symbol + move share next to title
// ============================================================================

{
  let text = read(files.collection);

  if (!text.includes('// portableVisualPolishV1')) {
    // Remove the large black collection symbol block.
    text = text.replace(
      /\s*<View style=\{styles\.heroSymbol\}>[\s\S]*?<\/View>\s*(?=<Text style=\{styles\.eyebrow\}>)/,
      '\n              ',
    );

    // Remove the big full-width SHARE MEMORY BOX button.
    text = removePressableContaining(text, 'SHARE MEMORY BOX');

    const heading =
      '<Text style={styles.heading}>{collection.name}</Text>';

    if (!text.includes(heading)) {
      fail('Collection heading anchor changed');
    }

    const replacement = `<View style={styles.portableTitleRow}>
                <Text
                  numberOfLines={2}
                  style={[styles.heading, styles.portableTitleText]}
                >
                  {collection.name}
                </Text>
                <Pressable
                  accessibilityLabel="Share collection"
                  accessibilityRole="button"
                  onPress={() => void shareCollection()}
                  style={({ pressed }) => [
                    styles.portableShare,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.portableShareText}>↗</Text>
                </Pressable>
              </View>
              {/* portableVisualPolishV1 */}`;

    text = text.replace(heading, replacement);

    if (!text.includes('portableTitleRow:')) {
      text = insertStylesBefore(
        text,
        'description',
        `  portableTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  portableTitleText: {
    flex: 1,
    minWidth: 0,
  },
  portableShare: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  portableShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
`,
      );
    }

    write(files.collection, text);
  }
}

// ============================================================================
// 3) ENTRY / NOTE — remove giant share bar + put small share next to heading
// ============================================================================

{
  let text = read(files.entry);

  if (!text.includes('// portableVisualPolishV1')) {
    text = removePressableContaining(text, 'SHARE .LJINGLE');

    const heading =
      "<Text style={styles.heading}>{editing ? 'Uredi zapis' : 'Novi zapis'}</Text>";

    if (!text.includes(heading)) {
      fail('EntryForm heading anchor changed');
    }

    const replacement = `<View style={styles.portableTitleRow}>
              <Text
                style={[styles.heading, styles.portableTitleText]}
              >
                {editing ? 'Uredi zapis' : 'Novi zapis'}
              </Text>

              {editing && entryId ? (
                <Pressable
                  accessibilityLabel="Share zapis"
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void shareEntry()}
                  style={({ pressed }) => [
                    styles.portableShare,
                    pressed && styles.pressed,
                    saving && styles.disabled,
                  ]}
                >
                  <Text style={styles.portableShareText}>↗</Text>
                </Pressable>
              ) : null}
            </View>
            {/* portableVisualPolishV1 */}`;

    text = text.replace(heading, replacement);

    if (!text.includes('portableTitleRow:')) {
      text = insertStylesBefore(
        text,
        'intro',
        `  portableTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  portableTitleText: {
    flex: 1,
    minWidth: 0,
  },
  portableShare: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  portableShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
`,
      );
    }

    write(files.entry, text);
  }
}

// ============================================================================
// 4) TOPIC — portable export + small share next to name, remove giant letter tile
// ============================================================================

{
  let service = read(files.portableExport);

  if (!service.includes('export async function sharePortableTopic')) {
    const marker = 'export function inspectPortablePackage(';
    const index = service.indexOf(marker);

    if (index < 0) fail('portableExport inspect marker changed');

    const topicExport = `export async function buildPortableTopicPackage(
  topicId: string,
) {
  const database = await getDatabase();

  const topic = await loadEntity(
    database,
    'TOPIC',
    topicId,
  );

  if (!topic) {
    throw new Error('Tema ne postoji.');
  }

  const pack = packageBase(
    topic.title,
    'TOPIC',
    topic.portableId,
  );

  pack.objects.push(topic);

  pack.relationships.push(
    ...(await graphRelationships(
      database,
      pack.objects,
    )),
  );

  return pack;
}

export async function sharePortableTopic(
  topicId: string,
) {
  return sharePackage(
    await buildPortableTopicPackage(topicId),
  );
}

`;

    service =
      service.slice(0, index) +
      topicExport +
      service.slice(index);

    write(files.portableExport, service);
  }

  let text = read(files.topic);

  if (!text.includes('// portableVisualPolishV1')) {
    if (!text.includes('sharePortableTopic')) {
      const importAnchor =
        "import { topicApi } from '../services/topicApi';";

      if (!text.includes(importAnchor)) {
        fail('TopicDetails topicApi import changed');
      }

      text = text.replace(
        importAnchor,
        importAnchor +
          "\nimport { sharePortableTopic } from '../services/portableExport';",
      );
    }

    const topicState =
      '  const [topic, setTopic] = useState<TopicResponse | null>(null);';

    if (
      !text.includes('const [sharingTopic, setSharingTopic]') &&
      text.includes(topicState)
    ) {
      text = text.replace(
        topicState,
        topicState +
          "\n  const [sharingTopic, setSharingTopic] = useState(false);",
      );
    }

    if (!text.includes('const shareTopic = async')) {
      const headerMarker = '  const header = (';
      const index = text.indexOf(headerMarker);

      if (index < 0) fail('TopicDetails header marker changed');

      const handler = `  const shareTopic = async () => {
    if (sharingTopic) return;

    setSharingTopic(true);
    setError(null);

    try {
      await sharePortableTopic(topicId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setSharingTopic(false);
    }
  };

`;

      text = text.slice(0, index) + handler + text.slice(index);
    }

    text = text.replace(
      /\s*<View style=\{styles\.heroMark\}>[\s\S]*?<\/View>\s*(?=<Text style=\{styles\.eyebrow\}>)/,
      '\n        ',
    );

    const heading =
      '<Text style={styles.heading}>{topic.name}</Text>';

    if (!text.includes(heading)) {
      fail('TopicDetails heading anchor changed');
    }

    const replacement = `<View style={styles.portableTitleRow}>
          <Text
            numberOfLines={2}
            style={[styles.heading, styles.portableTitleText]}
          >
            {topic.name}
          </Text>

          <Pressable
            accessibilityLabel="Share tema"
            accessibilityRole="button"
            disabled={sharingTopic}
            onPress={() => void shareTopic()}
            style={({ pressed }) => [
              styles.portableShare,
              pressed && styles.pressed,
              sharingTopic && styles.disabled,
            ]}
          >
            <Text style={styles.portableShareText}>↗</Text>
          </Pressable>
        </View>
        {/* portableVisualPolishV1 */}`;

    text = text.replace(heading, replacement);

    if (!text.includes('portableTitleRow:')) {
      text = insertStylesBefore(
        text,
        'description',
        `  portableTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  portableTitleText: {
    flex: 1,
    minWidth: 0,
  },
  portableShare: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  portableShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
`,
      );
    }

    // Topic screens historically already have disabled/pressed; only add if absent.
    if (!text.includes('  disabled:')) {
      text = insertStylesBefore(
        text,
        'pressed',
        `  disabled: { opacity: 0.5 },
`,
      );
    }

    write(files.topic, text);
  }
}

// ============================================================================
// 5) MEMORY RADIO — proper frequency card layout
//    title/meta + distinct share on the side, actions in one clean row below
// ============================================================================

{
  let text = read(files.radio);

  if (!text.includes('// portableFrequencyVisualPolishV1')) {
    // Remove the V1 share action that was injected into rowActions.
    // We will re-add it as a distinct header action.
    text = removePressableContaining(
      text,
      'void shareFrequency(memory)',
    );

    const memoryRowMarker =
      '<View key={memory.trackId} style={styles.memoryRow}>';

    const rowIndex = text.indexOf(memoryRowMarker);
    if (rowIndex < 0) fail('MemoryRadio memory row anchor changed');

    const pressStart = text.indexOf('<Pressable', rowIndex);
    const pressEndStart = text.indexOf('</Pressable>', pressStart);

    if (pressStart < 0 || pressEndStart < 0) {
      fail('MemoryRadio frequency title Pressable changed');
    }

    const pressEnd = pressEndStart + '</Pressable>'.length;

    const openHeader =
      `<View style={styles.frequencyHeader}>
                  `;

    const shareButton = `

                  <Pressable
                    accessibilityLabel="Share frequency"
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void shareFrequency(memory)}
                    style={({ pressed }) => [
                      styles.frequencyShare,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Text style={styles.frequencyShareText}>↗</Text>
                  </Pressable>
                </View>
                {/* portableFrequencyVisualPolishV1 */}`;

    text =
      text.slice(0, pressStart) +
      openHeader +
      text.slice(pressStart, pressEnd) +
      shareButton +
      text.slice(pressEnd);

    text = replaceStyleObject(
      text,
      'memoryRow',
      `  memoryRow: {
    marginTop: 11,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 17,
  },`,
    );

    text = replaceStyleObject(
      text,
      'memoryRowCopy',
      `  memoryRowCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 12,
  },`,
    );

    text = replaceStyleObject(
      text,
      'rowActions',
      `  rowActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },`,
    );

    if (!text.includes('frequencyHeader:')) {
      text = insertStylesBefore(
        text,
        'memoryRowCopy',
        `  frequencyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  frequencyShare: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  frequencyShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
`,
      );
    }

    write(files.radio, text);
  }
}

console.log('');
console.log('PORTABLE VISUAL POLISH V1 INSTALLED');
console.log('✓ Settings import is compact / no nested giant card');
console.log('✓ Collection giant symbol removed');
console.log('✓ Collection share moved beside title');
console.log('✓ Zapis share moved beside title');
console.log('✓ Topic giant initial tile removed');
console.log('✓ Topic portable share added beside title');
console.log('✓ Frequency share separated from edit/delete actions');
console.log('✓ Frequency actions now sit in a clean row under metadata');
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
