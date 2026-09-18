const { execSync } = require('child_process');
const out = execSync('node scripts/check-repo.mjs --no-write', { encoding: 'utf8', cwd: 'D:\\KX2API' });
const lines = out.split('\n');
const start = lines.findIndex(l => l.includes('src/main/utils'));
if (start >= 0) {
  console.log(lines.slice(start, start + 40).join('\n'));
}
