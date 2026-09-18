/**
 * 复现用户日志里的场景：模型发出工具名 `shell`，看 resolveToolName 能否归一化。
 */
import { resolveToolName, TOOL_ALIASES } from '../src/engine/toolNameResolver.ts'

const names = ['shell', 'bash', 'Bash', 'cmd', 'powershell', 'sh', 'dir', 'ls', 'list_directory']

console.log('=== TOOL_ALIASES 里是否有 shell ===')
console.log('shell' in TOOL_ALIASES ? '有' : '没有 ← 这就是 invalid 的原因')
console.log('')

for (const n of names) {
  const r = await resolveToolName(n)
  console.log(`${n.padEnd(18)} → ${r ?? 'null（判定为无效工具）'}`)
}
