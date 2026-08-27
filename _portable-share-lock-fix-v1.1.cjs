const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const file = path.join(
  MOBILE,
  'src',
  'services',
  'portableExport.ts',
);

if (!fs.existsSync(file)) {
  throw new Error(
    'SAFE STOP - portableExport.ts missing',
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');

const backupDir = path.join(
  ROOT,
  '_recovery',
  'portable-share-lock-fix-v1-1-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  file,
  path.join(
    backupDir,
    'portableExport.ts',
  ),
);

let text = fs
  .readFileSync(file, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

function findMatchingBrace(
  source,
  openIndex,
) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let templateDepth = 0;

  for (
    let i = openIndex;
    i < source.length;
    i += 1
  ) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (
        ch === '*' &&
        next === '/'
      ) {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        escaped = true;
        continue;
      }

      if (quote === '`') {
        if (
          ch === '$' &&
          next === '{'
        ) {
          templateDepth += 1;
          i += 1;
          continue;
        }

        if (
          ch === '}' &&
          templateDepth > 0
        ) {
          templateDepth -= 1;
          continue;
        }

        if (
          ch === '`' &&
          templateDepth === 0
        ) {
          quote = null;
        }

        continue;
      }

      if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (
      ch === '/' &&
      next === '/'
    ) {
      lineComment = true;
      i += 1;
      continue;
    }

    if (
      ch === '/' &&
      next === '*'
    ) {
      blockComment = true;
      i += 1;
      continue;
    }

    if (
      ch === "'" ||
      ch === '"' ||
      ch === '`'
    ) {
      quote = ch;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

if (
  text.includes(
    'async function choosePortableShareUnlocked(',
  )
) {
  console.log(
    '○ robust share lock already installed',
  );
} else {
  const marker =
    'async function choosePortableShare(';

  const start =
    text.indexOf(marker);

  if (start < 0) {
    fail(
      'choosePortableShare function missing',
    );
  }

  const openBrace =
    text.indexOf('{', start);

  if (openBrace < 0) {
    fail(
      'choosePortableShare opening brace missing',
    );
  }

  const closeBrace =
    findMatchingBrace(
      text,
      openBrace,
    );

  if (closeBrace < 0) {
    fail(
      'choosePortableShare closing brace could not be located',
    );
  }

  const original =
    text.slice(
      start,
      closeBrace + 1,
    );

  const unlocked =
    original.replace(
      'async function choosePortableShare(',
      'async function choosePortableShareUnlocked(',
    );

  const wrapper = `${unlocked}

let portableShareInFlight = false;

async function choosePortableShare(
  pack: LjinglePortablePackage,
) {
  if (portableShareInFlight) {
    return null;
  }

  portableShareInFlight = true;

  try {
    return await choosePortableShareUnlocked(
      pack,
    );
  } finally {
    portableShareInFlight = false;
  }
}`;

  text =
    text.slice(0, start) +
    wrapper +
    text.slice(closeBrace + 1);
}

// Remove a stray earlier declaration if one somehow exists
// before the unlocked wrapper.
const matches =
  [...text.matchAll(
    /let portableShareInFlight = false;/g,
  )];

if (matches.length > 1) {
  const keep =
    matches[matches.length - 1].index;

  text = text
    .split('\n')
    .filter((line, index, lines) => {
      if (
        line.trim() !==
        'let portableShareInFlight = false;'
      ) {
        return true;
      }

      const before =
        lines
          .slice(0, index)
          .join('\n')
          .length;

      return before >= keep - 1;
    })
    .join('\n');
}

fs.writeFileSync(
  file,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE SHARE LOCK FIX V1.1 INSTALLED');
console.log('✓ no brittle end-anchor matching');
console.log('✓ original share chooser preserved as-is');
console.log('✓ wrapper prevents concurrent Web Share sessions');
console.log('✓ Bridge / visual card / .ljingle choices remain untouched');
console.log('BACKUP:', backupDir);
console.log('');

try {
  cp.execSync(
    'npx tsc --noEmit',
    {
      cwd: MOBILE,
      stdio: 'inherit',
      shell: true,
    },
  );

  console.log('');
  console.log('TYPESCRIPT CLEAN ✓');
} catch {
  console.error('');
  console.error(
    'TYPESCRIPT STILL HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
