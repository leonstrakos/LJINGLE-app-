const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const recoveryRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-settings-glass-${stamp}`,
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

function norm(text) {
  return text
    .replace(/Found \d+ errors?.*$/gm, '')
    .replace(/\r/g, '')
    .trim();
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function backup(rel, backups) {
  if (backups.has(rel)) return;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  const dst = path.join(recoveryRoot, rel);
  ensureDir(dst);
  fs.copyFileSync(file, dst);
  backups.set(rel, dst);
}

function insertImport(src, line) {
  if (src.includes(line)) return src;

  const importRegex = /(^|\n)import\b[\s\S]*?;\s*(?=\n|$)/g;
  let match;
  let lastEnd = -1;

  while ((match = importRegex.exec(src)) !== null) {
    lastEnd = match.index + match[0].length;
  }

  if (lastEnd < 0) throw new Error('Could not locate complete import block.');
  return src.slice(0, lastEnd) + '\n' + line + src.slice(lastEnd);
}

function mustReplace(src, oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error('anchor not found: ' + label);
  return src.replace(oldText, newText);
}

const backups = new Map();
for (const rel of touched) backup(rel, backups);

for (const rel of created) {
  const file = path.join(root, rel);
  if (fs.existsSync(file)) backup(rel, backups);
}

function restore() {
  for (const [rel, backupPath] of backups) {
    fs.copyFileSync(backupPath, path.join(root, rel));
  }
  for (const rel of created) {
    if (!backups.has(rel)) {
      const file = path.join(root, rel);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

console.log('Capturing TypeScript baseline...');
const before = runTsc();

try {
  // -----------------------------------------------------------------------
  // Persistent Jingle portal preference with live subscriptions.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/services/jinglePortalPreference.ts';
    const file = path.join(root, rel);
    ensureDir(file);

    fs.writeFileSync(
      file,
`import { Platform } from 'react-native';
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
`,
      'utf8',
    );
    console.log('  ✓ Jingle preference');
  }

  // -----------------------------------------------------------------------
  // App: live show/hide portal.
  // -----------------------------------------------------------------------
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

    if (!src.includes('const [jinglePortalEnabled')) {
      src = mustReplace(
        src,
`  const [paletteOpenSignal, setPaletteOpenSignal] =
    useState(0);`,
`  const [paletteOpenSignal, setPaletteOpenSignal] =
    useState(0);
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
        'App Jingle enabled state',
      );
    }

    if (!src.includes('{jinglePortalEnabled ? (')) {
      const rx = /<JinglePortal\s+onNavigate=\{\(route\) => \{[\s\S]*?onOpenPalette=\{\(\) => \{[\s\S]*?\}\}\s*\/>/m;
      const match = src.match(rx);
      if (!match) throw new Error('App JinglePortal instance not found.');

      src = src.replace(
        match[0],
        `{jinglePortalEnabled ? (
        ${match[0]}
      ) : null}`,
      );
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ App live Jingle ON/OFF');
  }

  // -----------------------------------------------------------------------
  // Settings: Jingle toggle + accent-colored switches.
  // -----------------------------------------------------------------------
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

    if (!src.includes('const [jinglePortalEnabled')) {
      src = mustReplace(
        src,
`  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);
  const [soundPreferenceReady, setSoundPreferenceReady] = useState(false);`,
`  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true);
  const [soundPreferenceReady, setSoundPreferenceReady] = useState(false);
  const [jinglePortalEnabled, setJinglePortalEnabledState] = useState(true);
  const [jinglePreferenceReady, setJinglePreferenceReady] = useState(false);`,
        'ThemePicker Jingle state',
      );
    }

    if (!src.includes('getJinglePortalEnabled()')) {
      const soundEffectEnd = `  }, []);

  const changeSoundEffects = async (value: boolean) => {`;

      if (!src.includes(soundEffectEnd)) {
        throw new Error('ThemePicker sound preference effect anchor not found.');
      }

      src = src.replace(
        soundEffectEnd,
`  }, []);

  useEffect(() => {
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

  const changeSoundEffects = async (value: boolean) => {`,
      );
    }

    if (!src.includes('const changeJinglePortal')) {
      const marker = `  useEffect(() => {
    void getCloudSyncState()`;

      if (!src.includes(marker)) {
        throw new Error('ThemePicker cloud effect anchor not found.');
      }

      src = src.replace(
        marker,
`  const changeJinglePortal = async (value: boolean) => {
    const previous = jinglePortalEnabled;
    setJinglePortalEnabledState(value);

    try {
      await setJinglePortalEnabled(value);
    } catch {
      setJinglePortalEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

${marker}`,
      );
    }

    // Accent-color existing Sound Effects switch.
    src = src.replace(
`            <Switch
              accessibilityLabel="Sound effects"
              disabled={!soundPreferenceReady}
              onValueChange={(value) => void changeSoundEffects(value)}
              value={soundEffectsEnabled}
            />`,
`            <Switch
              accessibilityLabel="Sound effects"
              disabled={!soundPreferenceReady}
              ios_backgroundColor={colors.fillStrong}
              onValueChange={(value) => void changeSoundEffects(value)}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.fillStrong, true: accent }}
              value={soundEffectsEnabled}
            />`,
    );

    if (!src.includes('accessibilityLabel="Jingle button"')) {
      const soundSection = `        <View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Sound effects</Text>
              <Text style={styles.soundSettingHint}>
                Zvuk pri otvaranju appa, stvaranju, brisanju i Jingleu. Haptics i motion ostaju aktivni.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Sound effects"
              disabled={!soundPreferenceReady}
              ios_backgroundColor={colors.fillStrong}
              onValueChange={(value) => void changeSoundEffects(value)}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.fillStrong, true: accent }}
              value={soundEffectsEnabled}
            />
          </View>
        </View>`;

      if (!src.includes(soundSection)) {
        throw new Error('ThemePicker Sound Effects section not found after switch update.');
      }

      src = src.replace(
        soundSection,
`${soundSection}

        <View style={styles.section}>
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
        </View>`,
      );
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Settings Jingle toggle + accent switches');
  }

  // -----------------------------------------------------------------------
  // Jingle orb: bigger bell, Aero/Frutiger glass, accent-aware glass rim.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/components/JinglePortal.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = src.replace(
      `import { colors } from '../theme/colors';`,
      `import { activeAccentColor, colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';`,
    );

    if (!src.includes('const aeroMode = activeVisualSkinId')) {
      src = src.replace(
        `const destinations: Array<{`,
        `const aeroMode = activeVisualSkinId === 'aero';
const webGlassStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(18px) saturate(1.18)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.18)',
      } as any)
    : null;

const destinations: Array<{`,
      );
    }

    src = src.replace(
      `<View style={styles.halo} />`,
      `<View style={[styles.halo, aeroMode && styles.aeroHalo]} />`,
    );

    src = src.replace(
`          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}`,
`          style={({ pressed }) => [
            styles.button,
            aeroMode && styles.aeroButton,
            aeroMode && webGlassStyle,
            aeroMode && { borderColor: activeAccentColor },
            pressed && styles.buttonPressed,
          ]}`,
    );

    if (!src.includes('<View style={styles.glassHighlight} />')) {
      src = src.replace(
        `<Animated.View
            style={[
              styles.bellWrap,`,
        `{aeroMode ? <View style={styles.glassHighlight} /> : null}

          <Animated.View
            style={[
              styles.bellWrap,`,
      );
    }

    src = src.replace(
      `          <View style={styles.sheet}>`,
      `          <View
            style={[
              styles.sheet,
              aeroMode && styles.aeroSheet,
              aeroMode && webGlassStyle,
            ]}
          >`,
    );

    // Bigger, tighter orb and bell.
    src = src.replace(`    width: 84,\n    height: 84,\n    marginLeft: -42,`, `    width: 96,\n    height: 96,\n    marginLeft: -48,`);
    src = src.replace(`    width: 82,\n    height: 82,\n    borderRadius: 41,`, `    width: 94,\n    height: 94,\n    borderRadius: 47,`);
    src = src.replace(`    width: 70,\n    height: 70,\n    borderRadius: 35,`, `    width: 80,\n    height: 80,\n    borderRadius: 40,`);
    src = src.replace(`    width: 50,\n    height: 56,`, `    width: 66,\n    height: 70,`);
    src = src.replace(`    width: 48,\n    height: 54,`, `    width: 62,\n    height: 68,`);

    if (!src.includes('aeroButton: {')) {
      src = src.replace(
`  buttonPressed: {
    opacity: 0.9,
  },`,
`  aeroHalo: {
    backgroundColor: 'rgba(236, 251, 255, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.52)',
  },
  aeroButton: {
    backgroundColor: 'rgba(236, 250, 255, 0.52)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  aeroSheet: {
    backgroundColor: 'rgba(244, 252, 255, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#3A86B8',
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  buttonPressed: {
    opacity: 0.9,
  },`,
      );
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Bigger Jingle bell + Frutiger glass');
  }

  // -----------------------------------------------------------------------
  // Celestial atmosphere: fix RN-web over-constrained absoluteFill clipping.
  // -----------------------------------------------------------------------
  {
    const rel = 'src/components/CelestialAtmosphere.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = src.replace(
`  root: {
    ...StyleSheet.absoluteFillObject,
    height: 112,
    overflow: 'hidden',
    pointerEvents: 'none',
  },`,
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
    console.log('  ✓ Celestial layout clipping fix');
  }

  // -----------------------------------------------------------------------
  // Books: remove the now-redundant floating "Nova knjiga" FAB that collides
  // with the global Jingle orb. Keep top "Ručno dodaj".
  // -----------------------------------------------------------------------
  {
    const rel = 'src/screens/BookListScreen.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    const labelIndex = src.indexOf('accessibilityLabel="Dodaj novu knjigu"');

    if (labelIndex >= 0) {
      const start = src.lastIndexOf('<Pressable', labelIndex);
      const endStart = src.indexOf('</Pressable>', labelIndex);

      if (start < 0 || endStart < 0) {
        throw new Error('Could not safely isolate old Book FAB.');
      }

      const end = endStart + '</Pressable>'.length;
      const block = src.slice(start, end);

      if (!block.includes('styles.fab') || !block.includes('Nova knjiga')) {
        throw new Error('Book FAB safety check failed; refusing to remove unknown Pressable.');
      }

      src = src.slice(0, start) + src.slice(end);
      console.log('  ✓ removed redundant Books Nova knjiga FAB');
    } else {
      console.log('  • Books Nova knjiga FAB already absent');
    }

    // Give the final list item breathing room above the global orb.
    src = src.replace(
      /(list:\s*\{[\s\S]*?paddingBottom:\s*)34([,\s])/m,
      '$1120$2',
    );

    fs.writeFileSync(file, src, 'utf8');
  }

  console.log('\nChecking TypeScript against baseline...');
  const after = runTsc();

  if (after.status !== 0 && norm(after.text) !== norm(before.text)) {
    console.error('\nNEW TypeScript diagnostics detected — restoring entire patch.');
    console.error('\n--- TypeScript output ---\n');
    console.error(after.text);
    restore();
    process.exit(1);
  }

  console.log('\n✓ Jingle settings + glass/layout pass applied.');
  console.log('✓ Jingle button can be turned ON/OFF in Settings and updates live.');
  console.log('✓ Sound Effects and Jingle switches use the selected Accent color.');
  console.log('✓ Frutiger/Aero Jingle orb and panel use frosted-glass treatment.');
  console.log('✓ Bell is larger inside the orb.');
  console.log('✓ Celestial atmosphere no longer uses over-constrained absoluteFill layout.');
  console.log('✓ Redundant Books floating Nova knjiga button removed.');
  console.log('BACKUP: ' + recoveryRoot);

  if (after.status === 0) console.log('TYPESCRIPT CLEAN ✓');
  else console.log('No new TypeScript diagnostics; existing baseline unchanged.');
} catch (error) {
  restore();
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
