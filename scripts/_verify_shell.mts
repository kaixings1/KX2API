/**
 * 验证用户日志里的场景是否修好：
 *   模型发 `shell`（带 args: ['dir']），应被归一化到可执行命令并被接受。
 *
 * 模拟 messageLoop 的判定逻辑（两张表 + 概念兜底）。
 */
import { resolveToolName } from '../src/engine/toolNameResolver.ts'
import { getToolConcept, getToolNameVariants } from '../src/engine/toolNameCompat.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'

// 模拟 engine-bridge 构造的 toolDefinitions（来自 commandRunners）
const availableTools = new Set([...commandRunners.keys()])
console.log('可用工具数（commandRunners）:', availableTools.size)

function pickExecutableByConcept(requested: string, available: Set<string>): string | null {
  if (!requested) return null
  for (const variant of getToolNameVariants(requested)) {
    if (available.has(variant)) return variant
  }
  const concept = getToolConcept(requested)
  const PREFERRED: Record<string, string[]> = {
    shell: ['bash', 'exec', 'sh'],
    list: ['ls', 'dir', 'tree'],
    read: ['cat', 'head', 'tail'],
    search: ['find', 'findstr', 'grep'],
    write: ['cp', 'mkdir', 'mv'],
    code: ['exec', 'bash'],
    web: ['search'],
  }
  for (const candidate of PREFERRED[concept] ?? []) {
    if (available.has(candidate)) return candidate
  }
  return null
}

// 复刻 messageLoop 的完整判定
async function resolveLikeMessageLoop(name: string): Promise<string | null> {
  if (availableTools.has(name)) return name
  let resolved: string | null = null
  try { resolved = await resolveToolName(name) } catch { resolved = null }
  if (resolved && availableTools.has(resolved)) return resolved
  return pickExecutableByConcept(name, availableTools)
}

const cases = ['shell', 'cmd', 'powershell', 'sh', 'bash', 'dir', 'ls', 'list_directory', 'grep', 'findstr', 'find', 'cat', 'Read']

console.log('\n=== 修复后：模型发出的工具名 → 是否被接受 ===')
for (const n of cases) {
  const r = await resolveLikeMessageLoop(n)
  console.log(`${n.padEnd(18)} → ${r ? '✅ ' + r : '❌ 仍判无效'}`)
}
