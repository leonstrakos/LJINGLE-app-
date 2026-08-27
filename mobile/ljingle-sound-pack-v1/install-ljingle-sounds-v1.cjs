const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const packRoot = __dirname;
const srcSounds = path.join(packRoot, 'sounds');
const destSounds = path.join(root, 'src', 'assets', 'ui-sounds');
const feedbackFile = path.join(root, 'src', 'audio', 'uiFeedback.ts');
const appFile = path.join(root, 'App.tsx');

if (!fs.existsSync(path.join(root, 'package.json')) ||
    !fs.existsSync(appFile)) {
  console.error('SAFE STOP: pokreni installer iz mobile foldera.');
  process.exit(1);
}

for (const name of [
  'app-open.mp3',
  'delete.mp3',
  'jingle.mp3',
  'create.mp3',
]) {
  if (!fs.existsSync(path.join(srcSounds, name))) {
    console.error(`SAFE STOP: nedostaje sound asset: ${name}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const out = `${file}.before-ui-sound-v2-${stamp}.bak`;
  fs.copyFileSync(file, out);
  backups.push([file, out]);
  return out;
}

backup(feedbackFile);
backup(appFile);

fs.mkdirSync(destSounds, { recursive: true });
for (const name of [
  'app-open.mp3',
  'delete.mp3',
  'jingle.mp3',
  'create.mp3',
]) {
  fs.copyFileSync(
    path.join(srcSounds, name),
    path.join(destSounds, name),
  );
}

const feedback = `import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

// uiFeedbackV2
// Central LJingle sound + haptic language.
// Sound mapping:
//   open   -> sound 1
//   delete -> sound 2
//   jingle -> sound 3
//   create -> sound 4

export type UiCue =
  | 'tap'
  | 'confirm'
  | 'start'
  | 'stop'
  | 'complete'
  | 'open'
  | 'jingle'
  | 'create'
  | 'delete';

let enabled = true;

const soundSources = {
  open: require('../assets/ui-sounds/app-open.mp3'),
  delete: require('../assets/ui-sounds/delete.mp3'),
  jingle: require('../assets/ui-sounds/jingle.mp3'),
  create: require('../assets/ui-sounds/create.mp3'),
} as const;

const soundPlayers = {
  open: createAudioPlayer(soundSources.open),
  delete: createAudioPlayer(soundSources.delete),
  jingle: createAudioPlayer(soundSources.jingle),
  create: createAudioPlayer(soundSources.create),
};

export function setUiFeedbackEnabled(value: boolean) {
  enabled = value;
}

export function isUiFeedbackEnabled() {
  return enabled;
}

async function nativeHaptic(cue: UiCue) {
  if (Platform.OS === 'web') return;

  switch (cue) {
    case 'tap':
    case 'open':
    case 'jingle':
      await Haptics.selectionAsync();
      return;

    case 'confirm':
    case 'start':
    case 'create':
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light,
      );
      return;

    case 'stop':
    case 'delete':
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium,
      );
      return;

    case 'complete':
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      return;
  }
}

async function playMappedSound(cue: UiCue) {
  if (
    cue !== 'open' &&
    cue !== 'delete' &&
    cue !== 'jingle' &&
    cue !== 'create'
  ) {
    return;
  }

  const player = soundPlayers[cue];

  try {
    await player.seekTo(0);
  } catch {
    // Fresh players can already be at zero.
  }

  player.play();
}

export async function playUiCue(cue: UiCue) {
  if (!enabled) return;

  try {
    await Promise.all([
      nativeHaptic(cue),
      playMappedSound(cue),
    ]);
  } catch {
    // UI feedback must never block or break the real action.
  }
}
`;

fs.mkdirSync(path.dirname(feedbackFile), { recursive: true });
fs.writeFileSync(feedbackFile, feedback, 'utf8');

let app = fs.readFileSync(appFile, 'utf8');

if (!app.includes("playUiCue('open')")) {
  if (!/\buseEffect\b/.test(app.split('\n')[0])) {
    app = app.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]react['"];/,
      (full, inside) => {
        const parts = inside.split(',').map(x => x.trim()).filter(Boolean);
        if (!parts.includes('useEffect')) parts.unshift('useEffect');
        return `import { ${parts.join(', ')} } from 'react';`;
      },
    );
  }

  if (!app.includes("from './src/audio/uiFeedback'")) {
    const marker = "import type { RootStackParamList } from './src/types/navigation';";
    if (!app.includes(marker)) {
      console.error('SAFE STOP: App import marker nije pronađen.');
      restoreAndExit(1);
    }
    app = app.replace(
      marker,
      `${marker}\nimport { playUiCue } from './src/audio/uiFeedback';`,
    );
  }

  const fnMarker = 'export default function App() {';
  if (!app.includes(fnMarker)) {
    console.error('SAFE STOP: App() marker nije pronađen.');
    restoreAndExit(1);
  }

  app = app.replace(
    fnMarker,
    `${fnMarker}
  // appOpeningSoundV1
  useEffect(() => {
    void playUiCue('open');
  }, []);
`,
  );
}

fs.writeFileSync(appFile, app, 'utf8');

function restoreAndExit(code) {
  for (const [original, copy] of backups.reverse()) {
    if (fs.existsSync(copy)) fs.copyFileSync(copy, original);
  }
  process.exit(code);
}

console.log('');
console.log('LJingle sound pack installed:');
console.log('  1 -> app opening');
console.log('  2 -> delete');
console.log('  3 -> jingle');
console.log('  4 -> create');
console.log('');
console.log('App opening sound is WIRED now.');
console.log('Create / Delete / Jingle cues are READY via playUiCue().');
console.log('');
console.log('Running TypeScript...');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const check = cp.spawnSync(cmd, ['tsc', '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (check.error || check.status !== 0) {
  if (check.error) {
    console.error('TypeScript runner error:', check.error.message);
  }

  console.error('');
  console.error('TypeScript failed — restoring App.tsx + uiFeedback.ts.');

  for (const [original, copy] of backups.reverse()) {
    if (fs.existsSync(copy)) fs.copyFileSync(copy, original);
  }

  process.exit(check.status || 1);
}

console.log('');
console.log('✓ TypeScript clean.');
console.log('✓ App opening sound active.');
console.log("✓ Use playUiCue('create') for create actions.");
console.log("✓ Use playUiCue('delete') for delete actions.");
console.log("✓ Use playUiCue('jingle') for the Jingle action.");
