import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/prompt/DefaultPromptAdapter.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// constants/signatures 里没有 TOOL_PROMPT_SIGNATURES 这个名字，
// 与之等价的现成常量是 GENERAL_TOOL_SIGNATURES（同一批工具提示签名）。
s = s.replace(
  "import { TOOL_PROMPT_SIGNATURES, hasGeneralToolPromptSignature } from '../../constants/signatures'",
  "import { GENERAL_TOOL_SIGNATURES, hasGeneralToolPromptSignature } from '../../constants/signatures'",
)
s = s.replace(
  '  detectSignatures = TOOL_PROMPT_SIGNATURES.general',
  '  detectSignatures = GENERAL_TOOL_SIGNATURES',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
