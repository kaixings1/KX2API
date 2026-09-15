const fs = require('fs');
const path = require('path');
const root = './src';
const skip = new Set(['node_modules', '.git', 'dist', 'out', 'release', 'build', 'coverage', '__pycache__']);
function walk(d) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(d); } catch { return out; }
  for (const f of entries) {
    const p = path.join(d, f);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (skip.has(f)) continue; out = out.concat(walk(p)); }
    else if (/\.(ts|tsx|js|cjs)$/.test(f)) out.push(p);
  }
  return out;
}
const files = walk(root);
const pats = [
  'createApiClientStream', 'TOOL_COMMAND_WHITELIST', 'createEngine(', 'createMainEngine',
  'initEngine(', 'setApiClient', 'setToolDefinitions', 'opts.tools', "opts: { tools",
  'updateEngineApiClient', "importCommands", "buildToolsFromRegistry", "sendOpenAIStreamWithTools",
  'initializeEngine', 'engine-bridge', 'createEngineAndStart', 'createMainEngine'
];
const hits = new Map();
for (const f of files) {
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const lines = s.split('\n');
  lines.forEach((l, i) => {
    for (const p of pats) {
      if (l.includes(p)) {
        if (!hits.has(p)) hits.set(p, []);
        hits.get(p).push(`${path.relative(root, f)}:${i + 1}: ${l.trim().slice(0, 170)}`);
      }
    }
  });
}
for (const p of pats) {
  const arr = hits.get(p) || [];
  console.log(`\n===== ${p} (${arr.length}) =====`);
  arr.slice(0, 50).forEach(x => console.log('  ' + x));
}