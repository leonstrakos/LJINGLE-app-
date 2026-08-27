const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const files = {
  entryForm: path.join(SRC, 'screens', 'EntryFormScreen.tsx'),
  entryList: path.join(SRC, 'screens', 'EntryListScreen.tsx'),
  palette: path.join(SRC, 'components', 'CommandPalette.tsx'),
  cloudSync: path.join(SRC, 'services', 'cloudSync.ts'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`SAFE STOP - missing ${name}: ${file}`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '_recovery', `brutus-functional-v1-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });

function backup(file) {
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function must(condition, message) {
  if (!condition) throw new Error(`SAFE STOP - ${message}`);
}

Object.values(files).forEach(backup);

// ============================================================
// 1) ENTRY IMAGE REMOVE GLYPH
// ============================================================

{
  const file = files.entryForm;
  let text = read(file);

  const marker = '<Text style={styles.removeImageText}>?</Text>';
  const count = text.split(marker).length - 1;

  if (count > 0) {
    text = text.split(marker).join(
      '<Text style={styles.removeImageText}>×</Text>'
    );
  } else if (!text.includes(
    '<Text style={styles.removeImageText}>×</Text>'
  )) {
    throw new Error(
      'SAFE STOP - image remove glyph marker not found'
    );
  }

  if (!text.includes('// brutusImageRemoveGlyphV1')) {
    text = text.replace(
      'export function EntryFormScreen',
      '// brutusImageRemoveGlyphV1\nexport function EntryFormScreen'
    );
  }

  write(file, text);
}

// ============================================================
// 2) ENTRY LIST SEARCH
// ============================================================

{
  const file = files.entryList;
  let text = read(file);

  // Add TextInput to react-native import.
  if (!/\bTextInput\b/.test(
    text.slice(0, text.indexOf("from 'react-native';") + 20)
  )) {
    const marker = '  Text,\n  View,\n} from \'react-native\';';
    must(text.includes(marker), 'EntryList react-native import marker changed');
    text = text.replace(
      marker,
      '  Text,\n  TextInput,\n  View,\n} from \'react-native\';'
    );
  }

  if (!text.includes('function normalizeEntrySearch')) {
    const marker = "type Filter = EntryType | 'ALL';";
    must(text.includes(marker), 'EntryList Filter marker missing');

    text = text.replace(
      marker,
      `${marker}

function normalizeEntrySearch(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('hr-HR')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '');
}

// brutusEntrySearchV1`
    );
  }

  if (!text.includes("const [query, setQuery] = useState('');")) {
    const marker =
      "  const [filter, setFilter] = useState<Filter>('ALL');";
    must(text.includes(marker), 'EntryList filter state marker missing');
    text = text.replace(
      marker,
      `${marker}
  const [query, setQuery] = useState('');`
    );
  }

  if (!text.includes('const visibleEntries = entries.filter')) {
    const marker = '  const header = (';
    must(text.includes(marker), 'EntryList header marker missing');

    text = text.replace(
      marker,
      `  const normalizedQuery =
    normalizeEntrySearch(query.trim());

  const visibleEntries = entries.filter((entry) => {
    if (!normalizedQuery) return true;

    const haystack = normalizeEntrySearch(
      [
        entry.title,
        entry.content,
        entryTypeLabels[entry.type],
      ]
        .filter(Boolean)
        .join(' '),
    );

    return haystack.includes(normalizedQuery);
  });

${marker}`
    );
  }

  if (!text.includes('placeholder="Pretraži zapise..."')) {
    const marker =
      `      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('EntryForm')`;

    const start = text.indexOf(marker);
    must(start >= 0, 'EntryList New Entry card marker missing');

    const close = text.indexOf('\n      </Pressable>', start);
    must(close >= 0, 'EntryList New Entry card end missing');
    const insertAt = close + '\n      </Pressable>'.length;

    const searchUi = `

      <View style={styles.entrySearchWrap}>
        <TextInput
          accessibilityLabel="Pretraži zapise"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Pretraži zapise..."
          placeholderTextColor={colors.textMuted}
          style={styles.entrySearchInput}
          value={query}
        />
      </View>`;

    text =
      text.slice(0, insertAt) +
      searchUi +
      text.slice(insertAt);
  }

  text = text.replace('        data={entries}', '        data={visibleEntries}');

  if (!text.includes('entrySearchWrap: {')) {
    const marker = 'const styles = StyleSheet.create({';
    must(text.includes(marker), 'EntryList styles marker missing');

    text = text.replace(
      marker,
      `${marker}
  entrySearchWrap: {
    marginTop: 18,
    marginBottom: 4,
  },
  entrySearchInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
  },`
    );
  }

  write(file, text);
}

// ============================================================
// 3) COMMAND PALETTE: ZAPISI + FREQUENCIES
// ============================================================

{
  const file = files.palette;
  let text = read(file);

  // Add service/type imports without depending on the current import ordering.
  const importAnchor = "import { colors } from '../theme/colors';";
  must(text.includes(importAnchor), 'CommandPalette colors import marker missing');

  const extraImports = [];
  if (!text.includes("from '../services/entryApi'")) {
    extraImports.push("import { entryApi } from '../services/entryApi';");
  }
  if (!text.includes("from '../services/memoryRadioApi'")) {
    extraImports.push("import { memoryRadioApi } from '../services/memoryRadioApi';");
  }
  if (!text.includes("from '../types/entry'")) {
    extraImports.push("import type { Entry } from '../types/entry';");
  }
  if (!text.includes("from '../types/memoryRadio'")) {
    extraImports.push("import type { MemoryTrack } from '../types/memoryRadio';");
  }

  if (extraImports.length) {
    text = text.replace(
      importAnchor,
      `${importAnchor}\n${extraImports.join('\n')}`
    );
  }

  text = text.replace(
    "kind: 'BOOK' | 'MEDIA' | 'GAME';",
    "kind: 'BOOK' | 'MEDIA' | 'GAME' | 'ENTRY' | 'FREQUENCY';"
  );

  if (!text.includes('const [entries, setEntries]')) {
    const marker =
      '  const [games, setGames] = useState<GameResponse[]>([]);';
    must(text.includes(marker), 'CommandPalette games state marker missing');
    text = text.replace(
      marker,
      `${marker}
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frequencies, setFrequencies] = useState<MemoryTrack[]>([]);`
    );
  }

  // Independent loader so we do not touch the existing book/media/game loader.
  if (!text.includes('// brutusPaletteExtendedEntitiesV1')) {
    const marker =
      '  const [loading, setLoading] = useState(false);';
    must(text.includes(marker), 'CommandPalette loading state marker missing');

    const insertion = `${marker}

  // brutusPaletteExtendedEntitiesV1
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    void Promise.all([
      entryApi.getAll(),
      memoryRadioApi.getAll(),
    ])
      .then(([nextEntries, nextFrequencies]) => {
        if (cancelled) return;
        setEntries(nextEntries);
        setFrequencies(nextFrequencies);
      })
      .catch(() => {
        // Extended search is additive. Existing palette stays usable.
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);`;

    text = text.replace(marker, insertion);
  }

  // Open entry/frequency before GAME fallback.
  if (!text.includes("entity.kind === 'ENTRY'")) {
    const marker = "    if (entity.kind === 'MEDIA') {";
    must(text.includes(marker), 'CommandPalette MEDIA open marker missing');

    const mediaStart = text.indexOf(marker);
    const gameFallback = text.indexOf(
      "    navigate('Games',",
      mediaStart
    );
    must(gameFallback >= 0, 'CommandPalette GAME fallback marker missing');

    const block = `    if (entity.kind === 'ENTRY') {
      navigate('EntryForm', {
        entryId: entity.id,
      });
      return;
    }

    if (entity.kind === 'FREQUENCY') {
      navigate('MemoryRadio');
      return;
    }

`;

    text =
      text.slice(0, gameFallback) +
      block +
      text.slice(gameFallback);
  }

  // Add Zapisi screen command.
  if (!text.includes("key: 'entries'")) {
    const marker = `      {
        key: 'new-entry',`;
    must(text.includes(marker), 'CommandPalette new-entry command marker missing');

    text = text.replace(
      marker,
      `      {
        key: 'entries',
        label: 'Zapisi',
        detail: 'Otvori i pretraži spremljene zapise',
        aliases: 'zapisi entries biljeske bilješke citati notes',
        action: () => navigate('Entries'),
      },
${marker}`
    );
  }

  // Extend entity array after games mapping, without depending on exact game fields.
  if (!text.includes("key: 'ENTRY:' + entry.entryId")) {
    const marker = '  const items = useMemo<PaletteItem[]>(() => {';
    const entityStart = text.indexOf(
      '  const entities = useMemo<SearchEntity[]>('
    );
    must(entityStart >= 0, 'CommandPalette entities block missing');
    const itemsStart = text.indexOf(marker, entityStart);
    must(itemsStart >= 0, 'CommandPalette items block missing');

    const entityBlock = text.slice(entityStart, itemsStart);

    // Insert right before the closing `], [books, media, games]` area by finding last `],`
    // within the entity block. We use a safer strategy: replace the final `...games.map`
    // expression terminator when present; otherwise append via array spread before `],`.
    const closeArray = entityBlock.lastIndexOf('    ],');
    must(closeArray >= 0, 'CommandPalette entity array close not found');

    const additions = `      ...entries.map((entry) => ({
        key: 'ENTRY:' + entry.entryId,
        kind: 'ENTRY' as const,
        id: entry.entryId,
        title:
          entry.title?.trim() ||
          entry.content.replace(/\\s+/g, ' ').trim().slice(0, 64) ||
          'Zapis',
        typeLabel: 'Zapis',
        meta: entry.content.replace(/\\s+/g, ' ').trim().slice(0, 140),
        favourite: false,
      })),
      ...frequencies.map((frequency) => ({
        key: 'FREQUENCY:' + frequency.trackId,
        kind: 'FREQUENCY' as const,
        id: frequency.trackId,
        title: frequency.trackTitle || 'Frekvencija',
        typeLabel: 'Frekvencija',
        meta: [
          frequency.artist,
          'Memory Radio',
          frequency.linkId ? 'Povezano' : 'Nepovezano',
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: false,
      })),
`;

    const revised =
      entityBlock.slice(0, closeArray) +
      additions +
      entityBlock.slice(closeArray);

    text =
      text.slice(0, entityStart) +
      revised +
      text.slice(itemsStart);

    // Add hook dependencies if they are not already present.
    text = text.replace(
      /\n\s*books,\n\s*media,\n\s*games,\n/,
      (match) => {
        if (match.includes('entries')) return match;
        return match.replace(
          /\n\s*games,\n/,
          '\n    games,\n    entries,\n    frequencies,\n'
        );
      }
    );
  }

  write(file, text);
}

// ============================================================
// 4) CLOUD SYNC NATIVE AUTH DIAGNOSTIC
// ============================================================

{
  const file = files.cloudSync;
  let text = read(file);

  // Do not hardcode the secret. Make missing-build-key distinguishable from a
  // genuinely wrong key so Android does not misleadingly report Unauthorized.
  if (!text.includes('Cloud Sync key nedostaje u ovom buildu')) {
    const marker =
      'function authHeaders():\n  Record<string, string> {';
    must(text.includes(marker), 'cloudSync authHeaders marker missing');

    text = text.replace(
      marker,
      `${marker}
  if (!SYNC_KEY) {
    throw new Error(
      'Cloud Sync key nedostaje u ovom buildu. Ponovno pokreni/rebuildaj Expo s EXPO_PUBLIC_SYNC_KEY.',
    );
  }`
    );
  }

  write(file, text);
}

// ============================================================
// VERIFY
// ============================================================

console.log('');
console.log('BRUTUS FUNCTIONAL V1 PATCHED');
console.log('');
console.log('✓ Entry image remove glyph: ? -> ×');
console.log('✓ Zapisi screen search');
console.log('✓ Ctrl+K command: Zapisi');
console.log('✓ Ctrl+K searches entry title/content');
console.log('✓ Ctrl+K searches Memory Radio frequencies');
console.log('✓ frequency result opens Memory Radio');
console.log('✓ cloud auth now distinguishes missing build key');
console.log('');
console.log('NOT TOUCHED:');
console.log('  TodayScreen / meadow / frosted UI');
console.log('  SQLite schema');
console.log('  databaseConnection.ts');
console.log('  generic entity-link schema');
console.log('');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '--noEmit'],
    {
      cwd: MOBILE,
      stdio: 'inherit',
      shell: false,
    }
  );
  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch (error) {
  console.error('');
  console.error('TYPESCRIPT FAILED - restore from backup if needed:');
  console.error(backupDir);
  process.exitCode = 1;
}
