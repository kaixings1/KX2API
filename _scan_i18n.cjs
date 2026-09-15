const fs = require('fs')
const c = fs.readFileSync('src/renderer/src/i18n/locales/zh-CN.json', 'utf8')
const j = JSON.parse(c)
const tools = j.tools || {}
const keys = Object.keys(tools).sort()
console.log('工具管理翻译键总数:', keys.length)
console.log(keys.join('\n'))