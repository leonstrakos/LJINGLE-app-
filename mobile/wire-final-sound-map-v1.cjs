const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();

const feedbackFile = path.join(root, 'src', 'audio', 'uiFeedback.ts');
const semanticFile = path.join(root, 'src', 'utils', 'semanticFeedback.ts');
const appFile = path.join(root, 'App.tsx');
const soundDir = path.join(root, 'src', 'assets', 'ui-sounds');

const requiredSounds = [
  'app-open.mp3',
  'delete.mp3',
  'jingle.mp3',
  'create.mp3',
];

for (const file of [feedbackFile, semanticFile, appFile]) {
  if (!fs.existsSync(file)) {
    console.error(`SAFE STOP: nedostaje ${path.relative(root, file)}`);
    process.exit(1);
  }
}

for (const name of requiredSounds) {
  if (!fs.existsSync(path.join(soundDir, name))) {
    console.error(`SAFE STOP: nedostaje src/assets/ui-sounds/${name}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];

function backup(file) {
  const copy = `${file}.before-final-sound-map-${stamp}.bak`;
  fs.copyFileSync(file, copy);
  backups.push([file, copy]);
}

function restore() {
  for (const [file, copy] of backups.reverse()) {
    if (fs.existsSync(copy)) fs.copyFileSync(copy, file);
  }
}

backup(feedbackFile);
backup(semanticFile);
backup(appFile);

// ------------------------------------------------------------
// 1) FINAL semantic filename -> actual audio mapping
// ------------------------------------------------------------
const feedback = `import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

// uiFeedbackFinalV1
// Filenames are now the source of truth:
// app-open.mp3 = app opening
// delete.mp3   = successful delete
// jingle.mp3   = Jingle toggle/event
// create.mp3   = successful create

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

const players = {
  open: createAudioPlayer(
    require('../assets/ui-sounds/app-open.mp3'),
  ),
  delete: createAudioPlayer(
    require('../assets/ui-sounds/delete.mp3'),
  ),
  jingle: createAudioPlayer(
    require('../assets/ui-sounds/jingle.mp3'),
  ),
  create: createAudioPlayer(
    require('../assets/ui-sounds/create.mp3'),
  ),
};

export function setUiFeedbackEnabled(value: boolean) {
  enabled = value;
}

export function isUiFeedbackEnabled() {
  return enabled;
}

async function haptic(cue: UiCue) {
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

async function sound(cue: UiCue) {
  if (
    cue !== 'open' &&
    cue !== 'delete' &&
    cue !== 'jingle' &&
    cue !== 'create'
  ) {
    return;
  }

  const player = players[cue];

  try {
    await player.seekTo(0);
  } catch {
    // Already at the beginning is fine.
  }

  player.play();
}

export async function playUiCue(cue: UiCue) {
  if (!enabled) return;

  try {
    await Promise.all([
      haptic(cue),
      sound(cue),
    ]);
  } catch {
    // Feedback must never block the actual app action.
  }
}
`;

fs.writeFileSync(feedbackFile, feedback, 'utf8');

// ------------------------------------------------------------
// 2) Existing semantic Jingle events -> jingle sound
//    + expose create/delete semantics centrally
// ------------------------------------------------------------
let semantic = fs.readFileSync(semanticFile, 'utf8');

if (!semantic.includes("from '../audio/uiFeedback'")) {
  const imports = [...semantic.matchAll(/^import .*?;$/gm)];
  if (!imports.length) {
    console.error('SAFE STOP: semanticFeedback imports nisu pronađeni.');
    restore();
    process.exit(1);
  }

  const last = imports[imports.length - 1];
  const pos = last.index + last[0].length;

  semantic =
    semantic.slice(0, pos) +
    "\nimport { playUiCue } from '../audio/uiFeedback';" +
    semantic.slice(pos);
}

if (!semantic.includes("playUiCue('jingle')")) {
  const marker = "case 'JINGLE':";
  const at = semantic.indexOf(marker);

  if (at < 0) {
    console.error("SAFE STOP: semantic JINGLE case nije pronađen.");
    restore();
    process.exit(1);
  }

  const after = at + marker.length;
  semantic =
    semantic.slice(0, after) +
    "\n        // semanticJingleSoundFinalV1\n        void playUiCue('jingle');" +
    semantic.slice(after);
}

const exportMarker = 'export const semanticFeedback = {';

if (!semantic.includes('create: () => playUiCue')) {
  if (!semantic.includes(exportMarker)) {
    console.error('SAFE STOP: semanticFeedback export nije pronađen.');
    restore();
    process.exit(1);
  }

  semantic = semantic.replace(
    exportMarker,
    `${exportMarker}
  // semanticCrudSoundFinalV1
  create: () => playUiCue('create'),
  delete: () => playUiCue('delete'),`,
  );
}

fs.writeFileSync(semanticFile, semantic, 'utf8');

// ------------------------------------------------------------
// 3) App opening -> sound 1 / app-open.mp3
// ------------------------------------------------------------
let app = fs.readFileSync(appFile, 'utf8');

if (!app.includes("from './src/audio/uiFeedback'")) {
  const marker =
    "import type { RootStackParamList } from './src/types/navigation';";

  if (!app.includes(marker)) {
    console.error('SAFE STOP: App import marker nije pronađen.');
    restore();
    process.exit(1);
  }

  app = app.replace(
    marker,
    `${marker}
import { playUiCue } from './src/audio/uiFeedback';`,
  );
}

if (!app.includes("playUiCue('open')")) {
  const appMarker = 'export default function App() {';

  if (!app.includes(appMarker)) {
    console.error('SAFE STOP: App() nije pronađen.');
    restore();
    process.exit(1);
  }

  app = app.replace(
    appMarker,
    `${appMarker}
  // appOpeningSoundFinalV1
  useEffect(() => {
    void playUiCue('open');
  }, []);
`,
  );
}

fs.writeFileSync(appFile, app, 'utf8');

console.log('');
console.log('Final sound mapping wired:');
console.log('  app-open.mp3 -> app opening');
console.log('  jingle.mp3   -> existing semantic Jingle events');
console.log('  create.mp3   -> semanticFeedback.create()');
console.log('  delete.mp3   -> semanticFeedback.delete()');
console.log('');
console.log('Running TypeScript...');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const check = cp.spawnSync(cmd, ['tsc', '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (check.error || check.status !== 0) {
  if (check.error) console.error(check.error.message);

  console.error('');
  console.error('TypeScript failed — restoring all 3 touched files.');
  restore();
  process.exit(check.status || 1);
}

console.log('');
console.log('✓ TypeScript clean.');
console.log('✓ App opening sound active.');
console.log('✓ Jingle sound active anywhere semanticFeedback.jingle() already exists.');
console.log('✓ Create/Delete sound helpers ready for success-only wiring.');
