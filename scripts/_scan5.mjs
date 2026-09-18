import { readFileSync } from 'node:fs'

// 直接给文件路径，列出其中所有「Claude 风格名」出现的位置
const OLD = ['ListFiles', 'StrReplaceEditor', 'WebExtractor', 'WebSearch', 'CodeInterpreter', 'MultiFileEdit', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']
const files = process.argv.slice(2)

for (const f of files) {
  const txt = readFileSync(f, 'utf-8')
  const lines = txt.split(/\r?\n/)
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    for (const n of OLD) {
      if (lines[i].includes(`'${n}'`) || lines[i].includes(`"${n}"`)) {
        hits.push(`${i + 1}: ${lines[i].trim().slice(0, 160)}`)
        break
      }
    }
  }
  console.log(`\n===== ${f} (${hits.length}) =====`)
  console.log(hits.join('\n'))
}
