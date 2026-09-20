#!/usr/bin/env node
'use strict'
/**
 * Test runner script for all agent feature tests
 * Usage: node --import tests/setup/electron-mock.ts tests/agent/run.mjs
 */

import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

// electron-mock 需要以 file URL 形式传给 --import，避免硬编码绝对路径
const electronMockUrl = pathToFileURL(
  path.resolve(projectRoot, 'tests/setup/electron-mock.ts')
).href

// 单个用例超时：某用例里 promise 永不 settle（漏 await / 漏解构 reject）时，
// 没有它整个文件会一直不产出统计行，只能等文件级超时被强杀且不知挂在哪。
const TEST_TIMEOUT_MS = 15_000
// 单文件超时兜底（含 runner 启动、tsx 转译、electron mock 装载）
const FILE_TIMEOUT_MS = 120_000

/** Windows 下需要连子孙进程一起杀，否则 tsx/子服务会挂住 */
function killTree(pid) {
  try {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch { /* ignore */ }
}

const testFiles = [
  'tests/agent/tool-collection.test.ts',
  'tests/agent/action-sampler.test.ts',
  'tests/agent/build-tools.test.ts',
  'tests/agent/team.test.ts',
  'tests/agent/dispatcher.test.ts',
]

function runTest(file) {
  return new Promise((resolve) => {
    // 先用 tsx 加载器支持 .ts / 无扩展名导入，再挂载 electron mock
    // --test-force-exit：被测代码可能留下未清理的句柄，不加进程不退出
    const args = [
      '--import', 'tsx', '--import', electronMockUrl,
      '--test', '--test-force-exit',
      `--test-timeout=${TEST_TIMEOUT_MS}`,
      file,
    ]
    const proc = spawn(process.execPath, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(proc.pid)
    }, FILE_TIMEOUT_MS)

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      const output = stdout + '\n' + stderr
      const passMatch = output.match(/(\d+)\s+pass/) || output.match(/pass\s+(\d+)/)
      const failMatch = output.match(/(\d+)\s+fail/) || output.match(/fail\s+(\d+)/)
      const passed = passMatch ? parseInt((passMatch[1] || passMatch[2]), 10) : 0
      const failed = failMatch ? parseInt((failMatch[1] || failMatch[2]), 10) : 0

      resolve({ passed, failed, name: path.basename(file), code, timedOut })
    })
  })
}

async function main() {
  console.log('Running Agent Feature Tests\n')
  console.log('='.repeat(60))

  const results = []
  let totalPassed = 0
  let totalFailed = 0
  let badFiles = 0

  for (const file of testFiles) {
    process.stdout.write(`\nRunning ${path.basename(file)}... `)
    const result = await runTest(file)
    results.push(result)
    totalPassed += result.passed
    totalFailed += result.failed

    const bad = result.failed > 0 || result.timedOut || result.code !== 0
    if (bad) badFiles++
    const status = bad ? 'FAIL' : 'PASS'
    const extra = result.timedOut ? ' (超时)' : result.failed ? `, ${result.failed} failed` : ''
    process.stdout.write(`${status} ${result.passed}/${result.passed + result.failed} passed${extra}\n`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Summary:')
  results.forEach((r) => {
    const icon = r.failed === 0 && !r.timedOut && r.code === 0 ? 'PASS' : 'FAIL'
    const extra = r.timedOut ? ' (超时)' : ''
    console.log(`  ${icon} ${r.name}: ${r.passed}/${r.passed + r.failed} passed${extra}`)
  })

  console.log('='.repeat(60))
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed, ${testFiles.length} test files`)

  if (totalFailed > 0 || badFiles > 0) {
    console.log('\nSome tests failed')
    process.exit(1)
  } else {
    console.log('\nAll tests passed!')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Test runner error:', err)
  process.exit(1)
})
