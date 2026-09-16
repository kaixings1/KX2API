/**
 * tools/toolRoles.ts — 内置角色配置与核心工具（L0）判定
 *
 * dev.txt §4/§5：角色决定默认加载哪些组，核心工具常驻上下文。
 * 这里给出内置默认值；用户在工具管理页的改动走 roles 覆盖（存 store）。
 */

import type { ToolDefinition, ToolRole } from './types'

/**
 * 常驻核心工具（L0，dev.txt §5）。
 * 这些是元工具与最小可用集，始终进上下文、不参与 LRU 淘汰。
 * 注意：tool.* 元工具由 toolMetaTools 注册，此处只声明「谁是核心」。
 */
export const CORE_TOOL_NAMES: readonly string[] = [
  // 元工具：发现与加载（dev.txt §6）
  'tool_search',
  'tool_load',
  'tool_unload',
  'tool_active',
  'tool_describe',
  // 最小基础集：只读探查，覆盖「看文件、跑命令、找内容」
  'ls',
  'cat',
  'pwd',
  'grep',
  'exec',
]

/** 内置默认角色（dev.txt §11 的四类，外加一个全能兜底） */
export function defaultRoles(): ToolRole[] {
  const now = Date.now()
  const mk = (r: Omit<ToolRole, 'builtin' | 'createdAt'>): ToolRole => ({
    ...r,
    builtin: true,
    createdAt: now,
  })
  return [
    mk({
      id: 'default',
      name: '通用',
      description: '未指定角色时的兜底：只带核心工具，其余靠搜索按需加载',
      defaultGroups: [],
      allowedGroups: [],
      deniedTags: [],
      deniedRisks: [],
      maxActiveTools: 30,
    }),
    mk({
      id: 'developer',
      name: '开发者',
      description: '写代码、改文件、跑构建与测试',
      defaultGroups: [],
      allowedGroups: [],
      deniedTags: [],
      deniedRisks: [],
      maxActiveTools: 30,
    }),
    mk({
      id: 'verifier',
      name: '校验者',
      description: '只做核对与验证，不允许写入、网络与破坏性操作',
      defaultGroups: [],
      allowedGroups: [],
      deniedTags: [],
      deniedRisks: ['write', 'destructive', 'network'],
      maxActiveTools: 20,
    }),
    mk({
      id: 'operator',
      name: '运维',
      description: '部署、容器与系统操作',
      defaultGroups: [],
      allowedGroups: [],
      deniedTags: [],
      deniedRisks: [],
      maxActiveTools: 30,
    }),
    mk({
      id: 'researcher',
      name: '调研',
      description: '联网检索与只读浏览',
      defaultGroups: [],
      allowedGroups: [],
      deniedTags: [],
      deniedRisks: ['destructive', 'write'],
      maxActiveTools: 25,
    }),
  ]
}

/** 取角色；未命中返回 default 角色（保证调用方永远拿得到可用配置） */
export function resolveRole(roles: ToolRole[], id?: string): ToolRole {
  const list = roles.length > 0 ? roles : defaultRoles()
  if (id) {
    const found = list.find(r => r.id === id)
    if (found) return found
  }
  return list.find(r => r.id === 'default') || list[0]
}

/** 该工具是否属于常驻核心（显式 alwaysOn 优先，其次看内置核心名单） */
export function isCoreTool(tool: Pick<ToolDefinition, 'name' | 'alwaysOn'>): boolean {
  if (tool.alwaysOn === true) return true
  return CORE_TOOL_NAMES.includes(tool.name)
}
