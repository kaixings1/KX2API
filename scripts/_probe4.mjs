import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// 全景量化：把「Claude 风格名」按用途分类，看哪些是"工具名匹配"（必须统一），
// 哪些只是"权限规则里的样例文案"（不影响功能）。

const OLD = ['ListFiles', 'StrReplaceEditor', 'WebExtractor', 'WebSearch', 'CodeInterpreter', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'MultiFileEdit']

const buckets = {
  '生产代码（非测试）': [],
  '测试代码': [],
}

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const txt = readFileSync(full, 'utf-8')
      const lines = txt.split(/\r?\n/)
      let count = 0
      for (const l of lines) {
        for (const n of OLD) {
          if (l.includes(`'${n}'`) || l.includes(`"${n}"`)) { count++; break }
        }
      }
      if (count === 0) continue
      const isTest = full.includes('__tests__') || full.includes('\\tests\\')
      const key = isTest ? '测试代码' : '生产代码（非测试）'
      buckets[key].push({ file: full.replace(process.cwd() + '\\', ''), count })
    }
  }
}

walk('src')

for (const [k, arr] of Object.entries(buckets)) {
  const total = arr.reduce((s, x) => s + x.count, 0)
  console.log(`\n=== ${k}：${arr.length} 个文件，${total} 处 ===`)
  for (const x of arr.sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(x.count).padStart(3)}  ${x.file}`)
  }
}
