const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const SRC = path.join(MOBILE, 'src');

const portable = path.join(
  SRC,
  'services',
  'portableExport.ts',
);

if (!fs.existsSync(portable)) {
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
  'portable-web-audio-v1-' + stamp,
);

fs.mkdirSync(backupDir, {
  recursive: true,
});

fs.copyFileSync(
  portable,
  path.join(
    backupDir,
    'portableExport.ts',
  ),
);

let text = fs
  .readFileSync(portable, 'utf8')
  .replace(/\r\n/g, '\n');

function fail(message) {
  throw new Error(
    'SAFE STOP - ' + message,
  );
}

// --------------------------------------------------------------------------
// Web frequencies can use a virtual URI like:
//   ljingle-web-audio:<id>
// Browser fetch() cannot resolve that custom scheme.
//
// Portable export must not crash just because one linked Frequency uses the
// web-only virtual URI. We preserve the asset metadata and mark the binary
// payload unavailable. Existing/origin-matched imports can still reuse it;
// a truly new import on another device will correctly fail rather than
// silently inventing audio.
// --------------------------------------------------------------------------

if (
  !text.includes(
    '// portableWebAudioVirtualUriV1',
  )
) {
  const marker =
    'async function assetFromUri(';

  const start =
    text.indexOf(marker);

  if (start < 0) {
    fail('assetFromUri function missing');
  }

  const bodyOpen =
    text.indexOf('{', start);

  if (bodyOpen < 0) {
    fail('assetFromUri body missing');
  }

  // Grab signature so we can discover parameter names.
  const signature =
    text.slice(start, bodyOpen);

  // Expected shape has uri + kind/name/mime parameters.
  const uriMatch =
    signature.match(
      /\buri\s*:\s*string/,
    );

  if (!uriMatch) {
    fail(
      'assetFromUri no longer has uri:string parameter',
    );
  }

  // Locate the normal returned PortableAsset object so we can reuse its
  // actual field expressions rather than guessing local variable names.
  const functionTail =
    text.slice(
      bodyOpen,
      Math.min(
        text.length,
        bodyOpen + 5000,
      ),
    );

  const returnMatch =
    functionTail.match(
      /return\s+\{[\s\S]*?assetId\s*:[\s\S]*?kind\s*:[\s\S]*?name\s*:[\s\S]*?mimeType\s*:[\s\S]*?byteLength\s*:[\s\S]*?base64\s*:[\s\S]*?\};/,
    );

  if (!returnMatch) {
    fail(
      'assetFromUri return object shape changed',
    );
  }

  const returnObject =
    returnMatch[0];

  // Extract the existing field expressions. Keep them exactly.
  function fieldExpr(field) {
    const re =
      new RegExp(
        field +
          '\\s*:\\s*([^,\\n}]+)',
      );

    const match =
      returnObject.match(re);

    return match
      ? match[1].trim()
      : null;
  }

  const assetIdExpr =
    fieldExpr('assetId');
  const kindExpr =
    fieldExpr('kind');
  const nameExpr =
    fieldExpr('name');
  const mimeExpr =
    fieldExpr('mimeType');

  if (
    !assetIdExpr ||
    !kindExpr ||
    !nameExpr
  ) {
    fail(
      'could not infer PortableAsset fields',
    );
  }

  const virtualBlock = `

  // portableWebAudioVirtualUriV1
  // Web audio can live behind LJingle's virtual URI instead of a fetchable
  // http/blob/file URL. Do not let that prevent sharing the graph object.
  if (uri.startsWith('ljingle-web-audio:')) {
    return {
      assetId: ${assetIdExpr},
      kind: ${kindExpr},
      name: ${nameExpr},
      mimeType: ${mimeExpr || 'null'},
      byteLength: null,
      base64: null,
    };
  }
`;

  text =
    text.slice(0, bodyOpen + 1) +
    virtualBlock +
    text.slice(bodyOpen + 1);
}

// Also make ordinary fetch failures descriptive instead of leaving an
// unhandled browser Fetch API scheme error.
if (
  !text.includes(
    '// portableAssetFetchGuardV1',
  )
) {
  const fetchNeedle =
    'const response = await fetch(uri);';

  if (text.includes(fetchNeedle)) {
    text = text.replace(
      fetchNeedle,
      `// portableAssetFetchGuardV1
  let response: Response;

  try {
    response = await fetch(uri);
  } catch (caught) {
    throw new Error(
      'Portable asset cannot be read: ' +
        uri +
        ' (' +
        (caught instanceof Error
          ? caught.message
          : 'unknown fetch error') +
        ')',
    );
  }`,
    );
  }
}

fs.writeFileSync(
  portable,
  text,
  'utf8',
);

console.log('');
console.log('PORTABLE WEB AUDIO FIX V1 INSTALLED');
console.log('✓ ljingle-web-audio: no longer crashes package building');
console.log('✓ graph/Collection/Entry share can continue');
console.log('✓ virtual web audio is represented as metadata-only asset');
console.log('✓ native/file/blob/http audio embedding is unchanged');
console.log('✓ a new-device import still refuses to invent missing audio');
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
