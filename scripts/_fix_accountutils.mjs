import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/utils/accountUtils.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// Account.name 必填，但 accountInfo 全可选。缺省时用 providerId 兜底，
// 保证账号列表里不会出现空名称（下游 getAccountDisplayName 依赖有值）。
const re = /    name: accountInfo\?\.name,\r?\n/

if (!re.test(s)) {
  console.log('未命中 name 赋值')
  process.exit(1)
}

s = s.replace(re, "    name: accountInfo?.name || providerId,\n")

writeFileSync(p, s)
console.log('已改: ' + p)
