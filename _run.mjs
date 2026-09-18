import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const file = resolve(process.argv[2])
const loader = pathToFileURL(resolve('tests/setup/electron-loader.mjs')).href
const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', loader, '--test', file], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 1024 * 1024 * 32,
})
const out = (r.stdout || '') + (r.stderr || '')
console.log(out.split('\n').filter((l) => /✔|✖|pass|fail|AssertionError|Error:/i.test(l)).join('\n'))
console.log('EXIT=' + r.status)
