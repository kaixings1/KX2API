import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 构造里会把 toolStreamParser 显式置 null（表示「本次不解析」），
// 字段却声明为 `?: ToolStreamParser`（= | undefined），故 TS2322。
// 全文对该字段的访问都是 `?.` 可选链，null / undefined 行为一致。
s = s.replace(
  '  private toolStreamParser?: ToolStreamParser\r\n',
  '  private toolStreamParser?: ToolStreamParser | null\r\n',
)
s = s.replace(
  '  private toolStreamParser?: ToolStreamParser\n',
  '  private toolStreamParser?: ToolStreamParser | null\n',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
