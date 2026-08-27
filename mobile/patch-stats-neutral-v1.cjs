const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const file = path.join(root, 'src', 'screens', 'StatsScreen.tsx');

if (!fs.existsSync(file)) {
  console.error('SAFE STOP: src/screens/StatsScreen.tsx nije pronađen.');
  console.error('Pokreni ovo iz mobile foldera.');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');

if (src.includes('// statsNeutralSurfaceV1')) {
  console.log('statsNeutralSurfaceV1 je već primijenjen. Ništa ne diram.');
  process.exit(0);
}

const oldLine = "const aeroMode = activeVisualSkinId === 'aero';";
if (!src.includes(oldLine)) {
  console.error('SAFE STOP: očekivani aeroMode red nije pronađen.');
  console.error('Ništa nije promijenjeno.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${file}.before-stats-neutral-${stamp}.bak`;
fs.copyFileSync(file, backup);

src = src.replace(
  oldLine,
  "// statsNeutralSurfaceV1 — Stats stays visually neutral across Aero/Meadow\nconst aeroMode = false;"
);

fs.writeFileSync(file, src, 'utf8');

console.log('Stats neutral patch applied.');
console.log('  Meadow/Aero glass styling on Stats: OFF');
console.log('  Accent/text/progress data styling: unchanged');
console.log('  Home/Today screen: untouched');
console.log(`  Backup: ${path.basename(backup)}`);
console.log('');
console.log('Running TypeScript check...');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = cp.spawnSync(cmd, ['tsc', '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error || result.status !== 0) {
  if (result.error) console.error(result.error.message);
  console.error('TypeScript nije prošao — vraćam StatsScreen backup.');
  fs.copyFileSync(backup, file);
  process.exit(result.status || 1);
}

console.log('');
console.log('✓ TypeScript clean.');
console.log('✓ Stats više ne koristi Aero/Meadow surface theme.');
console.log('Refreshaj app i otvori Statistiku.');
