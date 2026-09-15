#!/usr/bin/env node
/**
 * scripts/check-repo.mjs — 全仓库「有没有进入本系统」体检
 *
 * 在 check-integration.mjs（只查 src/）的基础上，把仓库顶层也纳入：
 * 哪些顶层目录/文件被应用构建真正引用，哪些只是历史副本、抓包产物、一次性脚本。
 *
 * 输出：
 *   - 控制台：精简汇总
 *   - docs/integration-report.md：完整报告（含全部孤儿文件清单）
 *
 * 用法：
 *   node scripts/check-repo.mjs
 *   node scripts/check-repo.mjs --no-write     # 只打印，不写报告文件
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const APP_ENTRIES = [
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/main.tsx',
]
const TEST_ENTRIES = [
  'tests/agent/run.mjs',
  'tests/management/run.mjs',
  'tests/setup/electron-mock.ts',
  'vitest.config.ts',
]
/** 构建链路本身（改了会影响打包） */
const BUILD_FILES = [
  'package.json',
  'package-lock.json',
  'electron.vite.config.ts',
  'vitest.config.ts',
  'tailwind.config.ts',
  'postcss.config.cjs',
  'tsconfig.json',
  'run.bat',
  'run_prod.bat',
]

const ALIASES = [
  ['@shared/', 'src/shared/'],
  ['@/', 'src/renderer/src/'],
]
const EXT_TRY = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md', '.html', '.svg', '.png', '.node', '.wasm']
const INDEX_TRY = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.json']
const IMPORT_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g

const IGNORE_DIRS = new Set(['node_modules', '.git', '__pycache__'])

function read(f) {
  try { return fs.readFileSync(f, 'utf8') } catch { return '' }
}

function tryResolve(fromFile, spec) {
  const bases = []
  if (spec.startsWith('.')) bases.push(path.resolve(path.dirname(fromFile), spec))
  else for (const [a, t] of ALIASES) {
    if (spec.startsWith(a)) { bases.push(path.resolve(root, t + spec.slice(a.length))); break }
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

function walk(dir, out = []) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function trace(entries) {
  const seen = new Set()
  const stack = entries.map(e => path.join(root, e)).filter(f => fs.existsSync(f))
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    const src = read(f)
    if (!src) continue
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

const rel = p => path.relative(root, p).split(path.sep).join('/')

function human(bytes) {
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i === 0 ? 0 : 1)}${u[i]}`
}

/** 顶层项分类 */
const CLASSIFY = {
  runtime: ['src', '.doge', '.kx2code'],
  build: ['build', 'out', 'package.json', 'package-lock.json', 'electron.vite.config.ts', 'vitest.config.ts', 'tailwind.config.ts', 'postcss.config.cjs', 'tsconfig.json', 'run.bat', 'run_prod.bat', '.github'],
  test: ['tests', 'test-loader.mjs', 'test_e2e.ts'],
  docs: ['docs', 'README.md', 'CLAUDE.md', 'LICENSE', 'PLANNING.md', 'REFACTOR_PLAN.md', 'TASK.md'],
  manual: ['capture', 'diagnostic_tool', 'tool_queue_extractor', 'tools', 'scripts', 'config', 'skills', 'dev', 'project', 'self-test-patch-project'],
  backup: ['src--', 'src2026', 'src20260913', 'src20260914'],
  legacy: ['legacy'],
  artifact: ['release', 'out_test', 'logs', 'latest', 'debug.txt', 'log.txt', 'trace.log', '0', '.pytest_cache'],
}
const BACKUP_RE = /\.(rar|zip|7z|bak|backup)$/i
const JUNK_RE = /^(_|\.)|^stepfun|^loop-(request|response)|^chat_stepfun|^Cookies$|_analysis|_inspect|isolated_files|\.cjs$/

function classify(name) {
  const clean = name.replace(/\/$/, '')
  for (const [k, list] of Object.entries(CLASSIFY)) {
    if (list.includes(clean)) return k
  }
  if (BACKUP_RE.test(clean)) return 'backup'
  if (JUNK_RE.test(clean)) return 'junk'
  return 'unknown'
}

const CLASS_LABEL = {
  runtime: '应用运行时',
  build: '构建/打包',
  test: '测试链路',
  docs: '文档',
  manual: '人工使用（脚本/参考数据）',
  backup: '历史副本（可删）',
  artifact: '生成物/日志（可删）',
  legacy: '旧代码归档（已移出构建链路）',
  junk: '一次性产物（可删）',
  unknown: '未分类',
}

/** 顶层目录「这是什么」的说明——只对确定的部分标注 */
const DIR_NOTES = {
  build: '打包资源（icon 等），被 electron-builder 使用',
  capture: '抓包脚本（配合 Edge 9222 调试端口），手动运行',
  config: '配置样例/预设，未被代码读取',
  dev: '开发用临时脚本',
  diagnostic_tool: '诊断脚本（Python）',
  docs: '文档',
  logs: '运行时日志输出目录',
  out: 'electron-vite 构建产物（生成物）',
  out_test: '旧的测试构建产物（生成物）',
  project: '独立的小项目/示例，未被主程序引用',
  release: 'electron-builder 打包产物（生成物）',
  scripts: '构建/发布/自检脚本（npm run 会用到其中部分）',
  'self-test-patch-project': '自测用补丁样例项目',
  legacy: '旧代码归档：从 src/ 移出的未接入代码，保留供移植参考，不参与构建',
  skills: '技能样例数据（可被用户导入，非代码依赖）',
  src: '主源码',
  'src--': '历史备份副本（旧版本源码）',
  src2026: '历史备份副本（旧版本源码）',
  src20260913: '历史备份副本（旧版本源码）',
  src20260914: '历史备份副本（旧版本源码）',
  tests: '测试用例（node:test / 独立脚本两套）',
  tool_queue_extractor: '抓包用的工具队列提取器（Python）',
  tools: '独立工具脚本（tsx 直接运行），未被主程序引用',
}

function main() {
  const noWrite = process.argv.includes('--no-write')
  const appSeen = trace(APP_ENTRIES)
  const testSeen = trace(TEST_ENTRIES)
  const appAbs = new Set([...appSeen].map(p => path.resolve(p)))
  const testAbs = new Set([...testSeen].map(p => path.resolve(p)))

  // 根目录直接子项逐个统计
  const tops = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => !IGNORE_DIRS.has(e.name) && !e.name.startsWith('.'))

  const rows = []
  for (const e of tops) {
    const full = path.join(root, e.name)
    if (e.isDirectory()) {
      const files = walk(full)
      let size = 0
      let app = 0
      let test = 0
      for (const f of files) {
        try { size += fs.statSync(f).size } catch { /* ignore */ }
        const a = path.resolve(f)
        if (appAbs.has(a)) app++
        else if (testAbs.has(a)) test++
      }
      rows.push({ name: e.name + '/', type: 'dir', files: files.length, size, app, test, cls: classify(e.name), note: DIR_NOTES[e.name] || '' })
    } else {
      const size = fs.statSync(full).size
      const isBuild = BUILD_FILES.includes(e.name)
      const referenced = appAbs.has(path.resolve(full))
      rows.push({
        name: e.name,
        type: 'file',
        files: 1,
        size,
        app: referenced ? 1 : 0,
        test: testAbs.has(path.resolve(full)) ? 1 : 0,
        cls: isBuild ? 'build' : classify(e.name),
        note: isBuild ? '构建/运行配置' : '',
      })
    }
  }

  rows.sort((a, b) => (b.files - b.app) - (a.files - a.app) || b.size - a.size)

  const deadDirs = rows.filter(r => r.type === 'dir' && r.app === 0)
  const deadFiles = deadDirs.reduce((n, r) => n + r.files, 0)
  const orphanRootFiles = rows.filter(r => r.type === 'file' && r.app === 0)

  console.log(`顶层项：${rows.length} 个；完全没被应用引用的目录 ${deadDirs.length} 个（${deadFiles} 个文件）`)
  console.log('')
  console.log('顶层项'.padEnd(26) + '分类'.padEnd(20) + '文件'.padStart(7) + '大小'.padStart(10) + '应用'.padStart(6))
  console.log('-'.repeat(76))
  for (const r of rows.slice(0, 36)) {
    console.log(r.name.padEnd(26) + (CLASS_LABEL[r.cls] || r.cls).padEnd(20) + String(r.files).padStart(7) + human(r.size).padStart(10) + String(r.app).padStart(6))
  }
  console.log('-'.repeat(76))

  const byClass = new Map()
  for (const r of rows) {
    if (!byClass.has(r.cls)) byClass.set(r.cls, { files: 0, size: 0 })
    const c = byClass.get(r.cls)
    c.files += r.files
    c.size += r.size
  }
  console.log('按分类汇总：')
  for (const [cls, v] of [...byClass.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${(CLASS_LABEL[cls] || cls).padEnd(24)} ${String(v.files).padStart(7)} 个文件  ${human(v.size).padStart(9)}`)
  }
  console.log(`未被应用引用的根目录文件：${orphanRootFiles.length} 个`)

  if (noWrite) return

  // 生成完整报告
  const srcRows = new Map()
  const orphans = []
  for (const f of walk(path.join(root, 'src'))) {
    const r = rel(f)
    const top = r.split('/').slice(0, 2).join('/')
    if (!srcRows.has(top)) srcRows.set(top, { total: 0, app: 0, test: 0 })
    const row = srcRows.get(top)
    row.total++
    const a = path.resolve(f)
    if (appAbs.has(a)) row.app++
    else if (testAbs.has(a)) row.test++
    else orphans.push(r)
  }

  const lines = []
  lines.push('# 代码接入体检报告')
  lines.push('')
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push('')
  lines.push('三档口径：**应用引用**（从 4 个真实入口可达）／**仅测试引用**／**孤儿**（两边都不可达）。')
  lines.push('')
  lines.push('## 一、仓库顶层')
  lines.push('')
  lines.push('| 顶层项 | 分类 | 文件数 | 大小 | 应用引用 | 说明 |')
  lines.push('| --- | --- | ---: | ---: | ---: | --- |')
  for (const r of rows) {
    lines.push(`| \`${r.name}\` | ${CLASS_LABEL[r.cls] || r.cls} | ${r.files} | ${human(r.size)} | ${r.app}${r.app === 0 ? ' ⚠️' : ''} | ${r.note || ''} |`)
  }
  lines.push('')
  lines.push('## 二、src/ 各目录接入情况')
  lines.push('')
  lines.push('| 目录 | 文件数 | 应用引用 | 仅测试 | 孤儿 |')
  lines.push('| --- | ---: | ---: | ---: | ---: |')
  for (const [top, v] of [...srcRows.entries()].sort((a, b) => b[1].total - a[1].total)) {
    lines.push(`| \`${top}\` | ${v.total} | ${v.app} | ${v.test} | ${v.total - v.app - v.test} |`)
  }
  lines.push('')
  lines.push(`## 三、孤儿文件清单（${orphans.length} 个）`)
  lines.push('')
  const byDir = new Map()
  for (const o of orphans) {
    const d = o.split('/').slice(0, 3).join('/')
    if (!byDir.has(d)) byDir.set(d, [])
    byDir.get(d).push(o)
  }
  for (const [d, files] of [...byDir.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`<details><summary><code>${d}</code> — ${files.length} 个</summary>`)
    lines.push('')
    for (const f of files) lines.push('- `' + f + '`')
    lines.push('')
    lines.push('</details>')
    lines.push('')
  }
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/integration-report.md'), lines.join('\n'), 'utf8')
  console.log('\n完整报告已写入 docs/integration-report.md')
}

main()
