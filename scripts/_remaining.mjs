import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// 复扫生产代码里剩余的 Claude 风格名（排除注释行）
const OLD = ['ListFiles', 'StrReplaceEditor', 'WebExtractor', 'WebSearch', 'CodeInterpreter', 'MultiFileEdit']

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(e.name)) {
      if (full.includes('__tests__')) continue
      const txt = readFileSync(full, 'utf-8')
      const lines = txt.split(/\r?\n/)
      const hits = []
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
        for (const n of OLD) {
          if (lines[i].includes(`'${n}'`) || lines[i].includes(`"${n}"`)) {
            hits.push(`${i + 1}: ${t.slice(0, 140)}`)
            break
          }
        }
      }
      if (hits.length) {
        console.log(`\n===== ${full.replace(process.cwd() + '\\', '')} (${hits.length}) =====`)
        console.log(hits.join('\n'))
      }
    }
  }
}
walk('src')
