const fs = require('node:fs')
const path = require('node:path')
// 在 K 全 src 中搜索 messageFormat 的函数名，确认是否已存在等价实现
const names = [
  'detectFormat', 'anthropicToOpenAI', 'openAIToAnthropic', 'vercelToOpenAI',
  'openAIToVercel', 'geminiToOpenAI', 'openAIToGemini', 'toOpenAI', 'fromOpenAI',
  'extractUserQuery', 'countTurns', 'extractToolCalls', 'MessageFormat',
  'parseJsonCodeBlock', 'removeComments', 'truncateAtSentence', 'concatenateEpisodes',
]
const files = []
;(function walk(d) {
  let es
  try { es = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of es) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})('D:/KX2API/src')
for (const n of names) {
  const hits = []
  for (const f of files) {
    try {
      const t = fs.readFileSync(f, 'utf8')
      if (new RegExp('(?:export\\s+|\\b)function\\s+' + n + '\\b|type\\s+' + n + '\\b|interface\\s+' + n + '\\b').test(t)) {
        hits.push(f.replace('D:/KX2API/', ''))
      }
    } catch {}
  }
  console.log(`${n.padEnd(24)} → ${hits.length ? '已存在: ' + hits.join(', ') : '缺失'}`)
}