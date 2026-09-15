#!/usr/bin/env node
/**
 * scripts/check-integration.mjs — 代码接入体检
 *
 * 回答「src/ 下的文件到底有没有真正被应用使用」。
 *
 * 三个入口做静态依赖追踪（相对路径 + @ / @shared 别名 + 各种资源后缀），
 * 并额外做一次「字符串路径」扫描，把运行时用字符串拼路径加载的文件也算进来
 * （例如 readFileSync('./x.json')、plugin 目录扫描）。
 *
 * 用法：
 *   node scripts/check-integration.mjs              # 全量
 *   node scripts/check-integration.mjs src/commands # 只看某个前缀
 *   node scripts/check-integration.mjs --list src/tools   # 列出该目录下未接入的文件
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 应用真正的入口
const APP_ENTRIES = [
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/main.tsx',
]

// 测试入口（属于「被测试使用」，不是「被应用使用」）
const TEST_ENTRIES = [
  'tests/agent/run.mjs',
  'tests/management/run.mjs',
  'tests/setup/electron-mock.ts',
  'vitest.config.ts',
]

const ALIASES = [
  ['@shared/', 'src/shared/'],
  ['@/', 'src/renderer/src/'],
]

const EXT_TRY = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md', '.html', '.svg', '.png', '.node']
const INDEX_TRY = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.json']

const IMPORT_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g
// 运行时会去读的字符串路径（限定后缀，避免把普通文本当路径）
const STRING_PATH_RE = /['"]([^'"\n]*\.(?:json|md|css|html|js|mjs|cjs|ts|tsx|node))['"]/g

function tryResolve(fromFile, spec) {
  const bases = []
  if (spec.startsWith('.')) {
    bases.push(path.resolve(path.dirname(fromFile), spec))
  } else {
    for (const [a, t] of ALIASES) {
      if (spec.startsWith(a)) {
        bases.push(path.resolve(root, t + spec.slice(a.length)))
        break
      }
    }
  }
  for (const b of bases) {
    for (const ext of EXT_TRY) {
      const p = b + ext
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
    }
    for (const i of INDEX_TRY) {
      const p = path.join(b, i)
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
    }
  }
  return null
}

function read(f) {
  try { return fs.readFileSync(f, 'utf8') } catch { return '' }
}

function walk(dir, out = []) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '__pycache__' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** 从入口集合出发的静态依赖追踪 */
function trace(entries) {
  const seen = new Set()
  const stack = entries.map(e => path.join(root, e)).filter(f => fs.existsSync(f))
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    const src = read(f)
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]
      if (spec.startsWith('bun:') || spec.startsWith('node:')) continue
      if (!spec.startsWith('.') && !ALIASES.some(([a]) => spec.startsWith(a))) continue
      const hit = tryResolve(f, spec)
      if (hit) stack.push(hit)
    }
  }
  return seen
}

/**
 * 收集「被字符串路径引用」的文件（运行时动态加载）。
 * 只扫描真正被应用/测试引用的代码 —— 否则死代码之间互相写字符串路径会互相"担保"。
 */
function stringReferenced(files, sources) {
  const hits = new Set()
  for (const f of sources) {
    const src = read(f)
    if (!src) continue
    for (const m of src.matchAll(STRING_PATH_RE)) {
      const raw = m[1]
      if (!raw.includes('/') && !raw.includes('\\')) continue
      if (raw.length > 200) continue
      const cands = [path.resolve(path.dirname(f), raw), path.resolve(root, raw)]
      for (const c of cands) {
        if (files.has(c)) hits.add(c)
      }
    }
  }
  return hits
}

const rel = p => path.relative(root, p).split(path.sep).join('/')

function main() {
  const args = process.argv.slice(2)
  const listMode = args.includes('--list')
  const filter = args.find(a => !a.startsWith('--'))

  const appSeen = trace(APP_ENTRIES)
  const testSeen = trace(TEST_ENTRIES)
  const allSrc = walk(path.join(root, 'src'))
  const appAbs = new Set([...appSeen].map(p => path.resolve(p)))
  const testAbs = new Set([...testSeen].map(p => path.resolve(p)))
  const liveSources = [...appSeen, ...testSeen].map(p => path.resolve(p))
  const strRef = stringReferenced(new Set(allSrc.map(p => path.resolve(p))), liveSources)

  const rows = new Map()
  const orphans = []
  for (const f of allSrc) {
    const r = rel(f)
    const top = r.split('/').slice(0, 2).join('/')
    if (!rows.has(top)) rows.set(top, { total: 0, app: 0, test: 0, str: 0 })
    const row = rows.get(top)
    row.total++
    const abs = path.resolve(f)
    if (appAbs.has(abs)) row.app++
    else if (testAbs.has(abs)) row.test++
    else if (strRef.has(abs)) row.str++
    else orphans.push(r)
  }

  const dead = [...rows.entries()].filter(([, v]) => v.app === 0)
  const deadFiles = dead.reduce((n, [, v]) => n + v.total, 0)

  console.log(`应用入口：${APP_ENTRIES.join(', ')}`)
  const sum = k => [...rows.values()].reduce((n, v) => n + v[k], 0)
  console.log(`src/ 文件总数 ${allSrc.length}：应用引用 ${sum('app')}，仅测试引用 ${sum('test')}，仅字符串/动态引用 ${sum('str')}，孤儿 ${orphans.length}`)
  console.log('')

  const show = [...rows.entries()]
    .filter(([top]) => !filter || top.startsWith(filter.replace(/\/$/, '')))
    .sort((a, b) => (b[1].total - b[1].app) - (a[1].total - a[1].app))

  console.log('目录'.padEnd(30) + '总数'.padStart(6) + '应用'.padStart(6) + '测试'.padStart(6) + '字符串'.padStart(7))
  console.log('-'.repeat(58))
  for (const [top, v] of show) {
    const flag = v.app === 0 ? '  <== 应用未接入' : ''
    console.log(top.padEnd(30) + String(v.total).padStart(6) + String(v.app).padStart(6) + String(v.test).padStart(6) + String(v.str).padStart(7) + flag)
  }
  console.log('-'.repeat(58))
  console.log(`应用完全未接入的目录：${dead.length} 个，文件 ${deadFiles} 个；孤儿文件（连测试/字符串都没引用）：${orphans.length} 个`)

  if (listMode) {
    console.log('\n孤儿文件清单：')
    const scoped = filter ? orphans.filter(o => o.startsWith(filter.replace(/\/$/, ''))) : orphans
    for (const o of scoped) console.log('  ' + o)
  }
}

main()
