import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/store/providers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// create() 的内联入参类型漏了 chatPath，而 Provider 接口有该字段，
// 调用点（routes/management/providers.ts 与 store.ts）都在传它。
// 补齐后 body 里的 `chatPath: data.chatPath` 也才成立。
const re = /  static create\(data: \{\r?\n    name: string\r?\n    authType: AuthType\r?\n    apiEndpoint: string\r?\n/

if (!re.test(s)) {
  console.log('未命中 create 签名')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  static create(data: {',
    '    name: string',
    '    authType: AuthType',
    '    apiEndpoint: string',
    '    /** 聊天接口路径（相对 apiEndpoint），如 /v1/chat/completions */',
    '    chatPath?: string',
    '',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
