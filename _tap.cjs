const fs = require('fs')
const files = {
  'engine/requestBuilder.ts': ['system', 'topic', 'reasoning'],
  'engine/messageLoop.ts': ['reasoning', 'system', 'tool'],
  'engine/streaming/streamProcessor.ts': ['reasoning', 'content_block', 'delta'],
  'main/proxy/adapters/prompt/BasePromptAdapter.ts': ['reasoning', 'system', 'success(1)'],
}
for (const rel of Object.keys(files)) {
  const fp = 'D:/KX2API/src/' + rel
  console.log('\n========== ' + rel + ' ==========')
  let txt
  try { txt = fs.readFileSync(fp, 'utf8') } catch (e) { console.log('  (读取失败: ' + e.message + ')'); continue }
  const lines = txt.split('\n')
  console.log('  总行数:', lines.length)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    for (const k of files[rel]) {
      if (l.toLowerCase().includes(k.toLowerCase())) {
        console.log('   ' + String(i + 1).padStart(4), l.trim().slice(0, 110))
        break
      }
    }
  }
}