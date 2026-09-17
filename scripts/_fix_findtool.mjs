import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/tools/toolOrchestrator.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// ContentBlock.name 是可选（string | undefined）；没有名字时本就找不到定义，
// 放宽参数类型即可（返回 undefined），无需在调用点造假名。
const re =
  /function findToolDefinition\(\r?\n  toolDefinitions: ToolDefinition\[\],\r?\n  name: string,\r?\n\): ToolDefinition \| undefined \{/

if (!re.test(s)) {
  console.log('未命中 findToolDefinition')
  process.exit(1)
}

s = s.replace(
  re,
  [
    'function findToolDefinition(',
    '  toolDefinitions: ToolDefinition[],',
    '  /** 允许 undefined：ContentBlock.name 是可选字段，无名即查不到 */',
    '  name: string | undefined,',
    '): ToolDefinition | undefined {',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
