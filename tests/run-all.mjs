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

import { spawn, spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// agent / management 有各自的 runner（npm test / npm run test:management）
const OWN_RUNNERS = new Set(['agent', 'management'])
const ELECTRON_LOADER = pathToFileURL(path.join(projectRoot, 'tests/setup/electron-loader.mjs')).href
// 把 ~ 指到临时目录，避免测试写进真实的 ~/.chat2api
const TEST_HOME = path.join(projectRoot, '.test-home')

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'setup' || name === '__pycache__') continue
      collect(full, out)
    } else if (/\.test\.(ts|tsx|mjs|cjs|js)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

/** 单文件超时（毫秒）——避免某个测试挂住整个 runner */
const FILE_TIMEOUT_MS = 120_000

function killTree(pid) {
  // Windows 下需要连子孙进程一起杀，否则 tsx/子服务会挂住
  try {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch { /* ignore */ }
}

function runTest(file) {
  return new Promise((resolve) => {
    const rel = path.relative(projectRoot, file).split(path.sep).join('/')
    // --test-force-exit：有些被测代码会留下未清理的句柄（定时器/句柄），
    // 不加这个参数进程会一直挂着不退出（utils.test.ts 就是这种情况）
    const args = [
      // 限制子进程堆上限：34 个文件连着跑时，偶发 V8 反序列化 OOM（环境内存压力导致）
      '--max-old-space-size=768',
      '--import', 'tsx', '--import', ELECTRON_LOADER,
      '--test', '--test-force-exit', rel,
    ]
    const proc = spawn(process.execPath, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    })
    let out = ''
    let timedOut = false
    const cap = 20_000 // 每个文件最多留 20KB 输出，避免刷爆终端
    const timer = setTimeout(() => {
      timedOut = true
      killTree(proc.pid)
    }, FILE_TIMEOUT_MS)
    proc.stdout.on('data', (d) => { if (out.length < cap) out += d.toString() })
    proc.stderr.on('data', (d) => { if (out.length < cap) out += d.toString() })
    proc.on('close', (code) => {
      clearTimeout(timer)
      // node:test 的输出顺序是「pass 18 / fail 0」
      const pass = Number((out.match(/pass\s+(\d+)/) || [])[1] || 0)
      const fail = Number((out.match(/fail\s+(\d+)/) || [])[1] || 0)
      resolve({ rel, code, pass, fail, out, timedOut })
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const file of all) {
    let r = await runTest(file)
    // 一个用例都没跑起来（pass=0 且 fail=0 且退出码非 0）= 子进程启动就崩，
    // 多是瞬时内存压力，重试一次再判失败。
    if (r.pass === 0 && r.fail === 0 && r.code !== 0 && !r.timedOut) {
      await sleep(800)
      const retry = await runTest(file)
      if (retry.pass > 0 || retry.fail > 0) r = { ...retry, retried: true }
      else r = { ...r, retried: true }
    }
    totalPass += r.pass
    totalFail += r.fail
    const bad = r.fail > 0 || r.code !== 0 || r.pass === 0 || r.timedOut
    if (bad) failed.push(r)
    const status = bad ? 'FAIL' : 'PASS'
    const extra = r.timedOut ? ' (超时)' : r.fail ? `, ${r.fail} failed` : ''
    console.log(`${status}  ${r.rel.padEnd(46)} ${r.pass} passed${extra}${r.retried ? ' (重试后成功)' : ''}`)
    await sleep(80)
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
