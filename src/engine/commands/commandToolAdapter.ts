/**
 * engine/commands/commandToolAdapter.ts — 命令 → Tool 适配器
 *
 * 把命令注册表（commandRegistry）中的「命令」（execute: (args: string[]) => CommandResult）
 * 包装成 ToolScheduler 可直接调度执行的 Tool（validate + execute(params) => {content}）。
 *
 * 为什么需要：
 *   MessageLoop 通过 toolDefinitions 判定模型发出的工具名是否有效（availableTools），
 *   并通过 ToolScheduler 的 registry 真正执行。此前 engine 的 opts.tools 未注入、buildRegistry 返回空，
 *   导致「模型发 ls/dir 这类命令工具」永远被判定 invalid、无从执行。
 *   本模块把命令注册表与 Tool 调度体系打通：命令名进入 availableTools 集合同时可被真正执行。
 *
 * 参数归一化：模型可能以多种形状传入参数——
 *   - { args: ["D:\\x"] }        （标准数组）
 *   - { path: "D:\\x", ... }      （具名参数）
 *   - { command: "/ls D:\\x" }     （单字符串整条）
 */

import type { Tool } from "../toolScheduler.ts"

interface CommandLike {
  name: string
  description: string
  group?: string
  execute: (args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
}

/** 从任意 input 形状归一化为命令参数数组 */
function inputToArgs(input: unknown): string[] {
  if (!input || typeof input !== 'object') return []
  const obj = input as Record<string, unknown>
  // 兼容模型把数组 JSON.stringify 后的输入（如 args: "[\"D:\\\\KX2API\"]"）
  if (typeof obj.args === 'string' && obj.args.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(obj.args)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch { /* 不是合法 JSON，继续其他逻辑 */ }
  }
  if (Array.isArray(obj.args)) {
    return obj.args.map(String)
  }
  if (typeof obj.command === 'string' && obj.command.trim()) {
    return obj.command.trim().split(/\s+/)
  }
  const keys = ['path', 'target', 'pattern', 'query', 'text', 'file', 'dir', 'name'].filter(
    (k) => obj[k] !== undefined,
  )
  const out: string[] = []
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
    else if (typeof v === 'number') out.push(String(v))
  }
  return out
}

/**
 * 把命令注册表中的命令包装成 Tool 集合。
 * 传入 CommandRegistry 实例（提供 getAll()）。
 * allowedTools 若提供，则只包装白名单内的命令（否则会把 registry 的数百条命令全部塞给模型）；
 * 缺省包装全部命令。
 */
export async function commandToolsToMap(
  registry: { getAll: () => CommandLike[] },
  allowedTools?: string[],
): Promise<Map<string, Tool>> {
  const map = new Map<string, Tool>()
  const all = registry.getAll()
  const allow = allowedTools ? new Set(allowedTools) : null
  for (const cmd of all) {
    if (allow && !allow.has(cmd.name)) continue
    const tool: Tool = {
      name: cmd.name,
      description: cmd.description,
      parameters: {
        type: 'object',
        properties: { args: { type: 'array', items: { type: 'string' } } },
      },
      canRunInParallel: false,
      timeout: 600000,
      validate() {
        return { valid: true }
      },
      async execute(params) {
        try {
          const args = inputToArgs(params)
          const r = await cmd.execute(args)
          if (r.success) {
            return { content: r.output ?? '(无输出)' }
          }
          return { content: `错误: ${r.error ?? '执行失败'}` }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { content: `错误: ${msg}` }
        }
      },
    }
    map.set(cmd.name, tool)
  }
  return map
}