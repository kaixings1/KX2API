// 临时验证：确认 src/security/OutputSanitizer 修复后不再泄露密钥明文
import { OutputSanitizer } from '../src/security/OutputSanitizer.ts'

const s = new OutputSanitizer()

const cases = [
  'api_key = sk-abcdefghijklmnopqrstuvwxyz123456',
  'apikey="AKIAIOSFODNN7EXAMPLE"',
  'password="hunter2hunter2hunter"',
  'token=abcdefghijklmnopqrstuvwxyz1234567890',
  'secret = sk-abcdefghijklmnopqrstuvwxyz123456',
]

let ok = true
for (const input of cases) {
  const out = s.sanitize(input)
  // 从输入里尽量提取可能的密钥字面量
  const m = input.match(/(?:key|password|passwd|pwd|secret|token)\s*[:=]\s*["']?([^"'\s]+)/i)
  const secret = m ? m[1] : null
  const leaked = secret && secret.length > 8 ? out.includes(secret) : true
  const containsMark = out.includes('REDACTED')
  let status = 'OK'
  if (leaked || !containsMark) { ok = false; status = 'FAIL' }
  console.log(`[${status}] in=<${input}> out=<${out.trim()}>`)
}
console.log(ok ? 'ALL PASS: 无明文泄露' : 'SOME FAIL')
process.exit(ok ? 0 : 1)