const fs = require('fs')
const files = {
  'src/main/profiles/manager.ts': ['interface Profile', 'systemPrompt', 'PresetData', 'toEngineConfig', 'maxToolRounds', 'maxRepeat'],
  'src/main/engine-bridge.ts': ['updateEngineApiClient', 'updateConfig', 'systemPrompt', 'CHAT_SET_CONFIG', 'KX2_PROMPT'],
  'src/main/ipc/chat-handlers.ts': ['CHAT_SET_CONFIG', 'updateEngineApi', 'systemPrompt', 'updateConfig'],
  'src/engine/requestBuilder.ts': ['system', 'role: "system"', 'messages.push', 'spec.system'],
}
for (const rel of Object.keys(files)) {
  const fp = 'D:/KX2API/' + rel
  console.log('\n====== ' + rel + ' ======')
  let txt
  try { txt = fs.readFileSync(fp, 'utf8') } catch (e) { console.log('  (读取失败 ' + e.message + ')'); continue }
  const lines = txt.split('\n')
  console.log('  总行数:', lines.length)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    for (const k of files[rel]) {
      if (l.includes(k)) { console.log(' ' + String(i + 1).padStart(5), l.trim().slice(0, 115)); break }
    }
  }
}