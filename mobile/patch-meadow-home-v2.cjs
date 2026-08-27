/* LJingle — Meadow Today/Home alignment patch
   Run from: C:\Users\Korisnik\Desktop\TRACKING APP\mobile
   Command:  node .\patch-meadow-home-v2.cjs

   Safe behavior:
   - touches ONLY src/screens/TodayScreen.tsx
   - creates a timestamped backup
   - aborts if it cannot identify the Meadow condition
   - runs TypeScript afterwards
   - automatically restores the backup if TypeScript fails
*/

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ts = require('typescript');

const root = process.cwd();
const target = path.join(root, 'src', 'screens', 'TodayScreen.tsx');

if (!fs.existsSync(target)) {
  console.error('SAFE STOP: src/screens/TodayScreen.tsx nije pronađen.');
  console.error('Pokreni skriptu iz mobile foldera.');
  process.exit(1);
}

let source = fs.readFileSync(target, 'utf8');

if (source.includes('meadowHomeAlignmentV2')) {
  console.log('Patch meadowHomeAlignmentV2 je već prisutan. Ništa ne diram.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${target}.before-meadow-home-v2-${stamp}.bak`;
fs.copyFileSync(target, backup);

const sf = ts.createSourceFile(
  target,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function text(node) {
  return node.getText(sf);
}

function tagName(node) {
  if (ts.isJsxElement(node)) return text(node.openingElement.tagName);
  if (ts.isJsxSelfClosingElement(node)) return text(node.tagName);
  return '';
}

function opening(node) {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return null;
}

function jsxAncestors(node) {
  const out = [];
  let cur = node;
  while (cur) {
    if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur)) out.push(cur);
    cur = cur.parent;
  }
  return out;
}

function styleAttribute(node) {
  const op = opening(node);
  if (!op) return null;
  return op.attributes.properties.find(
    p => ts.isJsxAttribute(p) && text(p.name) === 'style'
  ) || null;
}

function styleText(node) {
  const a = styleAttribute(node);
  if (!a || !a.initializer || !ts.isJsxExpression(a.initializer)) return '';
  return a.initializer.expression ? text(a.initializer.expression) : '';
}

function findNodesContaining(token) {
  const needle = token.toLowerCase();
  const hits = [];
  function visit(node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      if (node.getText(sf).toLowerCase().includes(needle)) hits.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  // Fallback for tokens living inside require(...) or larger expressions.
  if (!hits.length) {
    function visitWide(node) {
      if (
        (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
        text(node).toLowerCase().includes(needle)
      ) hits.push(node);
      ts.forEachChild(node, visitWide);
    }
    visitWide(sf);
  }
  return hits;
}

function findBestContainer(token, preferredStyleWords = []) {
  const hits = findNodesContaining(token);
  let best = null;
  let bestScore = -Infinity;

  for (const hit of hits) {
    for (const a of jsxAncestors(hit)) {
      const tag = tagName(a);
      if (tag !== 'View' && tag !== 'Pressable' && tag !== 'TouchableOpacity') continue;

      const st = styleText(a).toLowerCase();
      let score = 0;
      if (styleAttribute(a)) score += 4;
      for (const w of preferredStyleWords) {
        if (st.includes(w.toLowerCase())) score += 8;
      }
      if (/card|tile|panel|glass|hero|summary|quick|recent|active/.test(st)) score += 5;

      const len = a.end - a.pos;
      score -= Math.min(len / 3000, 8);

      if (score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
  }
  return best;
}

function findSmallestJsx(token, wantedTag) {
  const needle = token.toLowerCase();
  let best = null;
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tg = tagName(node);
      const tx = text(node).toLowerCase();
      if ((!wantedTag || tg === wantedTag) && tx.includes(needle)) {
        if (!best || (node.end - node.pos) < (best.end - best.pos)) best = node;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return best;
}

function detectMeadowCondition() {
  let best = null;
  let score = -1;

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      const init = text(node.initializer);
      const low = `${name} ${init}`.toLowerCase();

      if (low.includes('meadow')) {
        let s = 2;
        if (name.toLowerCase().includes('meadow')) s += 5;
        if (low.includes('aero')) s += 3;
        if (low.includes('background')) s += 2;
        if (s > score) {
          best = name;
          score = s;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (best) return best;

  // Only use this fallback if the source already knows activeAeroBackgroundId.
  if (/\bactiveAeroBackgroundId\b/.test(source)) {
    return "(activeAeroBackgroundId === 'meadow')";
  }

  return null;
}

const meadowCondition = detectMeadowCondition();

if (!meadowCondition) {
  fs.unlinkSync(backup);
  console.error('SAFE STOP: nisam pouzdano našao Meadow condition u TodayScreen.tsx.');
  console.error('Ništa nije promijenjeno.');
  process.exit(1);
}

const edits = [];
const touched = new Set();

function replaceRange(start, end, value, key) {
  if (key && touched.has(key)) return false;
  edits.push({ start, end, value });
  if (key) touched.add(key);
  return true;
}

function addStyle(node, styleName) {
  if (!node) return false;
  const key = `${node.pos}:${node.end}:${styleName}`;
  if (touched.has(key)) return false;

  const op = opening(node);
  if (!op) return false;

  const attr = styleAttribute(node);

  if (attr && attr.initializer && ts.isJsxExpression(attr.initializer)) {
    const expr = attr.initializer.expression;

    if (!expr) return false;

    const oldExpr = text(expr);
    let nextExpr;

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
      nextExpr =
        `(state) => [(${oldExpr})(state), ${meadowCondition} ? styles.${styleName} : null]`;
    } else {
      nextExpr =
        `[${oldExpr}, ${meadowCondition} ? styles.${styleName} : null]`;
    }

    return replaceRange(expr.getStart(sf), expr.end, nextExpr, key);
  }

  // No style prop: insert one into the opening tag.
  const opText = text(op);
  const closeLen = ts.isJsxSelfClosingElement(op) ? 2 : 1;
  const insertAt = op.end - closeLen;
  return replaceRange(
    insertAt,
    insertAt,
    ` style={${meadowCondition} ? styles.${styleName} : undefined}`,
    key,
  );
}

function lowestCommonJsx(a, b) {
  if (!a || !b) return null;
  const aa = jsxAncestors(a);
  const bb = new Set(jsxAncestors(b));
  return aa.find(x => bb.has(x)) || null;
}

function directChildUnder(node, ancestor) {
  let cur = node;
  let lastJsx = null;
  while (cur && cur !== ancestor) {
    if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur)) lastJsx = cur;
    if (cur.parent === ancestor) return lastJsx || cur;
    cur = cur.parent;
  }
  return lastJsx;
}

// 1) Stronger, consistent frosted fill for the actual Home cards.
const cardTargets = [
  ['Interesi i aktivnosti', ['card', 'tile', 'quick']],
  ['Bilješke, citati i zapisi', ['card', 'tile', 'quick']],
  ['Sesije i vremenska crta', ['card', 'tile', 'quick']],
  ['Vrijeme, gledanje i trendovi', ['card', 'tile', 'quick']],
  ['Nema aktivnih timera', ['active', 'card', 'panel']],
  ['ZABILJEŽENO DANAS', ['summary', 'card', 'hero']],
];

let glassCount = 0;
for (const [token, words] of cardTargets) {
  const node = findBestContainer(token, words);
  if (node && addStyle(node, 'meadowGlassCardV2')) glassCount++;
}

// 2) Recent/paused timers card gets a slightly denser mobile surface.
let recentNode =
  findBestContainer('Zaustavljena aktivnost pojavit će se ovdje', ['recent', 'card', 'panel']) ||
  findBestContainer('Pauzirane aktivnosti', ['recent', 'card', 'panel']) ||
  findBestContainer('Nedavno', ['recent', 'card', 'panel']);

const recentApplied = recentNode
  ? addStyle(recentNode, 'meadowRecentCardV2')
  : false;

// 3) Radio left + daily timer right; make radio materially smaller.
const radioImage =
  findSmallestJsx('radio-meadow.png', 'Image') ||
  findSmallestJsx('radio.png', 'Image');

const timerContainer =
  findBestContainer('ZABILJEŽENO DANAS', ['summary', 'hero', 'card']) ||
  findBestContainer('Provedeno vremena', ['summary', 'hero', 'card']);

let layoutApplied = false;
let radioImageApplied = false;

if (radioImage && timerContainer) {
  const common = lowestCommonJsx(radioImage, timerContainer);

  // Guard against accidentally turning the whole screen/ScrollView into a row.
  if (
    common &&
    tagName(common) === 'View' &&
    (common.end - common.pos) < 30000
  ) {
    const radioSlot = directChildUnder(radioImage, common);
    const timerSlot = directChildUnder(timerContainer, common);

    if (
      radioSlot &&
      timerSlot &&
      radioSlot !== timerSlot
    ) {
      const a = addStyle(common, 'meadowTopRowV2');
      const b = addStyle(radioSlot, 'meadowRadioSlotV2');
      const c = addStyle(timerSlot, 'meadowTimerSlotV2');
      layoutApplied = a || b || c;
    }
  }

  radioImageApplied = addStyle(radioImage, 'meadowRadioImageV2');
}

// 4) Add the override styles at the end of StyleSheet.create({...}).
let stylesObject = null;
function findStyles(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'styles' &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    node.initializer.arguments.length &&
    ts.isObjectLiteralExpression(node.initializer.arguments[0])
  ) {
    stylesObject = node.initializer.arguments[0];
  }
  ts.forEachChild(node, findStyles);
}
findStyles(sf);

if (!stylesObject) {
  fs.unlinkSync(backup);
  console.error('SAFE STOP: StyleSheet styles object nije pronađen.');
  process.exit(1);
}

// Platform is needed by the new responsive/mobile-only overrides.
if (!/\bPlatform\b/.test(source)) {
  edits.push({
    start: 0,
    end: 0,
    value: "import { Platform } from 'react-native';\n",
  });
}

const styleBlock = `

  // meadowHomeAlignmentV2
  meadowGlassCardV2: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(248, 250, 247, 0.70)'
        : 'rgba(248, 250, 247, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.25,
  },

  meadowRecentCardV2: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(248, 250, 247, 0.76)'
        : 'rgba(248, 250, 247, 0.93)',
    borderColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1.25,
    minHeight: Platform.OS === 'web' ? undefined : 76,
  },

  meadowTopRowV2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 18 : 10,
  },

  meadowRadioSlotV2: {
    flex: Platform.OS === 'web' ? 0.82 : 0.72,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  meadowTimerSlotV2: {
    flex: Platform.OS === 'web' ? 1.18 : 1.28,
    minWidth: 0,
  },

  meadowRadioImageV2: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 300 : 170,
    height: Platform.OS === 'web' ? 170 : 110,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
`;

edits.push({
  start: stylesObject.end - 1,
  end: stylesObject.end - 1,
  value: styleBlock,
});

// Basic confidence gate: don't write a "successful" patch if almost nothing matched.
if (glassCount < 3 || (!layoutApplied && !radioImageApplied)) {
  fs.unlinkSync(backup);
  console.error('SAFE STOP: nisam dovoljno pouzdano prepoznao trenutni Home JSX.');
  console.error(`Prepoznate glass kartice: ${glassCount}/6`);
  console.error(`Top row: ${layoutApplied ? 'DA' : 'NE'}`);
  console.error(`Radio resize: ${radioImageApplied ? 'DA' : 'NE'}`);
  console.error('Ništa nije promijenjeno.');
  process.exit(1);
}

// Apply from end to start so positions remain valid.
edits.sort((a, b) => b.start - a.start || b.end - a.end);

for (const e of edits) {
  source = source.slice(0, e.start) + e.value + source.slice(e.end);
}

fs.writeFileSync(target, source, 'utf8');

console.log('');
console.log('Meadow Home patch applied:');
console.log(`  Frosted cards: ${glassCount}`);
console.log(`  Recent timers: ${recentApplied ? 'patched' : 'not found (left unchanged)'}`);
console.log(`  Radio/timer row: ${layoutApplied ? 'patched' : 'partial'}`);
console.log(`  Radio size: ${radioImageApplied ? 'patched' : 'not found'}`);
console.log(`  Backup: ${path.basename(backup)}`);
console.log('');
console.log('Running TypeScript check...');

const tsc =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(root, 'node_modules', '.bin', 'tsc');

const check = cp.spawnSync(
  fs.existsSync(tsc) ? tsc : 'npx',
  fs.existsSync(tsc) ? ['--noEmit'] : ['tsc', '--noEmit'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  },
);

if (check.status !== 0) {
  console.error('');
  console.error('TypeScript nije prošao — automatski vraćam TodayScreen backup.');
  fs.copyFileSync(backup, target);
  console.error('TodayScreen je vraćen. Nema partial patcha.');
  process.exit(check.status || 1);
}

console.log('');
console.log('✓ TypeScript silent/clean.');
console.log('✓ Meadow frosted cards usklađene.');
console.log('✓ Recent timers card dobio gušći mobile glass.');
console.log('✓ Radio je manji; radio/timer su side-by-side gdje je sigurno prepoznato.');
console.log('');
console.log('Refreshaj app i provjeri Meadow home.');
