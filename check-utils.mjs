const { execSync } = require('child_process');
const out = execSync('node scripts/check-integration.mjs', { encoding: 'utf8', cwd: 'D:\\KX2API' });
const lines = out.split('\n');
const start = lines.findIndex(l => l.includes('src/main'));
if (start >= 0) {
  console.log(lines.slice(start, start + 20).join('\n'));
}
