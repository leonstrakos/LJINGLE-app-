const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const topic = path.join(SRC, 'screens', 'TopicDetailsScreen.tsx');
const radio = path.join(SRC, 'screens', 'MemoryRadioScreen.tsx');
const portableExport = path.join(SRC, 'services', 'portableExport.ts');

for (const file of [topic, radio, portableExport]) {
  if (!fs.existsSync(file)) {
    throw new Error('SAFE STOP - missing ' + path.relative(ROOT, file));
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-visual-polish-v1-1-' + stamp,
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

backup(topic);
backup(radio);
backup(portableExport);

// ============================================================================
// TOPIC — finish safely without depending on styles.pressed existing
// ============================================================================

{
  let service = read(portableExport);

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

    write(portableExport, service);
  }

  let text = read(topic);

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
              pressed && { opacity: 0.72 },
              sharingTopic && { opacity: 0.5 },
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

    write(topic, text);
  }
}

// ============================================================================
// MEMORY RADIO — finish visual cleanup
// ============================================================================

{
  let text = read(radio);

  if (!text.includes('// portableFrequencyVisualPolishV1')) {
    // Remove only the injected SHARE Pressable inside rowActions.
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

    write(radio, text);
  }
}

console.log('');
console.log('PORTABLE VISUAL POLISH V1.1 COMPLETE');
console.log('✓ Topic finished without pressed-style dependency');
console.log('✓ Topic share is beside title');
console.log('✓ Frequency share is separate from edit/link/delete');
console.log('✓ Frequency actions are below metadata');
console.log('✓ Previously completed Settings / Collection / Zapis edits preserved');
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
