const fs = require('node:fs')
const path = require('node:path')
// 目标模块导出的关键函数名（先用通用导出名扫描，再读具体文件核对）
const kRoot = 'D:/KX2API/src'
const files = []
;(function walk(d) {
  let entries
  try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})(kRoot)
console.log('K src 文件数：' + files.length)
// 提取所有 export 函数/const/class 名
const allNames = new Set()
for (const f of files) {
  try {
    const t = fs.readFileSync(f, 'utf8')
    for (const m of t.matchAll(/(?:export\s+)(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)) {
      allNames.add(m[1])
    }
  } catch {}
}
console.log('K 全 src 已导出名（共 ' + allNames.size + '）：')
// 候选函数名
const wanted = [
  'intersperse','uniq','objectGroupBy','groupBy','parseXml','xmlToJson','mergeDeep',
  'deepMerge','escapeHtml','htmlToText','unescapeHtml','validateUuid','createAgentId',
  'intersperseBetween','formatCompact','relativeTime','normalizeIntl',
]
for (const fn of wanted) {
  console.log(`  ${fn.padEnd(22)} → ${allNames.has(fn) ? '已经存在!' : '缺失'}`)
}