import { readFileSync, writeFileSync } from 'node:fs'

// fieldRule 是 Record<string, unknown>，直接用 fieldRule.maxLength / .pattern
// 参与 > 与 .test() 都不合法（TS2365 / TS2339）。
// 这两处已用 `typeof fieldValue === 'string'` 收窄了取值，
// 这里再对规则字段本身做 typeof 守卫即可。
const targets = ['src/main/security/InputValidator.ts', 'src/security/InputValidator.ts']

const reMax =
  /if \(fieldRule\.maxLength && typeof fieldValue === 'string' && fieldValue\.length > fieldRule\.maxLength\) \{/
const rePat =
  /if \(fieldRule\.pattern && typeof fieldValue === 'string' && !fieldRule\.pattern\.test\(fieldValue\)\) \{/

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s

  s = s.replace(
    reMax,
    "if (typeof fieldRule.maxLength === 'number' && typeof fieldValue === 'string' && fieldValue.length > fieldRule.maxLength) {",
  )
  s = s.replace(
    rePat,
    "if (fieldRule.pattern instanceof RegExp && typeof fieldValue === 'string' && !fieldRule.pattern.test(fieldValue)) {",
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('无改动: ' + p)
  }
}
