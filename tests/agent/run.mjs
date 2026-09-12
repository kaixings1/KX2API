#!/usr/bin/env node
'use strict'
/**
 * Test runner script for all agent feature tests
 * Usage: node --import tests/setup/electron-mock.ts tests/agent/run.mjs
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

const testFiles = [
  'tests/agent/tool-collection.test.ts',
  'tests/agent/action-sampler.test.ts',
  'tests/agent/build-tools.test.ts',
  'tests/agent/team.test.ts',
  'tests/agent/dispatcher.test.ts',
]

function runTest(file) {
  return new Promise((resolve) => {
    const args = ['--import', 'file:///D:/KX2API/tests/setup/electron-mock.ts', '--test', file]
    const proc = spawn(process.execPath, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const output = stdout + '\n' + stderr
      const passMatch = output.match(/(\d+)\s+pass/) || output.match(/pass\s+(\d+)/)
      const failMatch = output.match(/(\d+)\s+fail/) || output.match(/fail\s+(\d+)/)
      const passed = passMatch ? parseInt((passMatch[1] || passMatch[2]), 10) : 0
      const failed = failMatch ? parseInt((failMatch[1] || failMatch[2]), 10) : 0

      resolve({ passed, failed, name: path.basename(file) })
    })
  })
}

async function main() {
  console.log('Running Agent Feature Tests\n')
  console.log('='.repeat(60))

  const results = []
  let totalPassed = 0
  let totalFailed = 0

  for (const file of testFiles) {
    process.stdout.write(`\nRunning ${path.basename(file)}... `)
    const result = await runTest(file)
    results.push(result)
    totalPassed += result.passed
    totalFailed += result.failed

    const status = result.failed === 0 ? 'PASS' : 'FAIL'
    process.stdout.write(`${status} ${result.passed}/${result.passed + result.failed} passed\n`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Summary:')
  results.forEach((r) => {
    const icon = r.failed === 0 ? 'PASS' : 'FAIL'
    console.log(`  ${icon} ${r.name}: ${r.passed}/${r.passed + r.failed} passed`)
  })

  console.log('='.repeat(60))
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed, ${testFiles.length} test files`)

  if (totalFailed > 0) {
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
