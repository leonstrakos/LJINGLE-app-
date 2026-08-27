const fs = require('fs');
const path = require('path');

const ROOT = '/opt/ljingle/data/sync/snapshots';

if (!fs.existsSync(ROOT)) {
  throw new Error(
    'SAFE STOP - snapshot directory missing: ' +
      ROOT,
  );
}

const files = fs
  .readdirSync(ROOT)
  .map((name) => {
    const full = path.join(ROOT, name);

    let stat;

    try {
      stat = fs.statSync(full);
    } catch {
      return null;
    }

    if (
      !stat.isFile() ||
      !name.toLowerCase().endsWith('.json')
    ) {
      return null;
    }

    return {
      name,
      full,
      mtimeMs: stat.mtimeMs,
      date: new Date(stat.mtimeMs),
      size: stat.size,
    };
  })
  .filter(Boolean)
  .sort(
    (a, b) =>
      b.mtimeMs - a.mtimeMs,
  );

const keep = new Set();
const why = new Map();

// Keep the newest 3 no matter what.
for (
  const item of files.slice(0, 3)
) {
  keep.add(item.full);
  why.set(item.full, 'recent');
}

// Keep one checkpoint per day for last 7 calendar days.
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const daily = new Set();

for (const item of files) {
  const ageDays =
    (now - item.mtimeMs) / dayMs;

  if (ageDays < 0 || ageDays > 7) {
    continue;
  }

  const key =
    item.date
      .toISOString()
      .slice(0, 10);

  if (!daily.has(key)) {
    daily.add(key);
    keep.add(item.full);

    if (!why.has(item.full)) {
      why.set(item.full, 'daily');
    }
  }
}

// Then keep one checkpoint per ISO-ish week for 4 older weeks.
// This is deliberately simple: bucket by 7-day age window.
const weekly = new Set();

for (const item of files) {
  const ageDays =
    (now - item.mtimeMs) / dayMs;

  if (
    ageDays <= 7 ||
    ageDays > 35
  ) {
    continue;
  }

  const bucket =
    Math.floor(ageDays / 7);

  if (!weekly.has(bucket)) {
    weekly.add(bucket);
    keep.add(item.full);

    if (!why.has(item.full)) {
      why.set(item.full, 'weekly');
    }
  }
}

const remove =
  files.filter(
    (item) =>
      !keep.has(item.full),
  );

const totalBefore =
  files.reduce(
    (sum, item) =>
      sum + item.size,
    0,
  );

const totalRemoved =
  remove.reduce(
    (sum, item) =>
      sum + item.size,
    0,
  );

console.log('');
console.log('LJINGLE CLOUD RETENTION');
console.log(
  'Snapshots before:',
  files.length,
);
console.log(
  'Snapshots retained:',
  keep.size,
);
console.log(
  'Snapshots to remove:',
  remove.length,
);
console.log(
  'Space before:',
  (
    totalBefore /
    1024 /
    1024
  ).toFixed(1) + ' MB',
);
console.log(
  'Space reclaimed:',
  (
    totalRemoved /
    1024 /
    1024
  ).toFixed(1) + ' MB',
);
console.log('');

for (const item of files) {
  if (keep.has(item.full)) {
    console.log(
      'KEEP',
      why.get(item.full),
      item.name,
    );
  }
}

for (const item of remove) {
  console.log(
    'DELETE',
    item.name,
  );

  fs.unlinkSync(item.full);
}

console.log('');
console.log('RETENTION COMPLETE ✓');
console.log(
  'Policy: latest 3 + daily 7d + weekly 4w',
);
