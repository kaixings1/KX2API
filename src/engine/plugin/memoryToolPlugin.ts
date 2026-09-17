/**
 * memory plugin — 将 MemoryToolHandler 封装为 Tool 插件
 *
 * 来源: src/memory/memoryTool.ts (Claude Cookbooks memory_tool.py)
 * 集成方式: 注册到 toolPluginRegistry，默认启用
 *
 * 目录约定：缺省走 MemoryToolHandler 的默认根 `resolveMemoryDir()`，
 * 与记忆召回/写入系统（src/engine/memory/）落在同一目录，使工具写入
 * 的记忆能被召回系统读到。不再使用写死的相对路径 `./memory_storage`
 * （Electron 打包后工作目录不固定，相对路径定位不稳）。
 */

import type { Tool, ToolPlugin } from '../../engine/plugin/toolPluginRegistry.ts'
import { MemoryToolHandler } from '../../memory/memoryTool.ts'

/** 单例处理器 */
let handler: MemoryToolHandler | null = null
function getHandler(): MemoryToolHandler {
  if (!handler) {
    handler = new MemoryToolHandler()
  }
  return handler
}

/** 工具定义 */
export const memoryToolDefinitions = [
  {
    name: 'memory_view',
    description: '查看记忆文件或目录内容（路径以 /memories 开头）',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '记忆路径，如 /memories/notes.md 或 /memories/' },
      },
      required: ['path'],
    },
  },
  {
    name: 'memory_create',
    description: '创建记忆文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '记忆路径，如 /memories/notes.md' },
        file_text: { type: 'string', description: '文件内容' },
      },
      required: ['path', 'file_text'],
    },
  },
  {
    name: 'memory_str_replace',
    description: '在记忆文件中替换文本（精确匹配，只替换一处）',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '记忆路径' },
        old_str: { type: 'string', description: '要被替换的文本' },
        new_str: { type: 'string', description: '替换后的文本' },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
  {
    name: 'memory_insert',
    description: '在记忆文件中指定行号插入文本',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '记忆路径' },
        insert_line: { type: 'number', description: '要插入的行号（0-indexed）' },
        insert_text: { type: 'string', description: '要插入的文本' },
      },
      required: ['path', 'insert_line', 'insert_text'],
    },
  },
  {
    name: 'memory_delete',
    description: '删除记忆文件或目录',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '记忆路径，不能为 /memories（根目录）' },
      },
      required: ['path'],
    },
  },
  {
    name: 'memory_rename',
    description: '重命名记忆文件或目录',
    parameters: {
      type: 'object',
      properties: {
        old_path: { type: 'string', description: '原路径' },
        new_path: { type: 'string', description: '新路径' },
      },
      required: ['old_path', 'new_path'],
    },
  },
] as const

/** 命令映射 */
const CMD_MAP: Record<string, string> = {
  memory_view: 'view',
  memory_create: 'create',
  memory_str_replace: 'str_replace',
  memory_insert: 'insert',
  memory_delete: 'delete',
  memory_rename: 'rename',
}

/** 创建 Tool 实例 */
export function createMemoryTools(): Tool[] {
  return memoryToolDefinitions.map((def) => ({
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    canRunInParallel: true,

    validate(_params: unknown) {
      return { valid: true }
    },

    async execute(params: unknown): Promise<{ content: unknown }> {
      const p = params as Record<string, unknown>
      const cmd = CMD_MAP[def.name]
      if (!cmd) {
        return { content: `未知记忆命令: ${def.name}` }
      }

      const result = getHandler().execute({
        command: cmd,
        path: typeof p.path === 'string' ? p.path : undefined,
        file_text: typeof p.file_text === 'string' ? p.file_text : undefined,
        old_str: typeof p.old_str === 'string' ? p.old_str : undefined,
        new_str: typeof p.new_str === 'string' ? p.new_str : undefined,
        insert_line: typeof p.insert_line === 'number' ? p.insert_line : undefined,
        insert_text: typeof p.insert_text === 'string' ? p.insert_text : undefined,
        old_path: typeof p.old_path === 'string' ? p.old_path : undefined,
        new_path: typeof p.new_path === 'string' ? p.new_path : undefined,
      })

      if ('error' in result) {
        return { content: `[记忆错误] ${result.error}` }
      }
      return { content: result.success }
    },
  }))
}

/** 插件定义 — 注册到 toolPluginRegistry 时使用此对象 */
export const memoryToolPlugin: ToolPlugin = {
  id: 'memory',
  name: '记忆管理',
  description: '查看、创建、编辑、删除记忆文件（Claude Cookbooks memory_tool）',
  legacyDir: 'memory',
  enabledByDefault: true,
  lazy: false,
  toolDefinitions: memoryToolDefinitions.map(d => ({
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  })),
  load: createMemoryTools,
  unload() {
    handler = null
  },
}
