import { execSync } from 'child_process';

const result = execSync(
  'node --import tsx --import tests/setup/electron-loader.mjs --test tests/engine/legacy/coordinator.test.ts',
  { encoding: 'utf8', cwd: 'D:\\KX2API', timeout: 60000, stdio: 'pipe' }
);
console.log(result);
