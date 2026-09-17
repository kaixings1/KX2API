#!/usr/bin/env node
/**
 * scripts/normalize-eol.mjs — 统一换行符
 *
 * 为什么需要：
 * 本仓库大部分文件是 CRLF，而用脚本批量插入的多行文本默认是 LF。
 * 两者混在同一个文件里会带来两个真实问题：
 *   1. 之后的「多行文本精确匹配」替换会**静默失配**（`\n` 匹配不到 `\r\n`），
 *      改了半天以为没生效，实际是模式没命中；
 *   2. git diff 出现整文件级的噪声。
 *
 * 策略：以该文件**原本占多数**的换行符为准，把少数派统一过去。
 * 这样既消除混用，又不会把一个原本 CRLF 的文件整体改成 LF（避免全文件 diff）。
 *
 * 用法：
 *   node scripts/normalize-eol.mjs            # 处理 src/tests/scripts
 *   node scripts/normalize-eol.mjs src        # 只处理指定目录
 *   node scripts/normalize-eol.mjs --dry-run  # 只报告，不写入
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.css', '.html', '.yml', '.yaml',
  '.txt', '.xml', '.svg',
])

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'release', 'dist', 'coverage', '__pycache__'])

function walk(dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (TEXT_EXT.has(path.extname(e.name).toLowerCase())) out.push(p)
  }
  return out
}

const rel = p => path.relative(root, p).split(path.sep).join('/')

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const dirArg = args.find(a => !a.startsWith('--'))
  const roots = dirArg ? [dirArg] : ['src', 'tests', 'scripts']

  const files = []
  for (const r of roots) walk(path.resolve(root, r), files)

  let changed = 0
  let inspected = 0

  for (const f of files) {
    let raw
    try {
      raw = fs.readFileSync(f, 'utf-8')
    } catch {
      continue
    }
    inspected++

    const crlf = (raw.match(/\r\n/g) || []).length
    const lf = (raw.match(/(?<!\r)\n/g) || []).length
    if (crlf === 0 || lf === 0) continue // 未混用

    // 以多数派为准
    const useCRLF = crlf >= lf
    const normalized = useCRLF
      ? raw.replace(/\r?\n/g, '\r\n')
      : raw.replace(/\r\n/g, '\n')

    if (normalized === raw) continue

    if (!dryRun) fs.writeFileSync(f, normalized)
    changed++
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${rel(f)} — CRLF ${crlf} / LF ${lf} → 统一为 ${useCRLF ? 'CRLF' : 'LF'}`,
    )
  }

  console.log(`\n--- 扫描 ${inspected} 个文件，${dryRun ? '待统一' : '已统一'} ${changed} 个 ---`)
}

main()
