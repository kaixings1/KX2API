import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/store/store.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// readOrCreateEncryptionKey() 返回 string | null，而本方法签名是 string | undefined。
// 「没有 key」在这里就是 undefined 的语义，显式归一。
s = s.replace(
  '        const key = this.readOrCreateEncryptionKey()\n        return key',
  '        const key = this.readOrCreateEncryptionKey()\n        return key ?? undefined',
)
s = s.replace(
  '        const key = this.readOrCreateEncryptionKey()\r\n        return key',
  '        const key = this.readOrCreateEncryptionKey()\r\n        return key ?? undefined',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
