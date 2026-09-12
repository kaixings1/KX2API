/**
 * Test runner with Electron mock
 */

// 在加载任何模块前先 mock electron
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const electronMockPath = fileURLToPath(new URL('./electron-mock.ts', import.meta.url))

// 使用 --import 预加载 electron mock
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node run.mjs <test-file> [args...]')
  process.exit(1)
}

const testFile = args[0]
const restArgs = args.slice(1)

const child = spawn(
  process.execPath,
  [
    '--import', electronMockPath,
    '--test',
    testFile,
    ...restArgs,
  ],
  { stdio: 'inherit', env: process.env }
)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
