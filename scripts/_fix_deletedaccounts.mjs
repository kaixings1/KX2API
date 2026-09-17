import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/store/providers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// addLog 的第三参是固定字段白名单（accountId/providerId/.../data），
// 没有 deletedAccounts。该数量属于「附加上下文」，放进已有的通用 data 槽。
const re =
  /        providerId: id,\r?\n        deletedAccounts: accounts\.length,\r?\n/

if (!re.test(s)) {
  console.log('未命中 deletedAccounts')
  process.exit(1)
}

s = s.replace(
  re,
  '        providerId: id,\n        data: { deletedAccounts: accounts.length },\n',
)

writeFileSync(p, s)
console.log('已改: ' + p)
