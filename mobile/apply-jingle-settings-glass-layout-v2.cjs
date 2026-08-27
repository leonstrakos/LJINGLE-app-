const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const recoveryRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-settings-glass-v2-${stamp}`,
);
fs.mkdirSync(recoveryRoot, { recursive: true });

const touched = [
  'App.tsx',
  'src/components/JinglePortal.tsx',
  'src/components/CelestialAtmosphere.tsx',
  'src/screens/ThemePickerScreen.tsx',
  'src/screens/BookListScreen.tsx',
].filter((rel) => fs.existsSync(path.join(root, rel)));

const created = ['src/services/jinglePortalPreference.ts'];

function runTsc() {
  const r = process.platform === 'win32'
    ? cp.spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx tsc --noEmit'], {
        cwd: root,
        encoding: 'utf8',
      })
    : cp.spawnSync('npx', ['tsc', '--noEmit'], {
        cwd: root,
        encoding: 'utf8',
      });

  return {
    status: r.status ?? 1,
    text: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\r\n/g, '\n').trim(),
  };
}

function diagnostics(text) {
  return new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /(?:^|[\\/])[^:()]+\.\w+\(\d+,\d+\): error TS\d+:/.test(line)),
  );
}

function newDiagnostics(before, after) {
  const oldSet = diagnostics(before);
  return [...diagnostics(after)].filter((line) => !oldSet.has(line));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function insertImport(src, line) {
  if (src.includes(line)) return src;

  const importRegex = /(^|\n)import\b[\s\S]*?;\s*(?=\n|$)/g;
  let match;
  let lastEnd = -1;

  while ((match = importRegex.exec(src)) !== null) {
    lastEnd = match.index + match[0].length;
  }

  if (lastEnd < 0) throw new Error('Could not safely locate import block.');
  return src.slice(0, lastEnd) + '\n' + line + src.slice(lastEnd);
}

function styleBlock(src, name, mutate) {
  const startToken = `  ${name}: {`;
  const start = src.indexOf(startToken);
  if (start < 0) throw new Error(`style block not found: ${name}`);

  const end = src.indexOf('\n  },', start);
  if (end < 0) throw new Error(`style block end not found: ${name}`);

  const blockEnd = end + '\n  },'.length;
  const block = src.slice(start, blockEnd);
  return src.slice(0, start) + mutate(block) + src.slice(blockEnd);
}

const backups = new Map();

for (const rel of touched) {
  const file = path.join(root, rel);
  const dst = path.join(recoveryRoot, rel);
  ensureDir(dst);
  fs.copyFileSync(file, dst);
  backups.set(rel, dst);
}

for (const rel of created) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const dst = path.join(recoveryRoot, rel);
  ensureDir(dst);
  fs.copyFileSync(file, dst);
  backups.set(rel, dst);
}

function restore() {
  for (const [rel, backup] of backups) {
    fs.copyFileSync(backup, path.join(root, rel));
  }

  for (const rel of created) {
    if (!backups.has(rel)) {
      const file = path.join(root, rel);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

console.log('Capturing current TypeScript baseline...');
const before = runTsc();

try {
  // ---------------------------------------------------------------------
  // 1) Persistent Jingle visibility preference
  // ---------------------------------------------------------------------
  {
    const rel = 'src/services/jinglePortalPreference.ts';
    const file = path.join(root, rel);
    ensureDir(file);

    fs.writeFileSync(file, `import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_KEY = 'ljingle_jingle_portal_enabled';
const FILE_NAME = 'ljingle-jingle-portal-preference.json';

let cachedValue: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

export async function getJinglePortalEnabled(): Promise<boolean> {
  if (cachedValue !== null) return cachedValue;

  try {
    if (Platform.OS === 'web') {
      const raw = (globalThis as any).localStorage?.getItem(WEB_KEY);
      cachedValue = raw === null || raw === undefined ? true : raw !== 'false';
      return cachedValue;
    }

    const file = new File(Paths.document, FILE_NAME);
    const raw = await file.text();
    const parsed = JSON.parse(raw) as { enabled?: unknown };
    cachedValue = parsed.enabled !== false;
    return cachedValue;
  } catch {
    cachedValue = true;
    return true;
  }
}

export async function setJinglePortalEnabled(value: boolean): Promise<void> {
  cachedValue = value;

  if (Platform.OS === 'web') {
    (globalThis as any).localStorage?.setItem(WEB_KEY, String(value));
  } else {
    const file = new File(Paths.document, FILE_NAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify({ enabled: value }));
  }

  listeners.forEach((listener) => listener(value));
}

export function subscribeJinglePortalEnabled(
  listener: (value: boolean) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
`, 'utf8');

    console.log('  ✓ Jingle preference');
  }

  // ---------------------------------------------------------------------
  // 2) App live ON/OFF — formatting-independent
  // ---------------------------------------------------------------------
  {
    const rel = 'App.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = insertImport(
      src,
      `import {
  getJinglePortalEnabled,
  subscribeJinglePortalEnabled,
} from './src/services/jinglePortalPreference';`,
    );

    if (!src.includes('jinglePortalEnabled, setJinglePortalEnabledState')) {
      const paletteStateRx =
        /const\s*\[\s*paletteOpenSignal\s*,\s*setPaletteOpenSignal\s*\]\s*=\s*useState(?:<[^>]+>)?\(\s*0\s*\)\s*;/m;
      const match = src.match(paletteStateRx);

      if (!match) {
        throw new Error('Could not locate paletteOpenSignal state in App.tsx.');
      }

      src = src.replace(
        match[0],
        `${match[0]}
  const [jinglePortalEnabled, setJinglePortalEnabledState] =
    useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    void getJinglePortalEnabled().then((value) => {
      if (active) setJinglePortalEnabledState(value);
    });

    const unsubscribe = subscribeJinglePortalEnabled((value) => {
      if (active) setJinglePortalEnabledState(value);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);`,
      );
    }

    if (!src.includes('{jinglePortalEnabled ? (')) {
      const portalRx = /<JinglePortal\b[\s\S]*?\/>/m;
      const portal = src.match(portalRx);

      if (!portal) throw new Error('Could not locate <JinglePortal ... /> in App.tsx.');

      src = src.replace(
        portal[0],
        `{jinglePortalEnabled ? (
        ${portal[0]}
      ) : null}`,
      );
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ App live Jingle ON/OFF');
  }

  // ---------------------------------------------------------------------
  // 3) Settings toggle + Accent switch colors
  // ---------------------------------------------------------------------
  {
    const rel = 'src/screens/ThemePickerScreen.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = insertImport(
      src,
      `import {
  getJinglePortalEnabled,
  setJinglePortalEnabled,
} from '../services/jinglePortalPreference';`,
    );

    if (!src.includes('jinglePortalEnabled, setJinglePortalEnabledState')) {
      const soundReadyRx =
        /const\s*\[\s*soundPreferenceReady\s*,\s*setSoundPreferenceReady\s*\]\s*=\s*useState\(\s*false\s*\)\s*;/m;
      const match = src.match(soundReadyRx);

      if (!match) throw new Error('Could not locate soundPreferenceReady state.');

      src = src.replace(
        match[0],
        `${match[0]}
  const [jinglePortalEnabled, setJinglePortalEnabledState] = useState(true);
  const [jinglePreferenceReady, setJinglePreferenceReady] = useState(false);`,
      );
    }

    if (!src.includes('void getJinglePortalEnabled()')) {
      const changeSoundIndex = src.indexOf('const changeSoundEffects');
      if (changeSoundIndex < 0) {
        throw new Error('Could not locate changeSoundEffects.');
      }

      src =
        src.slice(0, changeSoundIndex) +
        `useEffect(() => {
    let active = true;

    void getJinglePortalEnabled()
      .then((value) => {
        if (active) setJinglePortalEnabledState(value);
      })
      .finally(() => {
        if (active) setJinglePreferenceReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  ` +
        src.slice(changeSoundIndex);
    }

    if (!src.includes('const changeJinglePortal')) {
      const cloudIndex = src.indexOf('void getCloudSyncState()');

      if (cloudIndex < 0) {
        throw new Error('Could not locate cloud settings effect.');
      }

      const effectStart = src.lastIndexOf('useEffect(() => {', cloudIndex);
      if (effectStart < 0) {
        throw new Error('Could not locate cloud settings effect start.');
      }

      src =
        src.slice(0, effectStart) +
        `const changeJinglePortal = async (value: boolean) => {
    const previous = jinglePortalEnabled;
    setJinglePortalEnabledState(value);

    try {
      await setJinglePortalEnabled(value);
    } catch {
      setJinglePortalEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

  ` +
        src.slice(effectStart);
    }

    // Accent the existing sound switch without replacing its whole section.
    const soundSwitchIndex = src.indexOf('accessibilityLabel="Sound effects"');
    if (soundSwitchIndex < 0) throw new Error('Sound Effects switch not found.');

    const soundSwitchStart = src.lastIndexOf('<Switch', soundSwitchIndex);
    const soundSwitchEnd = src.indexOf('/>', soundSwitchIndex);
    if (soundSwitchStart < 0 || soundSwitchEnd < 0) {
      throw new Error('Could not isolate Sound Effects switch.');
    }

    let soundSwitch = src.slice(soundSwitchStart, soundSwitchEnd + 2);

    if (!soundSwitch.includes('trackColor=')) {
      soundSwitch = soundSwitch.replace(
        /(\s+value=\{soundEffectsEnabled\})/,
        `
              ios_backgroundColor={colors.fillStrong}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.fillStrong, true: accent }}$1`,
      );

      src =
        src.slice(0, soundSwitchStart) +
        soundSwitch +
        src.slice(soundSwitchEnd + 2);
    }

    // Insert Jingle section immediately before Color settings.
    if (!src.includes('accessibilityLabel="Jingle button"')) {
      const colorMarker = "{colorTarget === 'accent' ? 'Boja naglaska' : 'Boja pozadine'}";
      const colorMarkerIndex = src.indexOf(colorMarker);

      if (colorMarkerIndex < 0) throw new Error('Color settings marker not found.');

      const colorSectionStart = src.lastIndexOf(
        '<View style={styles.section}>',
        colorMarkerIndex,
      );

      if (colorSectionStart < 0) throw new Error('Color settings section start not found.');

      const jingleSection = `        <View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Jingle button</Text>
              <Text style={styles.soundSettingHint}>
                Prikaži plutajuće Jingle zvono. Kad je isključeno, Command Palette i gesture prečaci i dalje rade.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Jingle button"
              disabled={!jinglePreferenceReady}
              ios_backgroundColor={colors.fillStrong}
              onValueChange={(value) => void changeJinglePortal(value)}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.fillStrong, true: accent }}
              value={jinglePortalEnabled}
            />
          </View>
        </View>

`;

      src =
        src.slice(0, colorSectionStart) +
        jingleSection +
        src.slice(colorSectionStart);
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Settings Jingle toggle + Accent switches');
  }

  // ---------------------------------------------------------------------
  // 4) Bigger bell + Aero/Frutiger frosted glass
  // ---------------------------------------------------------------------
  {
    const rel = 'src/components/JinglePortal.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = insertImport(
      src,
      `import { activeAccentColor } from '../theme/colors';`,
    );
    src = insertImport(
      src,
      `import { activeVisualSkinId } from '../theme/visualSkins';`,
    );

    if (!src.includes("const aeroMode = activeVisualSkinId === 'aero'")) {
      const destinationsIndex = src.indexOf('const destinations:');
      if (destinationsIndex < 0) throw new Error('Jingle destinations declaration not found.');

      src =
        src.slice(0, destinationsIndex) +
        `const aeroMode = activeVisualSkinId === 'aero';
const webGlassStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(18px) saturate(1.18)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.18)',
      } as any)
    : null;

` +
        src.slice(destinationsIndex);
    }

    src = src.replace(
      '<View style={styles.halo} />',
      '<View style={[styles.halo, aeroMode && styles.aeroHalo]} />',
    );

    if (!src.includes('aeroMode && styles.aeroButton')) {
      const styleRx =
        /style=\{\(\{\s*pressed\s*\}\)\s*=>\s*\[\s*styles\.button,\s*pressed\s*&&\s*styles\.buttonPressed,\s*\]\}/m;

      if (!styleRx.test(src)) {
        throw new Error('Jingle button style callback not found.');
      }

      src = src.replace(
        styleRx,
`style={({ pressed }) => [
            styles.button,
            aeroMode && styles.aeroButton,
            aeroMode && webGlassStyle,
            aeroMode && { borderColor: activeAccentColor },
            pressed && styles.buttonPressed,
          ]}`,
      );
    }

    if (!src.includes('styles.glassHighlight')) {
      const animatedIndex = src.indexOf('<Animated.View');
      if (animatedIndex < 0) throw new Error('Jingle bell Animated.View not found.');

      src =
        src.slice(0, animatedIndex) +
        `{aeroMode ? <View style={styles.glassHighlight} /> : null}

          ` +
        src.slice(animatedIndex);
    }

    if (!src.includes('aeroMode && styles.aeroSheet')) {
      src = src.replace(
        '<View style={styles.sheet}>',
`<View
            style={[
              styles.sheet,
              aeroMode && styles.aeroSheet,
              aeroMode && webGlassStyle,
            ]}
          >`,
      );
    }

    src = styleBlock(src, 'anchor', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 96,')
        .replace(/height:\s*\d+,/, 'height: 96,')
        .replace(/marginLeft:\s*-\d+,/, 'marginLeft: -48,'),
    );

    src = styleBlock(src, 'halo', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 94,')
        .replace(/height:\s*\d+,/, 'height: 94,')
        .replace(/borderRadius:\s*\d+,/, 'borderRadius: 47,'),
    );

    src = styleBlock(src, 'button', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 80,')
        .replace(/height:\s*\d+,/, 'height: 80,')
        .replace(/borderRadius:\s*\d+,/, 'borderRadius: 40,'),
    );

    src = styleBlock(src, 'bellWrap', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 66,')
        .replace(/height:\s*\d+,/, 'height: 70,'),
    );

    src = styleBlock(src, 'bell', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 62,')
        .replace(/height:\s*\d+,/, 'height: 68,'),
    );

    if (!src.includes('  aeroButton: {')) {
      const buttonPressedIndex = src.indexOf('  buttonPressed: {');
      if (buttonPressedIndex < 0) throw new Error('buttonPressed style not found.');

      src =
        src.slice(0, buttonPressedIndex) +
`  aeroHalo: {
    backgroundColor: 'rgba(236, 251, 255, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
  },
  aeroButton: {
    backgroundColor: 'rgba(236, 250, 255, 0.54)',
    borderWidth: 1.5,
    shadowColor: '#4A9CD7',
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  glassHighlight: {
    position: 'absolute',
    top: 7,
    left: 12,
    right: 12,
    height: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  aeroSheet: {
    backgroundColor: 'rgba(244, 252, 255, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.76)',
    shadowColor: '#3A86B8',
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
` +
        src.slice(buttonPressedIndex);
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Bigger bell + Frutiger glass');
  }

  // ---------------------------------------------------------------------
  // 5) Celestial clipping/layout fix
  // ---------------------------------------------------------------------
  {
    const rel = 'src/components/CelestialAtmosphere.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = styleBlock(src, 'root', () =>
`  root: {
    position: 'absolute',
    top: -10,
    left: -22,
    right: -22,
    height: 126,
    overflow: 'hidden',
    pointerEvents: 'none',
  },`,
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Celestial clipping/layout fix');
  }

  // ---------------------------------------------------------------------
  // 6) Remove redundant Books FAB that collides with global Jingle
  // ---------------------------------------------------------------------
  {
    const rel = 'src/screens/BookListScreen.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    const labelIndex = src.indexOf('accessibilityLabel="Dodaj novu knjigu"');

    if (labelIndex >= 0) {
      const start = src.lastIndexOf('<Pressable', labelIndex);
      const endStart = src.indexOf('</Pressable>', labelIndex);

      if (start < 0 || endStart < 0) {
        throw new Error('Could not safely isolate old Books FAB.');
      }

      const end = endStart + '</Pressable>'.length;
      const block = src.slice(start, end);

      if (!block.includes('styles.fab') || !block.includes('Nova knjiga')) {
        throw new Error('Books FAB safety check failed.');
      }

      src = src.slice(0, start) + src.slice(end);
      console.log('  ✓ Removed redundant Books Nova knjiga FAB');
    } else {
      console.log('  • Books Nova knjiga FAB already absent');
    }

    // Leave extra room for the global orb.
    src = src.replace(
      /(paddingBottom:\s*)(?:34|48|64|80|96|112)(,)/,
      '$1120$2',
    );

    fs.writeFileSync(file, src, 'utf8');
  }

  console.log('\nChecking TypeScript against baseline...');
  const after = runTsc();
  const added = newDiagnostics(before.text, after.text);

  if (added.length > 0) {
    console.error('\nNEW TypeScript diagnostics detected — restoring entire patch.');
    console.error('\n--- New diagnostics only ---\n');
    console.error(added.join('\n'));
    restore();
    process.exit(1);
  }

  console.log('\n✓ Jingle settings + glass/layout v2 applied.');
  console.log('✓ Jingle can be turned ON/OFF in Settings and updates live.');
  console.log('✓ Sound Effects + Jingle switches use the selected Accent color.');
  console.log('✓ Frutiger/Aero orb + panel use frosted-glass treatment.');
  console.log('✓ Bell is larger inside the orb.');
  console.log('✓ Celestial atmosphere clipping/over-constraint fixed.');
  console.log('✓ Redundant Books floating Nova knjiga button removed.');
  console.log('BACKUP: ' + recoveryRoot);

  if (after.status === 0) {
    console.log('TYPESCRIPT CLEAN ✓');
  } else {
    console.log('No new TypeScript diagnostics; existing baseline unchanged.');
  }
} catch (error) {
  restore();
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
