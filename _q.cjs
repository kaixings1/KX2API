const fs = require('fs')
const rel = 'src/engine/api/client.ts'
const txt = fs.readFileSync('D:/KX2API/' + rel, 'utf8')
const lines = txt.split('\n')
console.log('总行数:', lines.length)
const keys = ['reasoning', 'onText', 'onToolUse', 'onDone', 'onError', 'MessageLoop', 'sendMessage']
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  for (const k of keys) {
    if (l.includes(k)) { console.log('   ' + String(i + 1).padStart(4), l.trim().slice(0, 120)); break }
  }
}