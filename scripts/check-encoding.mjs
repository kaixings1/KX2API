#!/usr/bin/env node
/**
 * scripts/check-encoding.mjs — 文本编码体检
 *
 * 回答「源码里有没有被写坏的字符」。
 *
 * 背景：本项目源码含大量中文注释/文案/关键词表。若写入时发生编码事故
 * （按字节截断多字节字符、或用了非 UTF-8 编码），中文会被替换成
 * U+FFFD（即 U+FFFD 替换字符，显示为一个黑底问号/菱形问号）。
 * 这类损坏**不会**让 JS/TS 立刻报错：
 *   - 落在注释里 → 完全静默，只是语义丢失；
 *   - 落在字符串里 → 静默改变文案（如「未知错误」被咬掉一两个字）；
 *   - 落在关键词表里 → 静默降低检索命中率；
 *   - 落在标识符/标点里 → 才会编译失败，且报错信息常是
 *     「File appears to be binary / ',' expected」，极难反推。
 * 因此需要独立体检，而不是依赖编译器。
 *
 * 检查项：
 *   1. U+FFFD 替换字符（编码事故的确定信号）
 *   2. UTF-8 BOM（会让部分工具把它当内容的一部分）
 *   3. 孤立代理项（U+D800–U+DFFF 未成对出现）
 *   4. 非 UTF-8 字节序列（严格解码失败）
 *   5. C0/C1 控制字符（除 \t \n \r）
 *   6. CRLF / LF 混用（同一次批量替换里最易踩的坑）
 *
 * 用法：
 *   node scripts/check-encoding.mjs                 # 扫全仓库（默认 src + tests + scripts）
 *   node scripts/check-encoding.mjs src             # 只扫指定目录
 *   node scripts/check-encoding.mjs --all           # 连 docs/ 等一起扫
 *   node scripts/check-encoding.mjs --quiet         # 只输出结论（供 CI / 钩子使用）
 *
 * 退出码：0 = 干净；1 = 发现问题（便于接入 CI / pre-commit）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 默认扫描范围（源码与脚本；--all 时追加文档等） */
const DEFAULT_ROOTS = ['src', 'tests', 'scripts']
const EXTRA_ROOTS = ['docs', 'tools', 'config', 'capture', 'skills']

/** 只看这些后缀的文本文件 */
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.css', '.html', '.yml', '.yaml',
  '.txt', '.xml', '.svg',
])

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'release', 'dist', 'coverage', '__pycache__'])

const FFFD = '\uFFFD'

/** 严格 UTF-8 解码器：失败即说明存在非法字节序列 */
const strictDecoder = new TextDecoder('utf-8', { fatal: true })

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

/**
 * 把一个字节偏移换算成「行:列」。
 * 列按**字符**计（而非字节），这样与编辑器的光标位置一致。
 */
function offsetToLineCol(buf, offset) {
  const before = buf.subarray(0, offset).toString('utf-8')
  const lines = before.split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return { line, col }
}

/** 取该偏移所在行的原文，便于肉眼核对 */
function lineTextAt(buf, offset) {
  const s = buf.toString('utf-8')
  const before = buf.subarray(0, offset).toString('utf-8')
  const lineStart = before.lastIndexOf('\n') + 1
  const lineEnd = s.indexOf('\n', lineStart)
  const line = s.slice(lineStart, lineEnd === -1 ? s.length : lineEnd)
  return line.trim()
}

function checkFile(file) {
  let buf
  try {
    buf = fs.readFileSync(file)
  } catch {
    return { issues: [], skipped: true }
  }
  const issues = []

  // ── 1. UTF-8 BOM ──
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    issues.push({ kind: 'BOM', offset: 0, detail: '文件以 UTF-8 BOM 开头' })
  }

  // ── 2. 严格解码（非 UTF-8 字节序列） ──
  let text = null
  try {
    text = strictDecoder.decode(buf)
  } catch {
    // 定位第一个非法字节
    for (let i = 0; i < buf.length; i++) {
      try {
        strictDecoder.decode(buf.subarray(i, Math.min(i + 4, buf.length)))
      } catch {
        const { line, col } = offsetToLineCol(buf, i)
        issues.push({
          kind: '非UTF8',
          offset: i,
          line,
          col,
          detail: `非法字节 0x${buf[i].toString(16).padStart(2, '0')}`,
        })
        break
      }
    }
  }

  // 后面的检查都基于宽松解码（保证总能跑完）
  if (text === null) text = buf.toString('utf-8')

  // ── 3. U+FFFD（编码事故的确定信号） ──
  let idx = text.indexOf(FFFD)
  while (idx !== -1) {
    // 由字符下标回推字节偏移，才能给出准确行列
    const byteOffset = Buffer.byteLength(text.slice(0, idx), 'utf-8')
    const { line, col } = offsetToLineCol(buf, byteOffset)
    issues.push({
      kind: 'U+FFFD',
      offset: byteOffset,
      line,
      col,
      detail: `替换字符（原字已丢失）`,
      context: lineTextAt(buf, byteOffset),
    })
    idx = text.indexOf(FFFD, idx + 1)
  }

  // ── 4. 孤立代理项 ──
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        const byteOffset = Buffer.byteLength(text.slice(0, i), 'utf-8')
        const { line, col } = offsetToLineCol(buf, byteOffset)
        issues.push({ kind: '孤立代理项', offset: byteOffset, line, col, detail: '高位代理未配对' })
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      const prev = text.charCodeAt(i - 1)
      if (!(prev >= 0xd800 && prev <= 0xdbff)) {
        const byteOffset = Buffer.byteLength(text.slice(0, i), 'utf-8')
        const { line, col } = offsetToLineCol(buf, byteOffset)
        issues.push({ kind: '孤立代理项', offset: byteOffset, line, col, detail: '低位代理未配对' })
      }
    }
  }

  // ── 5. C0/C1 控制字符（\t \n \r 除外） ──
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    const isC0 = b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d
    const isDEL = b === 0x7f
    if (isC0 || isDEL) {
      const { line, col } = offsetToLineCol(buf, i)
      issues.push({
        kind: '控制字符',
        offset: i,
        line,
        col,
        detail: `0x${b.toString(16).padStart(2, '0')}`,
        context: lineTextAt(buf, i),
      })
      // 同一行只报一次，避免刷屏
      const nl = buf.indexOf(0x0a, i)
      i = nl === -1 ? buf.length : nl
    }
  }

  // ── 6. CRLF / LF 混用 ──
  const crlf = (text.match(/\r\n/g) || []).length
  const lf = (text.match(/(?<!\r)\n/g) || []).length
  if (crlf > 0 && lf > 0) {
    issues.push({
      kind: '换行混用',
      offset: 0,
      detail: `CRLF ${crlf} 处 / LF ${lf} 处（多行替换易静默失配）`,
    })
  }

  return { issues, skipped: false }
}

function main() {
  const args = process.argv.slice(2)
  const quiet = args.includes('--quiet')
  const all = args.includes('--all')
  const dirArg = args.find(a => !a.startsWith('--'))

  const roots = dirArg
    ? [dirArg]
    : all
      ? [...DEFAULT_ROOTS, ...EXTRA_ROOTS]
      : DEFAULT_ROOTS

  const files = []
  for (const r of roots) walk(path.resolve(root, r), files)

  const report = []
  let issueCount = 0
  let filesWithIssues = 0
  let mixedEol = 0

  for (const f of files) {
    const { issues } = checkFile(f)
    if (issues.length === 0) continue
    filesWithIssues++
    issueCount += issues.length
    for (const i of issues) if (i.kind === '换行混用') mixedEol++
    report.push({ file: rel(f), issues })
  }

  // 换行混用单独归类（数量大时不适合按严重问题对待，但仍需知晓）
  const serious = report.filter(r => r.issues.some(i => i.kind !== '换行混用'))

  if (!quiet) {
    if (serious.length === 0) {
      console.log(`编码体检通过：扫描 ${files.length} 个文本文件，未发现 U+FFFD / BOM / 非法字节 / 控制字符。`)
    } else {
      console.log(`编码体检发现 ${serious.length} 个文件存在问题：\n`)
      for (const r of serious) {
        console.log('  ' + r.file)
        for (const i of r.issues) {
          if (i.kind === '换行混用') continue
          const pos = i.line ? `${i.line}:${i.col}` : `offset ${i.offset}`
          console.log(`    [${i.kind}] ${pos}  ${i.detail}`)
          if (i.context) console.log(`        上下文: ${i.context}`)
        }
      }
      console.log('')
    }

    const eolFiles = report.filter(r => r.issues.some(i => i.kind === '换行混用'))
    if (eolFiles.length > 0) {
      console.log(`另有 ${eolFiles.length} 个文件存在 CRLF/LF 混用（不阻断，但批量替换时易静默失配）：`)
      for (const r of eolFiles.slice(0, 10)) {
        const d = r.issues.find(i => i.kind === '换行混用')
        console.log(`  ${r.file} — ${d.detail}`)
      }
      if (eolFiles.length > 10) console.log(`  … 其余 ${eolFiles.length - 10} 个省略`)
      console.log('')
    }
  } else if (serious.length > 0) {
    for (const r of serious) {
      for (const i of r.issues) {
        if (i.kind === '换行混用') continue
        console.log(`${r.file}:${i.line ?? i.offset}: ${i.kind} ${i.detail}`)
      }
    }
  }

  const bad = serious.length
  console.log(
    `--- 扫描 ${files.length} 个文件：${bad} 个文件有编码问题，` +
      `${issueCount - mixedEol} 处实质问题，${mixedEol} 处换行混用 ---`,
  )

  process.exit(bad > 0 ? 1 : 0)
}

main()
