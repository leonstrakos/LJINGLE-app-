const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');
const FILE = path.join(MOBILE, 'src', 'services', 'portableExport.ts');

function fail(message) {
  throw new Error('SAFE STOP - ' + message);
}

if (!fs.existsSync(FILE)) {
  fail('portableExport.ts missing');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(
  ROOT,
  '_recovery',
  'share-finalize-probe-v1-' + stamp,
);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(FILE, path.join(backupDir, 'portableExport.ts'));

let text = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const fnStart = text.indexOf('async function finalizePortablePackage(');
if (fnStart < 0) {
  fail('finalizePortablePackage start not found');
}

const nextFnCandidates = [
  '\nexport async function sharePortable',
  '\nexport async function buildPortable',
  '\nexport async function readPortable',
];
let fnEnd = -1;
for (const marker of nextFnCandidates) {
  const idx = text.indexOf(marker, fnStart + 1);
  if (idx > fnEnd) fnEnd = fnEnd === -1 ? idx : Math.min(fnEnd, idx);
}
if (fnEnd < 0) {
  fail('finalizePortablePackage end boundary not found');
}

let block = text.slice(fnStart, fnEnd);

const injections = [
  {
    marker: "const packageJson =",
    insert: "  shareProbe('finalize:packageJson:start');\n",
    afterMarkerEnd: True if False else False
  },
]

def inject_before_once(src, marker, snippet, label):
    idx = src.find(marker)
    if idx < 0:
        raise RuntimeError(label)
    if snippet.strip() in src:
        return src
    return src[:idx] + snippet + src[idx:]

def inject_after_once(src, marker, snippet, label):
    idx = src.find(marker)
    if idx < 0:
        raise RuntimeError(label)
    if snippet.strip() in src:
        return src
    pos = idx + len(marker)
    return src[:pos] + snippet + src[pos:]

# likely stages
try:
    block = inject_before_once(
        block,
        'const packageJson =',
        "  shareProbe('finalize:packageJson:start');\n",
        'packageJson anchor missing',
    )
except RuntimeError:
    pass

try:
    block = inject_after_once(
        block,
        'const packageJson =',
        "\n  shareProbe('finalize:packageJson:done');",
        'packageJson after anchor missing',
    )
except RuntimeError:
    pass

# writeAsStringAsync usually exists
if "writeAsStringAsync(" in block and "finalize:fileWrite:start" not in block:
    block = block.replace(
        "await FileSystem.writeAsStringAsync(",
        "shareProbe('finalize:fileWrite:start');\n  await FileSystem.writeAsStringAsync(",
        1,
    )
    block = block.replace(
        ");\n",
        ");\n  shareProbe('finalize:fileWrite:done');\n",
        1,
    )

# choice dialog
if "choosePortableShare(" in block and "finalize:chooseShare:start" not in block:
    block = block.replace(
        "await choosePortableShare(",
        "shareProbe('finalize:chooseShare:start');\n  await choosePortableShare(",
        1,
    )
    block = block.replace(
        ");\n",
        ");\n  shareProbe('finalize:chooseShare:done');\n",
        2,
    )

# navigator share direct
if "await Share.share(" in block and "finalize:nativeShare:start" not in block:
    block = block.replace(
        "await Share.share(",
        "shareProbe('finalize:nativeShare:start');\n  await Share.share(",
        1,
    )

# web alert/download helper candidates
for fn_name in ['showPortableWebShareDialog', 'downloadPortablePackage', 'shareVisualPortablePackage']:
    if fn_name + '(' in block and f"finalize:{fn_name}:start" not in block:
        block = block.replace(
            f"await {fn_name}(",
            f"shareProbe('finalize:{fn_name}:start');\n  await {fn_name}(",
            1,
        )
        block = block.replace(
            ");\n",
            f");\n  shareProbe('finalize:{fn_name}:done');\n",
            1,
        )

# generic return probe
if "shareProbe('finalize:return')" not in block:
    ret_idx = block.rfind('return ')
    if ret_idx >= 0:
        block = block[:ret_idx] + "  shareProbe('finalize:return');\n" + block[ret_idx:]

text = text[:fnStart] + block + text[fnEnd:]
fs.writeFileSync(FILE, text, 'utf8')

print('')
print('FINALIZE SHARE PROBE INSTALLED')
print('✓ narrowed only to finalizePortablePackage')
print('✓ probes packageJson / fileWrite / chooseShare when anchors exist')
print('✓ non-matching anchors are skipped safely')
print('BACKUP:', backupDir)
print('')

try:
    cp.execSync('npx tsc --noEmit', {
        cwd: MOBILE,
        stdio: 'inherit',
        shell: True if False else True,
    })
    print('')
    print('TYPESCRIPT CLEAN ✓')
except Exception:
    print('')
    print('TYPESCRIPT HAS ERRORS')
    print('Backup:', backupDir)
    raise
