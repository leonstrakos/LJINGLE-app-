const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const targets = [
  path.join(SRC, 'services', 'portableExport.ts'),
  path.join(SRC, 'screens', 'EntryFormScreen.tsx'),
  path.join(SRC, 'screens', 'MemoryRadioScreen.tsx'),
  path.join(SRC, 'screens', 'CollectionDetailsScreen.tsx'),
  path.join(SRC, 'screens', 'ThemePickerScreen.tsx'),
  path.join(SRC, 'components', 'BridgePanel.tsx'),
];

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    : null;
}

function around(text, needle, before = 18, after = 60) {
  const lines = text.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) {
      const start = Math.max(0, i - before);
      const end = Math.min(lines.length - 1, i + after);
      hits.push(
        lines
          .slice(start, end + 1)
          .map((line, j) => {
            const n = start + j + 1;
            return `${String(n).padStart(5)} | ${line}`;
          })
          .join('\n'),
      );
    }
  }

  return hits;
}

let out = '';
out += 'LJINGLE — SHARE PIPELINE CURRENT-SOURCE AUDIT\n';
out += '============================================\n\n';
out += 'READ ONLY. No files were modified.\n\n';

for (const file of targets) {
  const text = read(file);

  out += `\n\n### ${rel(file)}\n\n`;

  if (text == null) {
    out += 'MISSING\n';
    continue;
  }

  const needles =
    file.endsWith('portableExport.ts')
      ? [
          'async function assetFromUri',
          'async function buildPortableEntryPackage',
          'async function buildPortableFrequencyPackage',
          'async function buildPortableCollectionPackage',
          'async function webPortableShareChoice',
          'async function choosePortableShare',
          'async function sharePortableLazyWeb',
          'async function sharePortableLazy',
          'export async function sharePortableEntry',
          'export async function sharePortableFrequency',
          'export async function sharePortableCollection',
          'async function sharePackage',
          'portableShareInFlight',
          'portableLazyWebInFlight',
        ]
      : file.endsWith('EntryFormScreen.tsx')
        ? [
            'const shareEntry = async',
            'const [saving',
            'setSaving(',
            'sharePortableEntry',
            'accessibilityLabel="Share zapis"',
            'ActivityIndicator',
          ]
        : file.endsWith('MemoryRadioScreen.tsx')
          ? [
              'const shareFrequency = async',
              'busyTrackId',
              'sharePortableFrequency',
              'ActivityIndicator',
            ]
          : file.endsWith('CollectionDetailsScreen.tsx')
            ? [
                'const shareCollection = async',
                'sharePortableCollection',
                'deleting',
              ]
            : file.endsWith('ThemePickerScreen.tsx')
              ? [
                  '<BridgePanel />',
                  '<Pressable',
                  '</Pressable>',
                ]
              : [
                  'return (',
                  '<Pressable',
                  '</Pressable>',
                ];

  const seen = new Set();

  for (const needle of needles) {
    const hits = around(text, needle);

    if (!hits.length) continue;

    out += `\n-- ${needle} --\n`;

    for (const hit of hits) {
      if (seen.has(hit)) continue;
      seen.add(hit);
      out += hit + '\n\n';
    }
  }
}

// Structural counts
out += '\n\n### QUICK COUNTS\n\n';

for (const file of targets) {
  const text = read(file);
  if (text == null) continue;

  out += `${rel(file)}\n`;
  out += `  Pressable opens: ${(text.match(/<Pressable\b/g) || []).length}\n`;
  out += `  Pressable closes: ${(text.match(/<\/Pressable>/g) || []).length}\n`;
  out += `  BridgePanel tags: ${(text.match(/<BridgePanel\s*\/>/g) || []).length}\n`;
  out += '\n';
}

const output = path.join(ROOT, '_share-current-source-audit.txt');
fs.writeFileSync(output, out, 'utf8');

console.log('');
console.log('SHARE CURRENT-SOURCE AUDIT COMPLETE');
console.log('✓ READ ONLY');
console.log('✓ nothing modified');
console.log('✓ no backups needed');
console.log('');
console.log('Created:');
console.log(output);
console.log('');
console.log('Send me _share-current-source-audit.txt');
