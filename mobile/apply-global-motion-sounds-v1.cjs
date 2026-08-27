  const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const required = [
  'App.tsx',
  'src/audio/uiFeedback.ts',
  'src/utils/semanticFeedback.ts',
  'src/components/PrimaryButton.tsx',
  'src/components/AnimatedPressable.tsx',
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`SAFE STOP: nedostaje ${rel}`);
    console.error('Pokreni iz mobile foldera i prvo instaliraj motion/sound module.');
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const changed = [];
const backups = [];

function write(rel, text) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  if (before === text) return;
  const backup = `${file}.before-global-motion-sound-${stamp}.bak`;
  fs.copyFileSync(file, backup);
  backups.push([file, backup]);
  fs.writeFileSync(file, text, 'utf8');
  changed.push(rel);
}

function restore() {
  for (const [file, backup] of backups.reverse()) {
    if (fs.existsSync(backup)) fs.copyFileSync(backup, file);
  }
}

//
// 1) GLOBAL NATIVE SCREEN MOTION
//
{
  const rel = 'App.tsx';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  if (!s.includes('// globalScreenMotionV1')) {
    const screenOptionsRegex = /screenOptions=\{\{([\s\S]*?)\}\}/m;
    const m = s.match(screenOptionsRegex);

    if (m) {
      const inner = m[1];
      const addition = `
          // globalScreenMotionV1
          animation: 'fade_from_bottom',
          animationDuration: 220,`;

      s = s.replace(
        screenOptionsRegex,
        `screenOptions={{${inner}${addition}
        }}`
      );
    } else {
      const marker = '<Stack.Navigator';
      const at = s.indexOf(marker);
      if (at < 0) {
        console.error('SAFE STOP: Stack.Navigator nije pronađen.');
        process.exit(1);
      }

      const close = s.indexOf('>', at);
      if (close < 0) {
        console.error('SAFE STOP: Stack.Navigator opening tag nije čitljiv.');
        process.exit(1);
      }

      s =
        s.slice(0, close) +
        `
          screenOptions={{
            // globalScreenMotionV1
            animation: 'fade_from_bottom',
            animationDuration: 220,
          }}` +
        s.slice(close);
    }
  }

  write(rel, s);
}

//
// 2) JINGLE SOUND THROUGH EXISTING SEMANTIC FEEDBACK
// Every existing semanticFeedback.jingle() call now gets sound 3 automatically.
//
{
  const rel = 'src/utils/semanticFeedback.ts';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  if (!s.includes("from '../audio/uiFeedback'")) {
    const imports = [...s.matchAll(/^import .*?;$/gm)];
    if (!imports.length) {
      console.error('SAFE STOP: semanticFeedback imports nisu pronađeni.');
      restore();
      process.exit(1);
    }
    const last = imports[imports.length - 1];
    const pos = last.index + last[0].length;
    s =
      s.slice(0, pos) +
      "\nimport { playUiCue } from '../audio/uiFeedback';" +
      s.slice(pos);
  }

  if (!s.includes('// semanticJingleSoundV1')) {
    const needle = "case 'JINGLE':";
    const idx = s.indexOf(needle);
    if (idx < 0) {
      console.error("SAFE STOP: semanticFeedback JINGLE case nije pronađen.");
      restore();
      process.exit(1);
    }

    const after = idx + needle.length;
    s =
      s.slice(0, after) +
      "\n        // semanticJingleSoundV1\n        void playUiCue('jingle');" +
      s.slice(after);
  }

  write(rel, s);
}

//
// 3) PRIMARY BUTTON PHYSICAL MOTION
// This hits the main CTA component rather than mass-editing screens.
//
{
  const rel = 'src/components/PrimaryButton.tsx';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  if (!s.includes('// primaryButtonPhysicalMotionV1')) {
    if (!s.includes("from './AnimatedPressable'")) {
      const imports = [...s.matchAll(/^import .*?;$/gm)];
      if (!imports.length) {
        console.error('SAFE STOP: PrimaryButton imports nisu pronađeni.');
        restore();
        process.exit(1);
      }
      const last = imports[imports.length - 1];
      const pos = last.index + last[0].length;
      s =
        s.slice(0, pos) +
        "\nimport { AnimatedPressable } from './AnimatedPressable';" +
        s.slice(pos);
    }

    // Remove Pressable from react-native named imports only if present;
    // leaving it imported would merely be an unused import, but this keeps it clean.
    s = s.replace(/\bPressable,\s*/g, '');

    const open = s.indexOf('<Pressable');
    const close = s.indexOf('</Pressable>');

    if (open < 0 || close < 0) {
      console.error('SAFE STOP: PrimaryButton Pressable markup nije pronađen.');
      restore();
      process.exit(1);
    }

    s =
      s.slice(0, open) +
      "{/* primaryButtonPhysicalMotionV1 */}\n      <AnimatedPressable" +
      s.slice(open + '<Pressable'.length, close) +
      '</AnimatedPressable>' +
      s.slice(close + '</Pressable>'.length);
  }

  write(rel, s);
}

//
// 4) APP OPEN SOUND
//
{
  const rel = 'App.tsx';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  if (!s.includes("playUiCue('open')")) {
    if (!s.includes("from './src/audio/uiFeedback'")) {
      const marker = "import type { RootStackParamList } from './src/types/navigation';";
      if (!s.includes(marker)) {
        console.error('SAFE STOP: App import marker nije pronađen.');
        restore();
        process.exit(1);
      }
      s = s.replace(
        marker,
        `${marker}\nimport { playUiCue } from './src/audio/uiFeedback';`
      );
    }

    const appMarker = 'export default function App() {';
    if (!s.includes(appMarker)) {
      console.error('SAFE STOP: App function nije pronađen.');
      restore();
      process.exit(1);
    }

    s = s.replace(
      appMarker,
      `${appMarker}
  // appOpeningSoundV1
  useEffect(() => {
    void playUiCue('open');
  }, []);
`
    );
  }

  write(rel, s);
}

//
// 5) CREATE / DELETE SOUND HELPERS
// We add semantic helpers now; integration into successful domain mutations can
// be done progressively without teaching every screen about audio internals.
//
{
  const rel = 'src/utils/semanticFeedback.ts';
  let s = fs.readFileSync(path.join(root, rel), 'utf8');

  if (!s.includes('create: () =>')) {
    const marker = 'export const semanticFeedback = {';
    if (s.includes(marker)) {
      s = s.replace(
        marker,
        `${marker}
  // semanticCrudSoundV1
  create: () => playUiCue('create'),
  delete: () => playUiCue('delete'),`
      );
    }
  }

  write(rel, s);
}

console.log('');
console.log('Global motion/sound patch written:');
for (const rel of changed) console.log(`  ${rel}`);
console.log('');
console.log('What is live now:');
console.log('  ✓ global native screen transition');
console.log('  ✓ PrimaryButton physical press motion');
console.log('  ✓ existing Jingle semantic events -> sound 3');
console.log('  ✓ app opening -> sound 1');
console.log('  ✓ semanticFeedback.create/delete helpers ready');
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
  console.error('TypeScript failed — restoring every file touched by this patch.');
  restore();
  process.exit(check.status || 1);
}

console.log('');
console.log('✓ TypeScript clean.');
console.log('✓ Global motion + opening/Jingle sound integration active.');
console.log('');
console.log('NOTE: create/delete sounds are exposed centrally but are NOT fired');
console.log('on generic button press. That is intentional: they should fire only');
console.log('after a successful create/delete mutation, not after a failed save.');
