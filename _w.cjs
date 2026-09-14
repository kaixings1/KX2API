const fs = require('fs')
const fp = 'D:/KX2API/src/renderer/src/pages/Chat/ChatPage.tsx'
let t
try { t = fs.readFileSync(fp, 'utf8') } catch (e) { console.log(e.message); process.exit(0) }
const lines = t.split('\n')
lines.forEach((l, i) => {
  if (/对话配置|setConfig|Sheet|setShowConfig|showConfig|systemPrompt|config =|const \[config|profiles/i.test(l)) console.log(i + 1, l.trim().slice(0, 110))
})