import { readFileSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 清理「孤立空壳 .d.ts」：既无同名 .ts，也无实际类型内容的编译残留。
 *
 * 这批的来源：tests/engine/legacy/ 下的测试文件曾被移走/搬移，
 * 但它们的 .d.ts 编译产物留了下来，成为无主残留。
 *
 * 三重确认后才删（避免误删手写声明）：
 *   1. 内容去注释后仅为 export {} 或空
 *   2. 同目录（及全仓库常见的对应位置）无同名 .ts
 *   3. 全仓库无任何文件按文件名引用它
 */
const dirs = ['tests/engine/legacy']
const repoRoots = ['src', 'tests', 'scripts', 'tools']

function walkFiles(dir, ext = null) {
  const out = []
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...walkFiles(full, ext))
    else if (!ext || full.endsWith(ext)) out.push(full)
  }
  return out
}

// 采集全仓库所有文件内容用于「引用检查」
const allFiles = []
for (const r of repoRoots) allFiles.push(...walkFiles(r))

let removed = 0
for (const dir of dirs) {
  let names
  try { names = readdirSync(dir) } catch { continue }
  for (const name of names) {
    if (!name.endsWith('.d.ts')) continue
    const full = join(dir, name)

    // 条件 1：空壳
    const txt = readFileSync(full, 'utf-8')
    const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim()
    if (stripped !== '' && stripped !== 'export {};' && stripped !== 'export {}') {
      console.log(`保留（有实质内容）: ${full}`)
      continue
    }

    // 条件 2：同名 .ts 是否存在（检查常见位置）
    const stem = name.replace(/\.d\.ts$/, '')
    const candidates = [
      join(dir, stem + '.ts'),
      join('src/engine/__tests__', stem + '.ts'),
      join('src/__tests__/engine', stem + '.ts'),
      join('src/main/__tests__', stem + '.ts'),
    ]
    const impl = candidates.find(p => existsSync(p))
    if (impl) {
      console.log(`保留（实现在 ${impl}）: ${full}`)
      continue
    }

    // 条件 3：是否被按名引用
    const referenced = allFiles.some(f => {
      if (f === full) return false
      try {
        return readFileSync(f, 'utf-8').includes(name)
      } catch {
        return false
      }
    })
    if (referenced) {
      console.log(`保留（被引用）: ${full}`)
      continue
    }

    unlinkSync(full)
    removed++
    console.log(`已删除: ${full}`)
  }
}

console.log(`\n--- 删除 ${removed} 个孤立空壳 .d.ts ---`)
