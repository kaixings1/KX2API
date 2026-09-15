#!/usr/bin/env node
/**
 * scripts/check-integration.mjs — 代码接入体检
 *
 * 用途：回答「src/ 下某个目录/功能到底有没有真正被应用使用」。
 * 做法：从三个真实入口出发做静态依赖追踪，得到「可达文件集合」，
 *       再与 src/ 下的实际文件做对比。
 *
 * 注意：这是静态分析 —— 只跟踪 import / import() / 别名（@、@shared）。
 * 运行时用字符串拼路径加载的代码不会被算进来（正常项目不应这么做）。
 *
 * 用法：
 *   node scripts/check-integration.mjs            # 全量体检
 *   node scripts/check-integration.mjs src/commands   # 只看某个目录
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ENTRIES = [
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/main.tsx',
]

const ALIASES = [
  ['@shared/', 'src/shared/'],
  ['@/', 'src/renderer/src/'],
]

const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

function tryResolve(fromFile, spec) {
  const cands = []
  if (spec.startsWith('.')) {
    const p = path.resolve(path.dirname(fromFile), spec)
    cands.push(p, p + '.ts', p + '.tsx', p + '.js', p + '.jsx',
      p.replace(/\.js$/, '.ts'), p.replace(/\.js$/, '.tsx'),
      path.join(p, 'index.ts'), path.join(p, 'index.tsx'), path.join(p, 'index.js'))
  } else {
    for (const [a, t] of ALIASES) {
      if (spec.startsWith(a)) {
        const p = path.resolve(root, t + spec.slice(a.length))
        cands.push(p, p + '.ts', p + '.tsx', p + '.js', p + '.jsx',
          path.join(p, 'index.ts'), path.join(p, 'index.tsx'), path.join(p, 'index.js'))
        break
      }
    }
  }
  for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  return null
}

function scanImports(file) {
  let src = ''
  try { src = fs.readFileSync(file, 'utf8') } catch { return [] }
  return [...src.matchAll(IMPORT_RE)].map(m => m[1])
}

function reachable(entries) {
  const seen = new Set()
  const missing = new Map()
  const bunModules = new Set()
  const stack = entries.filter(e => fs.existsSync(e)).map(e => path.resolve(e))
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    for (const spec of scanImports(f)) {
      if (spec.startsWith('bun:')) { bunModules.add(spec); continue }
      if (!spec.startsWith('.') && !ALIASES.some(([a]) => spec.startsWith(a))) continue
      const hit = tryResolve(f, spec)
      if (hit) stack.push(hit)
      else if (!missing.has(spec)) missing.set(spec, f)
    }
  }
  return { seen, missing, bunModules }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__pycache__') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const rel = p => path.relative(root, p).split(path.sep).join('/')

function main() {
  const filter = process.argv[2]
  const { seen, bunModules } = reachable(ENTRIES.map(e => path.join(root, e)))
  const seenAbs = new Set([...seen].map(p => path.resolve(p)))

  const srcFiles = walk(path.join(root, 'src'))
  const byDir = new Map()
  for (const f of srcFiles) {
    const r = rel(f)
    const top = r.split('/').slice(0, 2).join('/')
    if (!byDir.has(top)) byDir.set(top, [0, 0])
    const s = byDir.get(top)
    s[0]++
    if (seenAbs.has(path.resolve(f))) s[1]++
  }

  console.log('入口：' + ENTRIES.join(', '))
  console.log('可达文件：' + seenAbs.size + '     src/ 文件总数：' + srcFiles.length)
  if (bunModules.size) console.log('Bun 专属模块引用：' + [...bunModules].join(', '))
  console.log()
  console.log('目录'.padEnd(30) + '文件数'.padStart(8) + '已接入'.padStart(8))
  console.log('-'.repeat(60))

  let deadTop = 0
  let deadFiles = 0
  for (const [top, [total, used]] of [...byDir.entries()].sort((a, b) => (b[1][0] - b[1][1]) - (a[1][0] - a[1][1]))) {
    if (filter && !top.startsWith(filter.replace(/\/$/, ''))) continue
    const flag = used === 0 ? '   <== 完全没有接入' : ''
    console.log(top.padEnd(34) + String(total).padStart(8) + String(used).padStart(8) + flag)
    if (used === 0) { deadTop++; deadFiles += total }
  }
  console.log('-'.repeat(60))
  console.log(`完全没有接入的目录：${deadTop} 个，涉及文件 ${deadFiles} 个`)
}

main()
