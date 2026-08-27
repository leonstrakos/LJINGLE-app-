const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, '_palette-sound-settings-audit.txt');

const candidates = [
  'src/screens/ThemePickerScreen.tsx',
  'src/screens/SettingsScreen.tsx',
  'src/components/CommandPalette.tsx',
  'src/screens/CommandPaletteScreen.tsx',
  'src/components/Palette.tsx',
  'src/audio/uiFeedback.ts',
  'src/utils/semanticFeedback.ts',
  'src/services/entryApi.ts',
  'src/types/entry.ts',
];

let text = 'LJINGLE — Palette direct :note + sound settings audit\n';
text += '====================================================\n\n';

for (const rel of candidates) {
  const file = path.join(root, rel);
  text += `### ${rel}\n\n`;

  if (!fs.existsSync(file)) {
    text += 'MISSING\n\n';
    continue;
  }

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const needles = [
    /palette|command/i,
    /query|input|TextInput/i,
    /entryApi|create\(/,
    /note|zapis/i,
    /sound|audio|playUi/i,
    /AsyncStorage|settings|preference/i,
  ];

  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!needles.some((rx) => rx.test(lines[i]))) continue;
    ranges.push([Math.max(0, i - 14), Math.min(lines.length - 1, i + 28)]);
  }

  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1] + 3) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }

  for (const [start, end] of merged.slice(0, 20)) {
    text += `-- lines ${start + 1}-${end + 1} --\n`;
    for (let i = start; i <= end; i++) {
      text += `${String(i + 1).padStart(4)} | ${lines[i]}\n`;
    }
    text += '\n';
  }
}

// Also discover likely files by filename.
text += '\n### filename discovery\n\n';
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(ent.name)) continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

for (const full of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, full).replace(/\\/g, '/');
  if (/palette|command|settings|theme|feedback|audio/i.test(rel)) {
    text += rel + '\n';
  }
}

fs.writeFileSync(out, text, 'utf8');
console.log('Saved: _palette-sound-settings-audit.txt');
console.log('Read-only audit. Nothing changed.');
