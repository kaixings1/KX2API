#!/usr/bin/env node
/**
 * tests/run-all.mjs — 跑 tests/ 下所有「无人执行」的测试
 *
 * 背景：tests/ 里原有 43 个测试文件，但只有 tests/agent（npm test）和
 * tests/management（npm run test:management）被 npm script 指向，
 * 其余 35 个躺在那里永远不会被执行，等于没有测试。
 *
 * 这里把它们全部接上（node:test + tsx + electron mock），
 * 用法：
 *   node tests/run-all.mjs              # 跑全部
 *   node tests/run-all.mjs tool-calling # 只跑某个子目录/关键字
 *
 * 输出末行摘要，任一失败则退出码非 0，可直接用于 CI。
 */

import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// agent / management 有各自的 runner（npm test / npm run test:management）
const OWN_RUNNERS = new Set(['agent', 'management'])
const ELECTRON_MOCK = pathToFileURL(path.join(projectRoot, 'tests/setup/electron-mock.ts')).href

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'setup' || name === '__pycache__') continue
      collect(full, out)
    } else if (/\.test\.(ts|tsx|mjs|js)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

function runTest(file) {
  return new Promise((resolve) => {
    const rel = path.relative(projectRoot, file).split(path.sep).join('/')
    const args = ['--import', 'tsx', '--import', ELECTRON_MOCK, '--test', rel]
    const proc = spawn(process.execPath, args, { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.stderr.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      const pass = Number((out.match(/^# pass (\d+)/m) || out.match(/(\d+)\s+pass/) || [])[1] || 0)
      const fail = Number((out.match(/^# fail (\d+)/m) || out.match(/(\d+)\s+fail/) || [])[1] || 0)
      resolve({ rel, code, pass, fail, out })
    })
  })
}

async function main() {
  const filter = process.argv[2]
  const all = collect(path.join(projectRoot, 'tests'))
    .filter((f) => !OWN_RUNNERS.has(path.relative(path.join(projectRoot, 'tests'), f).split(path.sep)[0]))
    .filter((f) => !filter || f.split(path.sep).join('/').includes(filter))
    .sort()

  console.log(`测试文件：${all.length} 个${filter ? `（过滤：${filter}）` : ''}\n`)
  console.log('='.repeat(64))

  let totalPass = 0
  let totalFail = 0
  const failed = []
  for (const file of all) {
    const r = await runTest(file)
    totalPass += r.pass
    totalFail += r.fail
    const bad = r.fail > 0 || r.code !== 0 || r.pass === 0
    if (bad) failed.push(r)
    const status = bad ? 'FAIL' : 'PASS'
    console.log(`${status}  ${r.rel.padEnd(46)} ${r.pass} passed${r.fail ? `, ${r.fail} failed` : ''}`)
  }

  console.log('='.repeat(64))
  console.log(`合计：${totalPass} 通过, ${totalFail} 失败, ${all.length} 个文件`)

  if (failed.length > 0) {
    console.log(`\n有 ${failed.length} 个文件未通过，失败详情：\n`)
    for (const r of failed) {
      console.log('-'.repeat(64))
      console.log(`### ${r.rel}  (exit=${r.code})`)
      const lines = r.out.split('\n')
      const start = Math.max(0, lines.findIndex((l) => /not ok|Error|✖/.test(l)) - 2)
      console.log(lines.slice(start > 0 ? start : 0, (start > 0 ? start : 0) + 25).join('\n'))
    }
    process.exit(1)
  }
  console.log('\n全部通过')
}

main().catch((e) => {
  console.error('runner 异常：', e)
  process.exit(1)
})
