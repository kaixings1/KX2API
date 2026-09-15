const fs = require('fs');
const path = require('path');
// node 运行于 cwd = D:\KX2API（MSYS cygdrive 伪装，但 node 是 Windows 原生，能访问 D:）
const root = './src';
const skip = new Set(['node_modules', '.git', 'dist', 'out', 'release', 'build', 'coverage', '__pycache__', 'generated', 'shims']);

function walk(d) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(d); } catch (e) { return out; }
  for (const f of entries) {
    const p = path.join(d, f);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (skip.has(f)) continue;
      out = out.concat(walk(p));
    } else if (/\.(ts|tsx|js|cjs)$/.test(f)) {
      out.push(p);
    }
  }
  return out;
}

let files;
try { files = walk(root); } catch (e) { console.error('WALK ERR', e); return; }
console.error('files scanned:', files.length);

const pats = [
  'new MessageLoop', 'toolDefinitions:', 'commandToolsToMap', 'toolGroups',
  'MessageLoop(', 'buildRegistry', 'new ToolScheduler', 'resolveActiveTools',
  'buildToolHint', 'commandRegistry', 'RequestBuilder(', 'getActiveTools',
  'enabledToolGroups', 'KX2_TOOL_DEF', 'from \'./commands/registry\'', 'from \'../commands/registry\'',
  'throughRequestBuilder', 'applyToolEnvVars'
];

const hits = new Map();
for (const f of files) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const lines = s.split('\n');
  lines.forEach((l, i) => {
    for (const p of pats) {
      if (l.includes(p)) {
        if (!hits.has(p)) hits.set(p, []);
        hits.get(p).push(`${f}:${i + 1}: ${l.trim().slice(0, 160)}`);
      }
    }
  });
}

for (const [p, arr] of hits) {
  console.log('\n===== ' + p + ' (' + arr.length + ' hits) =====');
  arr.slice(0, 40).forEach(x => console.log('  ' + x));
}