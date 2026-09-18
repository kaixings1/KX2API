import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/autoCompactor.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 调用方传了 3 个参数（messages, priorNotes, memoryContext），
// 但签名只有 2 个 —— memoryContext 是"相关记忆"段（见调用点上方注释），
// 需要真正接进提示词，否则该参数被静默丢弃（记忆注入形同虚设）。
s = s.replace(
  /  private async generateSummaryWithLLM\(\r?\n    messages: InternalMessage\[\],\r?\n    priorNotes\?: string,\r?\n  \): Promise<string> \{/,
  [
    '  private async generateSummaryWithLLM(',
    '    messages: InternalMessage[],',
    '    priorNotes?: string,',
    '    /** 相关记忆段（已含前后的换行与标题，见调用点）；空串表示无 */',
    '    memoryContext?: string,',
    '  ): Promise<string> {',
  ].join(NL),
)

// 把 memoryContext 拼进提示词（放在 basePrompt 之后：先任务说明，再补充上下文）
s = s.replace(
  /    const summarizePrompt =\r?\n      priorNotes && priorNotes\.trim\(\)\r?\n        \? `\$\{priorNotes\.trim\(\)\}\\n\\n\$\{basePrompt\}`\r?\n        : basePrompt;/,
  [
    '    const memorySection = memoryContext && memoryContext.trim() ? memoryContext : "";',
    '    const summarizePrompt =',
    '      (priorNotes && priorNotes.trim()',
    '        ? `${priorNotes.trim()}\\n\\n${basePrompt}`',
    '        : basePrompt) + memorySection;',
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('未命中（检查匹配）')
}
