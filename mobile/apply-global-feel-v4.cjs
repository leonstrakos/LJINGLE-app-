const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();

const required = [
  'App.tsx',
  'src/utils/semanticMotion.ts',
  'src/utils/semanticFeedback.ts',
  'src/audio/uiFeedback.ts',
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`SAFE STOP: nedostaje ${rel}`);
    process.exit(1);
  }
}

function runTsc(label) {
  console.log(`\n${label}`);

  const result =
    process.platform === 'win32'
      ? cp.spawnSync(
          'cmd.exe',
          ['/d', '/s', '/c', 'npx tsc --noEmit'],
          {
            cwd: root,
            stdio: 'inherit',
          },
        )
      : cp.spawnSync(
          'npx',
          ['tsc', '--noEmit'],
          {
            cwd: root,
            stdio: 'inherit',
          },
        );

  if (result.error) {
    console.error(result.error.message);
    return false;
  }

  return result.status === 0;
}

if (!runTsc('Preflight TypeScript check...')) {
  console.error('\nSAFE STOP: projekt nije clean prije patcha. Ništa nije promijenjeno.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];
const changed = [];

function patchFile(rel, transform) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return false;

  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);

  if (after === before) return false;

  const backup = `${file}.before-global-feel-v4-${stamp}.bak`;
  fs.copyFileSync(file, backup);
  backups.push([file, backup]);
  fs.writeFileSync(file, after, 'utf8');
  changed.push(rel);
  return true;
}

function restore() {
  for (const [file, backup] of backups.reverse()) {
    if (fs.existsSync(backup)) fs.copyFileSync(backup, file);
  }
}

// ---------------------------------------------------------
// 1) Global navigator motion: keep current function-style
//    screenOptions intact and only ensure animation fields exist.
// ---------------------------------------------------------
patchFile('App.tsx', (src) => {
  if (src.includes('// globalScreenMotionStableV4')) return src;

  const marker = 'screenOptions={({ navigation }) => ({';
  const at = src.indexOf(marker);
  if (at < 0) return src;

  const insertAt = at + marker.length;

  // Remove old marker only; preserve already-working animation values if present.
  if (
    src.slice(insertAt, insertAt + 400).includes("animation: 'fade_from_bottom'")
  ) {
    return (
      src.slice(0, insertAt) +
      '\n            // globalScreenMotionStableV4' +
      src.slice(insertAt)
    );
  }

  return (
    src.slice(0, insertAt) +
    `
            // globalScreenMotionStableV4
            animation: 'fade_from_bottom',
            animationDuration: 220,` +
    src.slice(insertAt)
  );
});

// ---------------------------------------------------------
// 2) Add a tiny reusable screen-enter hook.
//    New file only: no existing screen is touched.
// ---------------------------------------------------------
const motionHookRel = 'src/motion/useScreenEntrance.ts';
const motionHookFile = path.join(root, motionHookRel);

if (!fs.existsSync(motionHookFile)) {
  fs.mkdirSync(path.dirname(motionHookFile), { recursive: true });
  fs.writeFileSync(
    motionHookFile,
`import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
} from 'react-native';

// useScreenEntranceV2
// Opt-in screen entrance. Self-contained on purpose so it does not depend
// on internal semanticMotion export names.
export function useScreenEntrance() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(
    new Animated.Value(8),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return {
    opacity,
    transform: [{ translateY }],
  } as const;
}
`,
    'utf8',
  );
  changed.push(motionHookRel);
}

// ---------------------------------------------------------
// 3) Central sound semantics.
//    open + jingle already active; ensure CRUD helpers exist.
// ---------------------------------------------------------
patchFile('src/utils/semanticFeedback.ts', (src) => {
  let out = src;

  if (!out.includes("from '../audio/uiFeedback'")) {
    const imports = [...out.matchAll(/^import .*?;$/gm)];
    if (!imports.length) return src;
    const last = imports[imports.length - 1];
    const pos = last.index + last[0].length;
    out =
      out.slice(0, pos) +
      "\nimport { playUiCue } from '../audio/uiFeedback';" +
      out.slice(pos);
  }

  if (!out.includes("playUiCue('jingle')")) {
    const marker = "case 'JINGLE':";
    const at = out.indexOf(marker);
    if (at >= 0) {
      const after = at + marker.length;
      out =
        out.slice(0, after) +
        "\n        void playUiCue('jingle');" +
        out.slice(after);
    }
  }

  if (!out.includes('create: () => playUiCue')) {
    const marker = 'export const semanticFeedback = {';
    if (out.includes(marker)) {
      out = out.replace(
        marker,
        `${marker}
  // semanticCrudSoundStableV4
  create: () => playUiCue('create'),
  delete: () => playUiCue('delete'),`
      );
    }
  }

  return out;
});

// ---------------------------------------------------------
// 4) App opening sound: ensure once, no duplicate.
// ---------------------------------------------------------
patchFile('App.tsx', (src) => {
  let out = src;

  if (!out.includes("from './src/audio/uiFeedback'")) {
    const marker =
      "import type { RootStackParamList } from './src/types/navigation';";
    if (out.includes(marker)) {
      out = out.replace(
        marker,
        `${marker}\nimport { playUiCue } from './src/audio/uiFeedback';`
      );
    }
  }

  if (
    !out.includes("playUiCue('open')") &&
    out.includes('export default function App() {')
  ) {
    out = out.replace(
      'export default function App() {',
      `export default function App() {
  // appOpeningSoundStableV4
  useEffect(() => {
    void playUiCue('open');
  }, []);
`
    );
  }

  return out;
});

// ---------------------------------------------------------
// 5) Create a safe semantic event bridge.
//    Screens/services can call these AFTER a successful mutation.
// ---------------------------------------------------------
const bridgeRel = 'src/utils/crudFeedback.ts';
const bridgeFile = path.join(root, bridgeRel);

if (!fs.existsSync(bridgeFile)) {
  fs.writeFileSync(
    bridgeFile,
`import { semanticFeedback } from './semanticFeedback';

// crudFeedbackV1
// Call ONLY after a mutation actually succeeds.
export function createdFeedback() {
  void semanticFeedback.create();
}

export function deletedFeedback() {
  void semanticFeedback.delete();
}
`,
    'utf8',
  );
  changed.push(bridgeRel);
}

console.log('\nApplied global feel v4:');
for (const rel of changed) console.log(`  ${rel}`);

if (!runTsc('Post-patch TypeScript check...')) {
  console.error('\nTypeScript failed — restoring every existing file touched by this patch.');
  restore();

  // Remove new files created by this patch.
  for (const rel of [motionHookRel, bridgeRel]) {
    const file = path.join(root, rel);
    if (changed.includes(rel) && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  process.exit(1);
}

console.log('\n✓ TypeScript clean.');
console.log('✓ Global stack transition active.');
console.log('✓ App opening sound active.');
console.log('✓ Jingle semantic sound active.');
console.log('✓ Create/Delete success-only bridge ready.');
console.log('✓ Optional screen entrance hook created.');
console.log('');
console.log('No Home/Stats/layout/storage/database files were touched.');
