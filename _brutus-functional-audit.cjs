const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'mobile', 'src');

const files = [
  'screens/EntryFormScreen.tsx',
  'screens/EntryListScreen.tsx',
  'screens/MemoryRadioScreen.tsx',
  'components/CommandPalette.tsx',
  'components/EntryLinkPicker.tsx',
  'storage/localApi.ts',
  'types/entry.ts',
];

const patterns = [
  /image/i,
  /remove/i,
  /delete/i,
  /entry/i,
  /search/i,
  /link/i,
  /relation/i,
  /frequency/i,
  /jingle/i,
  /command/i,
];

function printInteresting(file) {
  const full = path.join(ROOT, file);

  console.log('\n================================================');
  console.log(file);
  console.log('================================================');

  if (!fs.existsSync(full)) {
    console.log('MISSING');
    return;
  }

  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);

  const interesting = new Set();

  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      for (
        let i = Math.max(0, index - 5);
        i <= Math.min(lines.length - 1, index + 10);
        i++
      ) {
        interesting.add(i);
      }
    }
  });

  let previous = -2;

  [...interesting]
    .sort((a, b) => a - b)
    .forEach((index) => {
      if (index > previous + 1) {
        console.log('\n---');
      }

      console.log(
        String(index + 1).padStart(5, ' ') +
          ' | ' +
          lines[index],
      );

      previous = index;
    });
}

console.log('BRUTUS FUNCTIONAL AUDIT V1');

files.forEach(printInteresting);

console.log('\n================================================');
console.log('CLOUD ENV');
console.log('================================================');

const cloud =
  path.join(ROOT, 'services', 'cloudSync.ts');

if (fs.existsSync(cloud)) {
  const text = fs.readFileSync(cloud, 'utf8');

  [
    'EXPO_PUBLIC_SYNC_KEY',
    'EXPO_PUBLIC_SYNC_API_URL',
    'authHeaders',
    'Unauthorized',
  ].forEach((needle) => {
    console.log(
      needle,
      text.includes(needle) ? 'FOUND' : 'NOT FOUND',
    );
  });
}

console.log('\nAUDIT COMPLETE');