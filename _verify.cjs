const fs = require('fs')
const c = fs.readFileSync('src/main/ipc/handlers.ts', 'utf8')
const checks = [
  ['GET_BY_ID 用 getTool', /const tool = toolManager\.getTool\(id\)/],
  ['RESET 清理生效组', /config\.enabledToolGroups && config\.enabledToolGroups\.length > 0/],
  ['REMOVE_GROUP 剔除引用', /active\.includes\(id\)/],
]
let ok = true
for (const [name, re] of checks) {
  const hit = re.test(c)
  if (!hit) ok = false
  console.log((hit ? '[PASS]' : '[FAIL]') + ' ' + name)
}
// 确认不存在旧的 getAll() 调用残留
console.log('[CHK] 残留 getAll() 调用: ' + (c.includes('toolManager.getAll(') ? '发现(需检查)' : '无'))
console.log(ok ? '\n全部通过' : '\n存在失败项')