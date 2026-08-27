const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(
  MOBILE,
  'src',
  'services',
  'portableExport.ts',
);

if (!fs.existsSync(FILE)) {
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
  'portable-web-dialog-v1-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  FILE,
  path.join(
    backupDir,
    'portableExport.ts',
  ),
);

let text = fs
  .readFileSync(FILE, 'utf8')
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

const marker =
  'async function webPortableShareChoice(';

const start =
  text.indexOf(marker);

if (start < 0) {
  fail(
    'webPortableShareChoice function missing',
  );
}

const openBrace =
  text.indexOf('{', start);

if (openBrace < 0) {
  fail(
    'webPortableShareChoice opening brace missing',
  );
}

const closeBrace =
  findMatchingBrace(
    text,
    openBrace,
  );

if (closeBrace < 0) {
  fail(
    'webPortableShareChoice closing brace missing',
  );
}

const replacement = `async function webPortableShareChoice(
  pack: LjinglePortablePackage,
) {
  // portableWebDialogV1
  // Use the browser top-layer <dialog> instead of a hand-made fixed overlay.
  // This cannot disappear behind React Navigation's aria-hidden screens.
  if (
    typeof document === 'undefined'
  ) {
    throw new Error(
      'Web share menu nije dostupan.',
    );
  }

  return new Promise<string | null>(
    (resolve) => {
      const dialog =
        document.createElement('dialog');

      dialog.setAttribute(
        'aria-label',
        'Share from LJingle',
      );

      dialog.style.width =
        'min(480px, calc(100vw - 32px))';
      dialog.style.maxWidth = '480px';
      dialog.style.border =
        '1px solid rgba(30,30,30,0.14)';
      dialog.style.borderRadius = '22px';
      dialog.style.padding = '0';
      dialog.style.background = '#F2EEE5';
      dialog.style.color = '#111111';
      dialog.style.boxShadow =
        '0 24px 90px rgba(0,0,0,0.28)';
      dialog.style.fontFamily =
        'Arial, Helvetica, sans-serif';

      const shell =
        document.createElement('div');

      shell.style.padding = '20px';

      const kicker =
        document.createElement('div');

      kicker.textContent =
        'SHARE FROM LJINGLE';
      kicker.style.fontSize = '10px';
      kicker.style.fontWeight = '800';
      kicker.style.letterSpacing = '1.4px';
      kicker.style.opacity = '0.55';

      const title =
        document.createElement('div');

      title.textContent = pack.title;
      title.style.marginTop = '7px';
      title.style.fontFamily =
        'Georgia, Times New Roman, serif';
      title.style.fontSize = '24px';
      title.style.fontWeight = '700';

      const copy =
        document.createElement('div');

      copy.textContent =
        'Choose how this LJingle object should leave your archive.';
      copy.style.marginTop = '7px';
      copy.style.fontSize = '12px';
      copy.style.lineHeight = '18px';
      copy.style.opacity = '0.62';

      const actions =
        document.createElement('div');

      actions.style.display = 'grid';
      actions.style.gap = '9px';
      actions.style.marginTop = '18px';

      let finished = false;

      const finish = (
        value: string | null,
      ) => {
        if (finished) return;
        finished = true;

        try {
          dialog.close();
        } catch {}

        dialog.remove();

        resolve(value);
      };

      const button = (
        label: string,
        value: string | null,
        primary = false,
      ) => {
        const item =
          document.createElement('button');

        item.type = 'button';
        item.textContent = label;
        item.style.width = '100%';
        item.style.minHeight = '46px';
        item.style.borderRadius = '13px';
        item.style.border =
          primary
            ? '1px solid #111111'
            : '1px solid rgba(30,30,30,0.14)';
        item.style.background =
          primary
            ? '#111111'
            : '#FBF8F1';
        item.style.color =
          primary
            ? '#FFFFFF'
            : '#111111';
        item.style.fontSize = '11px';
        item.style.fontWeight = '800';
        item.style.letterSpacing = '0.45px';
        item.style.cursor = 'pointer';

        item.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          finish(value);
        };

        return item;
      };

      actions.appendChild(
        button(
          'SHARE VISUAL CARD',
          'visual',
        ),
      );

      actions.appendChild(
        button(
          'SEND VIA BRIDGE',
          'bridge',
          true,
        ),
      );

      actions.appendChild(
        button(
          'SHARE .LJINGLE',
          'portable',
        ),
      );

      actions.appendChild(
        button(
          'CANCEL',
          null,
        ),
      );

      shell.appendChild(kicker);
      shell.appendChild(title);
      shell.appendChild(copy);
      shell.appendChild(actions);
      dialog.appendChild(shell);
      document.body.appendChild(dialog);

      dialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();
          finish(null);
        },
      );

      dialog.addEventListener(
        'close',
        () => {
          if (!finished) {
            finish(null);
          }
        },
      );

      try {
        dialog.showModal();
      } catch (caught) {
        dialog.remove();

        throw caught;
      }
    },
  );
}`;

text =
  text.slice(0, start) +
  replacement +
  text.slice(closeBrace + 1);

fs.writeFileSync(
  FILE,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE WEB DIALOG V1 INSTALLED');
console.log('✓ replaces invisible fixed overlay with browser top-layer dialog');
console.log('✓ Visual Card preserved');
console.log('✓ Bridge preserved');
console.log('✓ .ljingle preserved');
console.log('✓ dialog buttons stop click propagation');
console.log('✓ no React nested-button markup introduced');
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
    'TYPESCRIPT HAS ERRORS',
  );
  console.error(
    'Backup:',
    backupDir,
  );
  process.exitCode = 1;
}
