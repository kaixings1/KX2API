import { readFileSync, writeFileSync } from 'node:fs'

// getPromptVariant() 的返回约定是 `PromptVariant | null`（显式表示「无匹配」），
// 但 toolsToPrompt() 的 variant 参数只写 `variant?: PromptVariant`（= | undefined），
// 于是把返回值直接传进去就报 TS2345 / TS2322。
// 统一成可空即可，实现处都已用 `variant?.x || DEFAULT` 兜底，行为不变。
const targets = [
  'src/main/proxy/adapters/prompt/BasePromptAdapter.ts',
  'src/main/proxy/adapters/prompt/DefaultPromptAdapter.ts',
  'src/main/proxy/adapters/prompt/KiloCodePromptAdapter.ts',
  'src/main/proxy/adapters/prompt/CherryStudioPromptAdapter.ts',
]

const reA = /toolsToPrompt\(tools: ChatCompletionTool\[\], variant\?: PromptVariant\): string/g
const reB = /toolsToPrompt\(tools: ChatCompletionTool\[\], _variant\?: PromptVariant\): string/g

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s
  s = s.replace(reA, 'toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant | null): string')
  s = s.replace(reB, 'toolsToPrompt(tools: ChatCompletionTool[], _variant?: PromptVariant | null): string')
  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('无改动: ' + p)
  }
}
