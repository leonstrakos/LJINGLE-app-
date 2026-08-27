const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'mobile', 'src');

const wanted = [
  'services/memoryRadioApi.ts',
  'services/entityLinksApi.ts',
  'types/memoryRadio.ts',
  'types/collection.ts',
  'storage/database.ts',
  'storage/backup.ts',
  'services/cloudSync.ts',
];

for (const relative of wanted) {
  const file = path.join(root, relative);

  console.log('\n');
  console.log('='.repeat(72));
  console.log(relative);
  console.log('='.repeat(72));

  if (!fs.existsSync(file)) {
    console.log('MISSING');
    continue;
  }

  const lines = fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const patterns = [
    /CREATE TABLE/i,
    /track/i,
    /memory/i,
    /frequency/i,
    /entity/i,
    /reference/i,
    /relation/i,
    /link/i,
    /attach/i,
    /getAll/i,
    /SELECT/i,
    /INSERT/i,
    /UPDATE/i,
    /DELETE/i,
    /SYNC_KEY/i,
    /EXPO_PUBLIC/i,
    /authHeaders/i,
  ];

  const selected = new Set();

  lines.forEach((line, index) => {
    if (!patterns.some((pattern) => pattern.test(line))) {
      return;
    }

    for (
      let i = Math.max(0, index - 6);
      i <= Math.min(lines.length - 1, index + 16);
      i += 1
    ) {
      selected.add(i);
    }
  });

  let previous = -2;

  [...selected]
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

console.log('\nBRUTUS V2 AUDIT COMPLETE');