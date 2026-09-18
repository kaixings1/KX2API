import { execSync } from 'node:child_process'

const files = [
  'coordinator',
  'e2e-all-profiles',
  'integration',
  'model',
  'task-decomposer-executor',
  'tools',
]

for (const f of files) {
  const path = `tests/engine/legacy/broken/${f}.test.ts`
  let out = ''
  try {
    out = execSync(
      `node --import tsx --import ./tests/setup/electron-loader.mjs --test ${path}`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 },
    )
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '')
  }
  const passLine = out.split('\n').find(l => l.includes('Passed:') || l.includes('ℹ pass'))
  const failLine = out.split('\n').find(l => l.includes('Failed:') || l.includes('ℹ fail'))
  const errLine = out.split('\n').find(l => l.includes('ERR_MODULE_NOT_FOUND') || l.includes('Cannot find module'))
  console.log(`${f}: ${passLine?.trim() ?? '?'} | ${failLine?.trim() ?? '?'}${errLine ? ' | ' + errLine.trim() : ''}`)
}
