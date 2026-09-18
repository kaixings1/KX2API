import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 找出仍在引用「Claude Code 风格工具名」的位置（这些名字本项目注册表里没有）
const OLD_NAMES = ['ListFiles', 'StrReplaceEditor', 'WebExtractor', 'WebSearch', 'CodeInterpreter', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']

const hits = []
function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      walk(full)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        for (const n of OLD_NAMES) {
          // 只找「作为字符串字面量出现」的，避免命中普通英文单词
          if (lines[i].includes(`'${n}'`) || lines[i].includes(`"${n}"`)) {
            hits.push(`[${n}] ${full.replace(process.cwd() + '\\', '')}:${i + 1}: ${lines[i].trim().slice(0, 110)}`)
          }
        }
      }
    }
  }
}

walk('src')
console.log(hits.join('\n'))
console.log(`\n--- ${hits.length} 处 ---`)
