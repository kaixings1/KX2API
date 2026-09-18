import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/autoFixLoop.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// extractEditedFiles 同样只读 output，不依赖 toolUseId。
// 与 maybeRun 保持一致放宽，避免在调用点伪造 ID。
const old = '  public extractEditedFiles(\n    results: Array<{ toolUseId: string; success: boolean; output?: unknown; error?: string }>,\n  ): string[] {'
const neu = '  public extractEditedFiles(\n    // toolUseId 允许缺省（与 ToolResult 声明一致）：本方法只读 output\n    results: Array<{ toolUseId?: string; success: boolean; output?: unknown; error?: string }>,\n  ): string[] {'

const oldCRLF = old.replace(/\n/g, '\r\n')
const neuCRLF = neu.replace(/\n/g, '\r\n')

if (s.includes(oldCRLF)) s = s.replace(oldCRLF, neuCRLF)
else if (s.includes(old)) s = s.replace(old, neu)
else console.log('未命中 extractEditedFiles')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
