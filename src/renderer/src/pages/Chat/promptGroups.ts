/**
 * renderer/src/pages/Chat/promptGroups.ts — 内置提示词分组清单（前端可读）
 *
 * 用户可在「对话配置」中按分组勾选要发送的提示词片段、并标记「必须发送」，
 * 勾选片段会每轮合成进 system prompt，减少无效 token。
 * 分组说明文案即「工具如何用 + 适用场景」的精炼提示。
 */

export interface PromptItem {
  id: string
  label: string
  text: string
  mandatory?: boolean
}

export interface PromptGroup {
  id: string
  name: string
  description?: string
  items: PromptItem[]
}

export interface PromptGroupConfig {
  enabled: boolean
  mandatoryItemIds: string[]
  optionalItemIds: string[]
}

export type PromptGroupsState = Record<string, PromptGroupConfig>

/** 默认选中：仅启用「编程」，且 mandatory 项全部选中 */
export function defaultPromptGroups(): PromptGroupsState {
  const state: PromptGroupsState = {}
  for (const g of PROMPT_GROUPS) {
    state[g.id] = {
      enabled: g.id === 'programming',
      mandatoryItemIds: g.items.filter(i => i.mandatory).map(i => i.id),
      optionalItemIds: [],
    }
  }
  return state
}

export const PROMPT_GROUPS: PromptGroup[] = [
  {
    id: 'programming',
    name: '编程',
    description: '文件读写 / grep / edit / shell / 命令 / 版本控制',
    items: [
      { id: 'prog-files', label: '文件与搜索工具', mandatory: true, text: '可使用文件工具：read_file / write_file / edit、目录列举 ls / dir / find、内容搜索 grep。' },
      { id: 'prog-shell', label: '终端命令', text: '可用 bash / cmd / powershell 执行命令；Windows 环境请用 cmd 风格（dir / type / del / findstr）。' },
      { id: 'prog-git', label: '版本控制', text: 'git 相关工具：status / diff / log / branch / commit，用于版本控制操作。' },
    ],
  },
  {
    id: 'document',
    name: '文档',
    description: '读写 / 二进制对比 / 系列 Office 文档',
    items: [
      { id: 'doc-read', label: '文档读写', text: '文档读写：文本文件读写、二进制/文本对比、常见 Office 文档（Word/Excel/PPT）解析处理。' },
    ],
  },
  {
    id: 'image',
    name: '画图',
    description: '命令行画图工具',
    items: [
      { id: 'img-draw', label: '命令行画图', text: '画图：使用命令行绘图工具生成示意图、流程图、UML 图与数据可视化。' },
    ],
  },
  {
    id: 'reverse',
    name: '逆向',
    description: 'MD5 / 加解密常用工具',
    items: [
      { id: 'rev-crypto', label: '哈希与加解密', text: '逆向：MD5 / SHA 等哈希、Base64 编码、常见加解密换算工具。' },
    ],
  },
  {
    id: 'webdev',
    name: 'Web 前端',
    description: 'JSON 解析 / 格式化',
    items: [
      { id: 'web-json', label: 'JSON 工具', text: 'Web 前端：JSON 解析、格式化、校验等辅助工具。' },
    ],
  },
]

/** 根据勾选状态合成为 systemPrompt（与 main 侧 composeSystemPrompt 逻辑一致） */
export function buildPromptText(state: PromptGroupsState | null | undefined): string {
  if (!state) return ''
  const parts: string[] = []
  for (const group of PROMPT_GROUPS) {
    const cfg = state[group.id]
    if (!cfg) continue
    if (cfg.enabled !== true) continue
    const wanted = new Set([...(cfg.mandatoryItemIds || []), ...(cfg.optionalItemIds || [])])
    for (const item of group.items) {
      if (item.mandatory || wanted.has(item.id)) parts.push(item.text)
    }
  }
  return parts.join('\n\n')
}