const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(
  root,
  '..',
  '_recovery',
  `jingle-bell-background-motion-${stamp}`,
);
fs.mkdirSync(backupRoot, { recursive: true });

const targets = [
  'src/components/JinglePortal.tsx',
  'src/screens/ThemePickerScreen.tsx',
];

for (const rel of targets) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error('SAFE STOP: missing ' + rel);
    process.exit(1);
  }
}

const created = ['src/services/jinglePortalStylePreference.ts'];

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

function backup(rel, backups) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;

  const dst = path.join(backupRoot, rel);
  ensureDir(dst);
  fs.copyFileSync(src, dst);
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

  if (lastEnd < 0) throw new Error('Could not safely locate import block.');

  return src.slice(0, lastEnd) + '\n' + line + src.slice(lastEnd);
}

function styleBlock(src, name, mutate) {
  const token = `  ${name}: {`;
  const start = src.indexOf(token);
  if (start < 0) throw new Error('style block not found: ' + name);

  const end = src.indexOf('\n  },', start);
  if (end < 0) throw new Error('style block end not found: ' + name);

  const blockEnd = end + '\n  },'.length;
  const block = src.slice(start, blockEnd);

  return src.slice(0, start) + mutate(block) + src.slice(blockEnd);
}

const backups = new Map();
for (const rel of targets) backup(rel, backups);
for (const rel of created) backup(rel, backups);

function restore() {
  for (const [rel, source] of backups) {
    fs.copyFileSync(source, path.join(root, rel));
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
  // ---------------------------------------------------------------------
  // Persistent "background behind the floating bell" preference.
  // Default OFF: cleaner bell-only presentation.
  // ---------------------------------------------------------------------
  {
    const rel = 'src/services/jinglePortalStylePreference.ts';
    const file = path.join(root, rel);
    ensureDir(file);

    fs.writeFileSync(
      file,
`import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_KEY = 'ljingle_jingle_background_enabled';
const FILE_NAME = 'ljingle-jingle-style-preference.json';

let cachedBackground: boolean | null = null;
const listeners = new Set<(enabled: boolean) => void>();

export async function getJingleBackgroundEnabled(): Promise<boolean> {
  if (cachedBackground !== null) return cachedBackground;

  try {
    if (Platform.OS === 'web') {
      const raw = (globalThis as any).localStorage?.getItem(WEB_KEY);
      cachedBackground = raw === null || raw === undefined ? false : raw === 'true';
      return cachedBackground;
    }

    const file = new File(Paths.document, FILE_NAME);
    const raw = await file.text();
    const parsed = JSON.parse(raw) as { backgroundEnabled?: unknown };
    cachedBackground = parsed.backgroundEnabled === true;
    return cachedBackground;
  } catch {
    cachedBackground = false;
    return false;
  }
}

export async function setJingleBackgroundEnabled(
  enabled: boolean,
): Promise<void> {
  cachedBackground = enabled;

  if (Platform.OS === 'web') {
    (globalThis as any).localStorage?.setItem(WEB_KEY, String(enabled));
  } else {
    const file = new File(Paths.document, FILE_NAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify({ backgroundEnabled: enabled }));
  }

  listeners.forEach((listener) => listener(enabled));
}

export function subscribeJingleBackgroundEnabled(
  listener: (enabled: boolean) => void,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
`,
      'utf8',
    );

    console.log('  ✓ persistent Jingle background preference');
  }

  // ---------------------------------------------------------------------
  // JinglePortal:
  // - background can disappear completely
  // - bell gets larger when naked
  // - stronger ring shake
  // - semanticFeedback gives sound + haptic while respecting sound setting
  // ---------------------------------------------------------------------
  {
    const rel = 'src/components/JinglePortal.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    src = src.replace(
      `import { useRef, useState } from 'react';`,
      `import { useEffect, useRef, useState } from 'react';`,
    );

    src = insertImport(
      src,
      `import { semanticFeedback } from '../utils/semanticFeedback';`,
    );

    src = insertImport(
      src,
      `import {
  getJingleBackgroundEnabled,
  subscribeJingleBackgroundEnabled,
} from '../services/jinglePortalStylePreference';`,
    );

    // Remove old direct sound call if present.
    src = src.replace(
      `import { playUiCue } from '../audio/uiFeedback';\n`,
      '',
    );

    if (!src.includes('const [bellBackgroundEnabled')) {
      const panelState = /const\s*\[\s*panelVisible\s*,\s*setPanelVisible\s*\]\s*=\s*useState\(false\);/m;
      const match = src.match(panelState);

      if (!match) throw new Error('Jingle panelVisible state not found.');

      src = src.replace(
        match[0],
`${match[0]}
  const [bellBackgroundEnabled, setBellBackgroundEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    void getJingleBackgroundEnabled().then((enabled) => {
      if (active) setBellBackgroundEnabled(enabled);
    });

    const unsubscribe = subscribeJingleBackgroundEnabled((enabled) => {
      if (active) setBellBackgroundEnabled(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);`,
      );
    }

    // Stronger visible shake.
    src = src.replace(
`        Animated.timing(ring, {
          toValue: -1,
          duration: 65,`,
`        Animated.timing(ring, {
          toValue: -1,
          duration: 48,`,
    );
    src = src.replace(
`        Animated.timing(ring, {
          toValue: 1,
          duration: 85,`,
`        Animated.timing(ring, {
          toValue: 1,
          duration: 62,`,
    );
    src = src.replace(
`        Animated.timing(ring, {
          toValue: -0.45,
          duration: 75,`,
`        Animated.timing(ring, {
          toValue: -0.72,
          duration: 58,`,
    );

    if (!src.includes('toValue: 0.46')) {
      const springNeedle =
`        Animated.spring(ring, {
          toValue: 0,`;

      if (!src.includes(springNeedle)) {
        throw new Error('Jingle ring spring anchor not found.');
      }

      src = src.replace(
        springNeedle,
`        Animated.timing(ring, {
          toValue: 0.46,
          duration: 50,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ring, {
          toValue: 0,`,
      );
    }

    src = src.replace(
`  const ringBell = () => {
    animateBell();
    void playUiCue('jingle');
  };`,
`  const ringBell = () => {
    animateBell();
    // semanticFeedback keeps haptics active even when Sound Effects are off.
    void semanticFeedback.jingle(true);
  };`,
    );

    // Larger rotation angle.
    src = src.replace(
`    outputRange: ['-11deg', '0deg', '11deg'],`,
`    outputRange: ['-15deg', '0deg', '15deg'],`,
    );

    // Background/halo completely disappears when preference is OFF.
    src = src.replace(
      `<View style={[styles.halo, aeroMode && styles.aeroHalo]} />`,
      `{bellBackgroundEnabled ? (
        <View style={[styles.halo, aeroMode && styles.aeroHalo]} />
      ) : null}`,
    );

    const buttonStyleOld =
`            styles.button,
            aeroMode && styles.aeroButton,
            aeroMode && webGlassStyle,
            aeroMode && { borderColor: activeAccentColor },
            pressed && styles.buttonPressed,`;

    const buttonStyleNew =
`            styles.button,
            bellBackgroundEnabled && aeroMode && styles.aeroButton,
            bellBackgroundEnabled && aeroMode && webGlassStyle,
            bellBackgroundEnabled && aeroMode && { borderColor: activeAccentColor },
            !bellBackgroundEnabled && styles.buttonNaked,
            pressed && styles.buttonPressed,`;

    if (src.includes(buttonStyleOld)) {
      src = src.replace(buttonStyleOld, buttonStyleNew);
    } else if (!src.includes('!bellBackgroundEnabled && styles.buttonNaked')) {
      throw new Error('Jingle button style array anchor not found.');
    }

    src = src.replace(
      `{aeroMode ? <View style={styles.glassHighlight} /> : null}`,
      `{aeroMode && bellBackgroundEnabled ? (
            <View style={styles.glassHighlight} />
          ) : null}`,
    );

    // Naked bell gets an additional scale multiplier.
    const transformNeedle = `transform: [{ rotate }, { scale }],`;
    if (src.includes(transformNeedle)) {
      src = src.replace(
        transformNeedle,
        `transform: [
                  { rotate },
                  { scale },
                  { scale: bellBackgroundEnabled ? 1 : 1.24 },
                ],`,
      );
    }

    if (!src.includes('  buttonNaked: {')) {
      const pressedMarker = '  buttonPressed: {';
      const idx = src.indexOf(pressedMarker);

      if (idx < 0) throw new Error('Jingle buttonPressed style not found.');

      src =
        src.slice(0, idx) +
`  buttonNaked: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
` +
        src.slice(idx);
    }

    // Hit target stays comfortable, visible circle stays small.
    src = styleBlock(src, 'button', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 54,')
        .replace(/height:\s*\d+,/, 'height: 54,')
        .replace(/borderRadius:\s*\d+,/, 'borderRadius: 27,'),
    );

    src = styleBlock(src, 'halo', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 62,')
        .replace(/height:\s*\d+,/, 'height: 62,')
        .replace(/borderRadius:\s*\d+,/, 'borderRadius: 31,'),
    );

    src = styleBlock(src, 'bellWrap', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 58,')
        .replace(/height:\s*\d+,/, 'height: 60,'),
    );

    src = styleBlock(src, 'bell', (block) =>
      block
        .replace(/width:\s*\d+,/, 'width: 56,')
        .replace(/height:\s*\d+,/, 'height: 60,'),
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ naked/background bell modes');
    console.log('  ✓ stronger shake + semantic haptic/audio feedback');
  }

  // ---------------------------------------------------------------------
  // Settings:
  // add Jingle Background toggle immediately after Jingle Button.
  // Reuse existing AccentToggle from the previous stabilization pass.
  // ---------------------------------------------------------------------
  {
    const rel = 'src/screens/ThemePickerScreen.tsx';
    const file = path.join(root, rel);
    let src = fs.readFileSync(file, 'utf8');

    if (!src.includes('function AccentToggle(')) {
      throw new Error(
        'AccentToggle not found. Run the previous hard-fix toggle patch first.',
      );
    }

    src = insertImport(
      src,
      `import {
  getJingleBackgroundEnabled,
  setJingleBackgroundEnabled,
} from '../services/jinglePortalStylePreference';`,
    );

    if (!src.includes('jingleBackgroundEnabled, setJingleBackgroundEnabledState')) {
      const jingleReadyRx =
        /const\s*\[\s*jinglePreferenceReady\s*,\s*setJinglePreferenceReady\s*\]\s*=\s*useState\(false\);/m;
      const match = src.match(jingleReadyRx);

      if (!match) throw new Error('jinglePreferenceReady state not found.');

      src = src.replace(
        match[0],
`${match[0]}
  const [jingleBackgroundEnabled, setJingleBackgroundEnabledState] =
    useState(false);
  const [jingleBackgroundReady, setJingleBackgroundReady] = useState(false);`,
      );
    }

    if (!src.includes('void getJingleBackgroundEnabled()')) {
      const changeJingleIndex = src.indexOf('const changeJinglePortal');

      if (changeJingleIndex < 0) {
        throw new Error('changeJinglePortal handler not found.');
      }

      src =
        src.slice(0, changeJingleIndex) +
`useEffect(() => {
    let active = true;

    void getJingleBackgroundEnabled()
      .then((enabled) => {
        if (active) setJingleBackgroundEnabledState(enabled);
      })
      .finally(() => {
        if (active) setJingleBackgroundReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  ` +
        src.slice(changeJingleIndex);
    }

    if (!src.includes('const changeJingleBackground')) {
      const colorEffectMarker = 'const changeJinglePortal';
      const index = src.indexOf(colorEffectMarker);

      if (index < 0) throw new Error('changeJinglePortal handler anchor missing.');

      // Insert after the existing changeJinglePortal function.
      const functionStart = index;
      const nextUseEffect = src.indexOf('useEffect(() => {', functionStart);

      if (nextUseEffect < 0) {
        throw new Error('Could not locate insertion point after changeJinglePortal.');
      }

      src =
        src.slice(0, nextUseEffect) +
`const changeJingleBackground = async (value: boolean) => {
    const previous = jingleBackgroundEnabled;
    setJingleBackgroundEnabledState(value);

    try {
      await setJingleBackgroundEnabled(value);
    } catch {
      setJingleBackgroundEnabledState(previous);
      Alert.alert('Postavka nije spremljena', 'Pokušaj ponovno.');
    }
  };

  ` +
        src.slice(nextUseEffect);
    }

    if (!src.includes('label="Jingle background"')) {
      const marker = `label="Jingle button"`;
      const labelIndex = src.indexOf(marker);

      if (labelIndex < 0) throw new Error('Jingle button AccentToggle not found.');

      // Find enclosing Settings section.
      const sectionStart = src.lastIndexOf(
        '<View style={styles.section}>',
        labelIndex,
      );

      if (sectionStart < 0) throw new Error('Jingle button section start not found.');

      // Find section's matching simple close. This section structure is:
      // section > soundSettingRow > copy + toggle.
      const sectionEndMarker = `        </View>`;
      const firstClose = src.indexOf(sectionEndMarker, labelIndex);
      const secondClose = src.indexOf(sectionEndMarker, firstClose + sectionEndMarker.length);

      if (firstClose < 0 || secondClose < 0) {
        throw new Error('Could not locate Jingle button section end.');
      }

      const insertAt = secondClose + sectionEndMarker.length;

      const section = `

        <View style={styles.section}>
          <View style={styles.soundSettingRow}>
            <View style={styles.soundSettingCopy}>
              <Text style={styles.sectionLabel}>Jingle background</Text>
              <Text style={styles.soundSettingHint}>
                Podloga iza plutajućeg zvona. Isključi za čisto lebdeće zvono bez plavog ili glass kruga.
              </Text>
            </View>
            <AccentToggle
              label="Jingle background"
              disabled={!jingleBackgroundReady}
              accent={accent}
              onChange={(value) => void changeJingleBackground(value)}
              value={jingleBackgroundEnabled}
            />
          </View>
        </View>`;

      src = src.slice(0, insertAt) + section + src.slice(insertAt);
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('  ✓ Jingle background Settings toggle');
  }

  console.log('\nChecking TypeScript...');
  const after = runTsc();
  const added = newDiagnostics(before.text, after.text);

  if (added.length > 0) {
    console.error('\nNEW TypeScript diagnostics — restoring this patch.');
    console.error(added.join('\n'));
    restore();
    process.exit(1);
  }

  console.log('\n✓ Jingle bell cleanup applied.');
  console.log('✓ New persistent Jingle background setting (default OFF).');
  console.log('✓ OFF = no blue/glass fill, no halo, just the floating bell.');
  console.log('✓ Bell is larger in naked mode while hit target stays usable.');
  console.log('✓ Click/press gives stronger shake + semantic haptic + Jingle sound.');
  console.log('✓ Sound Effects OFF still leaves haptic feedback active.');
  console.log('BACKUP: ' + backupRoot);

  if (after.status === 0) console.log('TYPESCRIPT CLEAN ✓');
  else console.log('No new TypeScript diagnostics; existing baseline unchanged.');
} catch (error) {
  restore();
  console.error('\nSAFE STOP: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
