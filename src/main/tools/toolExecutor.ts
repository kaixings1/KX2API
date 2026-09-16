/**
 * tools/toolExecutor.ts — 工具执行前的统一校验与输出规范化
 *
 * 对应 dev.txt §9（权限/安全）与 §10（CLI 包装规范）。核心约束：
 *
 *   1. 调用时二次鉴权：加载时查过角色权限，执行前必须再查一次
 *      （活跃集可能是旧配置下加载的，角色可能已被改）。
 *   2. 输出必须结构化：原始 CLI stdout 不直接进上下文，统一包成
 *      { ok, data, truncated, bytes, rawPath? } 形态；超限则截断并落盘。
 *   3. 输出不可信：工具返回内容标记为数据，不作为指令（由上层提示词保证）。
 *
 * 之所以做成独立模块而不是直接改 impl.ts：现有 255 个命令实现分散在 registry，
 * 改执行链路的波及面太大；这里作为「统一出口」在不改各命令的前提下加上约束。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { ToolDefinition, ToolRisk } from './types'
import { normalizeToolLabels } from './toolLabels'
import { flattenLabels } from './toolLabels'
import { resolveRole } from './toolRoles'
import { isCoreTool } from './toolRoles'

/** 单次工具输出的上限（字节），超过则截断并写文件 */
export const MAX_OUTPUT_BYTES = 16 * 1024
/** 大输出落盘目录 */
function spillDir(): string {
  const d = join(app.getPath('userData'), 'tool-outputs')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

export interface ToolOutput {
  ok: boolean
  /** 结构化内容：能解析成 JSON 就是对象，否则是 { raw: string } */
  data: unknown
  /** 是否被截断 */
  truncated: boolean
  /** 原始字节数 */
  bytes: number
  /** 截断时落盘的完整输出路径 */
  rawPath?: string
  error?: string
}

/**
 * 规范化工具输出。
 * - structured=true 时尝试 JSON.parse，失败则包成 { raw }
 * - 超过 MAX_OUTPUT_BYTES 时截断，完整内容写 userData/tool-outputs/
 */
export function normalizeOutput(raw: string, structured = false): ToolOutput {
  const text = typeof raw === 'string' ? raw : String(raw ?? '')
  const bytes = Buffer.byteLength(text, 'utf-8')

  let data: unknown
  if (structured) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  } else {
    data = { raw: text }
  }

  if (bytes <= MAX_OUTPUT_BYTES) {
    return { ok: true, data, truncated: false, bytes }
  }

  // 按 UTF-8 边界安全截断：直接 subarray 可能切断多字节字符产生乱码，
  // 用 Buffer 切片后回退到最后一个完整字符的起始字节。
  const buf = Buffer.from(text, 'utf-8')
  let end = MAX_OUTPUT_BYTES
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--
  const head = buf.subarray(0, end).toString('utf-8')
  let rawPath: string | undefined
  try {
    const p = join(spillDir(), `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
    writeFileSync(p, text, 'utf-8')
    rawPath = p
  } catch { /* 落盘失败不阻断，仅丢完整内容 */ }

  // 截断后 JSON 必然不完整、无法再解析，因此统一以 { raw } 返回；
  // 调用方靠 truncated 标志决定是否去读完整文件。
  return {
    ok: true,
    data: { raw: head },
    truncated: true,
    bytes,
    rawPath,
  }
}

/** 把结构化输出转成给模型看的文本（截断说明写清楚，便于模型决定是否读文件） */
export function formatOutput(out: ToolOutput): string {
  if (!out.ok) return out.error || '执行失败'
  const body = typeof out.data === 'object' && out.data !== null && 'raw' in (out.data as Record<string, unknown>)
    ? String((out.data as { raw: unknown }).raw ?? '')
    : JSON.stringify(out.data, null, 2)
  if (out.truncated) {
    return `${body}\n\n[输出被截断：原始 ${out.bytes} 字节${out.rawPath ? `，完整内容见 ${out.rawPath}` : ''}]`
  }
  return body
}

export interface PermissionCheckInput {
  tool: ToolDefinition
  roles: Parameters<typeof resolveRole>[0]
  roleId?: string
  /** 会话活跃集（用于判断是否已加载；核心工具无需加载） */
  isActive?: boolean
}

export interface PermissionDecision {
  allowed: boolean
  reason?: string
  /** 是否属于高风险，需要用户确认（由上层 UI 决定是否弹窗） */
  needsConfirmation?: boolean
  risk: ToolRisk
}

/**
 * 执行前权限校验（dev.txt §9：调用时二次检查，不能只在加载时检查）。
 * 规则：
 *   - 核心工具（L0）永远放行
 *   - 角色 deniedRisks / deniedTags 命中 → 拒绝
 *   - 非核心且不在活跃集 → 拒绝并提示先 tool_load
 *   - destructive 风险 → 放行但标记需要确认
 */
export function checkToolPermission(input: PermissionCheckInput): PermissionDecision {
  const { tool } = input
  const { risk, cost, labels } = normalizeToolLabels(tool)
  const role = resolveRole(input.roles, input.roleId)

  // 角色拒绝的检查必须排在「核心工具豁免」之前：
  // 核心集里的 exec 能执行任意 shell，若先豁免就会绕过 verifier 的写/破坏禁令。
  if (role.deniedRisks.includes(risk)) {
    return { allowed: false, reason: `角色「${role.name}」禁止 ${risk} 级操作`, risk }
  }

  const flat = flattenLabels(labels, risk, cost)
  const hit = role.deniedTags.find(dt => flat.some(f => f === dt || f.startsWith(dt)))
  if (hit) {
    return { allowed: false, reason: `命中角色禁用标签 ${hit}`, risk }
  }

  // 核心工具（L0）跳过「必须先加载」的要求，但仍受上面的角色约束
  if (isCoreTool(tool)) {
    return { allowed: true, risk, needsConfirmation: risk === 'destructive' }
  }

  if (input.isActive === false) {
    return {
      allowed: false,
      reason: `工具 ${tool.name} 未加载。请先 tool_load ${tool.id}`,
      risk,
    }
  }

  // 已加载工具仍需遵守 allowedGroups 范围（防止用旧配置加载后角色收紧）
  if (role.allowedGroups.length > 0) {
    const inAllowed = (labels.domains || []).some(d => role.allowedGroups.includes(d))
    if (!inAllowed && !role.allowedGroups.includes(tool.id)) {
      return { allowed: false, reason: `不在角色「${role.name}」允许的组内`, risk }
    }
  }

  return {
    allowed: true,
    risk,
    needsConfirmation: risk === 'destructive',
  }
}
