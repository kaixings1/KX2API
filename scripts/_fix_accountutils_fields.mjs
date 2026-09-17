import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/utils/accountUtils.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 这里的返回对象用了 Account 上并不存在的 userId / usageCount / metadata
// （是从另一套 Account 形状搬过来的残留）。按 store/types 的 Account 对齐：
//   userId     → 收进 credentials（凭据本就存在这里）
//   usageCount → requestCount（Account 上的对应字段）
//   metadata   → 删除（Account 无该字段，也无消费点）
const re =
  /  return \{\r?\n    providerId,\r?\n    credentials,\r?\n    name: accountInfo\?\.name \|\| providerId,\r?\n    email: accountInfo\?\.email,\r?\n    userId: accountInfo\?\.userId,\r?\n    status: 'active',\r?\n    lastUsed: undefined,\r?\n    usageCount: 0,\r?\n    metadata: \{\},\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中返回对象')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  // Account 上没有 userId / usageCount / metadata：',
    '  //   userId     → 并入 credentials（凭据的存放处）',
    '  //   usageCount → Account.requestCount',
    '  return {',
    '    providerId,',
    '    credentials: accountInfo?.userId',
    '      ? { ...credentials, userId: accountInfo.userId }',
    '      : credentials,',
    '    name: accountInfo?.name || providerId,',
    '    email: accountInfo?.email,',
    "    status: 'active',",
    '    requestCount: 0,',
    '  }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
