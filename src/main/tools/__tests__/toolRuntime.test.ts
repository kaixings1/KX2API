/**
 * toolRuntime 单测 —— 工具组「生效」逻辑
 *
 * 这是「配置里选了组，实际却没生效」这个问题的核心判定逻辑：
 * 分组 → 启用/平台过滤 → 环境变量 → 发给模型的工具定义。
 */

import { describe, it, expect } from 'vitest'
import {
  resolveActiveTools,
  applyToolEnvVars,
  buildOpenAIToolDefinitions,
  buildToolHint,
  buildParameterSchema,
  describeTool,
  isPlatformMatch,
  toolEnvKey,
  type ResolveInput,
} from '../toolRuntime'
import type { ToolDefinition as ManagedTool, ToolGroup as ManagedGroup } from '../types'

const mkTool = (over: Partial<ManagedTool> & { name: string }): ManagedTool => ({
  id: over.name,
  name: over.name,
  displayName: over.displayName ?? over.name,
  description: over.description ?? `${over.name} 的说明`,
  usage: over.usage ?? `/${over.name}`,
  platform: over.platform ?? 'all',
  parameters: over.parameters ?? [],
  tags: over.tags ?? [],
  enabled: over.enabled ?? true,
  builtin: over.builtin ?? true,
  createdAt: 0,
  updatedAt: 0,
})

const mkGroup = (id: string, name: string, toolIds: string[]): ManagedGroup => ({
  id,
  name,
  description: '',
  toolIds,
  enabled: true,
  builtin: false,
  createdAt: 0,
})

const TOOLS: ManagedTool[] = [
  mkTool({ name: 'ls', description: '列出目录文件', usage: '/ls [路径]' }),
  mkTool({ name: 'read-file', description: '读取文件', usage: '/read-file <path>' }),
  mkTool({ name: 'write-file', description: '写入文件' }),
  mkTool({ name: 'dir', description: 'Windows 列目录', platform: 'windows' }),
  mkTool({ name: 'brew', description: 'macOS 包管理', platform: 'unix' }),
  mkTool({ name: 'disabled-tool', description: '被关掉的工具', enabled: false }),
]

const GROUPS: ManagedGroup[] = [
  mkGroup('programming', '编程', ['ls', 'read-file', 'write-file']),
  mkGroup('file-system', '文件系统', ['ls', 'dir', 'disabled-tool']),
]

const base = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  groupIds: [],
  tools: TOOLS,
  groups: GROUPS,
  platform: 'win32',
  env: {},
  ...over,
})

describe('toolEnvKey', () => {
  it('工具名转成合法环境变量名', () => {
    expect(toolEnvKey('ls')).toBe('KX2_TOOL_DEF_LS')
    expect(toolEnvKey('git-status')).toBe('KX2_TOOL_DEF_GIT_STATUS')
    expect(toolEnvKey('read_file')).toBe('KX2_TOOL_DEF_READ_FILE')
    expect(toolEnvKey('a.b c')).toBe('KX2_TOOL_DEF_A_B_C')
  })
})

describe('isPlatformMatch', () => {
  it('all 永远匹配，windows/unix 按平台', () => {
    expect(isPlatformMatch('all', 'win32')).toBe(true)
    expect(isPlatformMatch('windows', 'win32')).toBe(true)
    expect(isPlatformMatch('windows', 'linux')).toBe(false)
    expect(isPlatformMatch('unix', 'linux')).toBe(true)
    expect(isPlatformMatch('unix', 'win32')).toBe(false)
  })
})

describe('resolveActiveTools', () => {
  it('空 groupIds = 全局组：所有已启用且平台匹配的工具', () => {
    const r = resolveActiveTools(base())
    expect(r.isGlobal).toBe(true)
    // win32 下 unix 专用的 brew 不发，禁用工具不发
    expect(r.names).toEqual(['ls', 'read-file', 'write-file', 'dir'])
    expect(r.platformSkipped).toContain('brew')
    expect(r.disabledSkipped).toContain('disabled-tool')

    const linux = resolveActiveTools(base({ platform: 'linux' }))
    expect(linux.names).toContain('brew')
    expect(linux.names).not.toContain('dir')
  })

  it('选中「编程」组：只出组内三个工具', () => {
    const r = resolveActiveTools(base({ groupIds: ['programming'] }))
    expect(r.isGlobal).toBe(false)
    expect(r.groupNames).toEqual(['编程'])
    expect(r.names).toEqual(['ls', 'read-file', 'write-file'])
  })

  it('按平台过滤组内工具（dir 是 windows 专用）', () => {
    const win = resolveActiveTools(base({ groupIds: ['file-system'], platform: 'win32' }))
    expect(win.names).toEqual(['ls', 'dir'])
    const linux = resolveActiveTools(base({ groupIds: ['file-system'], platform: 'linux' }))
    expect(linux.names).toEqual(['ls'])
    expect(linux.platformSkipped).toContain('dir')
  })

  it('组内工具被关闭时不发送，并记录原因', () => {
    const r = resolveActiveTools(base({ groupIds: ['file-system'], platform: 'linux' }))
    expect(r.names).not.toContain('disabled-tool')
    expect(r.disabledSkipped).toContain('disabled-tool')
  })

  it('组不存在时回退到全局组（避免把模型变成无工具状态）', () => {
    const r = resolveActiveTools(base({ groupIds: ['not-exist'] }))
    expect(r.isGlobal).toBe(true)
    expect(r.names.length).toBeGreaterThan(0)
  })

  it('组内一个可用工具都没有时回退全局组', () => {
    const r = resolveActiveTools(base({ groupIds: ['file-system'], platform: 'linux' }))
    expect(r.names).toEqual(['ls'])
    const onlyDisabled = resolveActiveTools(base({
      groups: [mkGroup('g', '只含禁用', ['disabled-tool'])],
      groupIds: ['g'],
    }))
    expect(onlyDisabled.isGlobal).toBe(true)
    expect(onlyDisabled.names).toContain('read-file')
  })

  it('KX2_TOOL_GROUP 环境变量可以强制指定分组', () => {
    const r = resolveActiveTools(base({ env: { KX2_TOOL_GROUP: 'programming' } }))
    expect(r.names).toEqual(['ls', 'read-file', 'write-file'])
  })

  it('多个组时按组顺序合并并去重', () => {
    const r = resolveActiveTools(base({ groupIds: ['programming', 'file-system'] }))
    expect(r.names).toEqual(['ls', 'read-file', 'write-file', 'dir'])
  })
})

describe('applyToolEnvVars', () => {
  it('组内工具=1，其余=0，并写出 KX2_TOOL_GROUP', () => {
    const env: Record<string, string | undefined> = {}
    const resolved = resolveActiveTools(base({ groupIds: ['programming'], env }))
    const applied = applyToolEnvVars(resolved, TOOLS, env)
    expect(applied['KX2_TOOL_DEF_LS']).toBe('1')
    expect(applied['KX2_TOOL_DEF_READ_FILE']).toBe('1')
    expect(applied['KX2_TOOL_DEF_WRITE_FILE']).toBe('1')
    expect(applied['KX2_TOOL_DEF_DIR']).toBe('0')
    expect(applied['KX2_TOOL_DEF_DISABLED_TOOL']).toBe('0')
    expect(applied['KX2_TOOL_GROUP']).toBe('programming')
    // 真的写进了 env 对象
    expect(env['KX2_TOOL_DEF_LS']).toBe('1')
  })

  it('全局组时 KX2_TOOL_GROUP 为空字符串', () => {
    const env: Record<string, string | undefined> = {}
    const resolved = resolveActiveTools(base({ env }))
    const applied = applyToolEnvVars(resolved, TOOLS, env)
    expect(applied['KX2_TOOL_GROUP']).toBe('')
    expect(applied['KX2_TOOL_DEF_LS']).toBe('1')
  })
})

describe('工具定义生成', () => {
  it('把 usage 拼进描述，模型能看到语法', () => {
    expect(describeTool(TOOLS[0])).toBe('列出目录文件（用法：/ls [路径]）')
    // usage 就是 /name 时不重复追加
    expect(describeTool(TOOLS[2])).toBe('写入文件')
  })

  it('声明了参数就用真实 schema', () => {
    const withParams = mkTool({
      name: 'read-file',
      parameters: [
        { name: 'path', type: 'string', required: true, description: '文件路径' },
        { name: 'offset', type: 'number', required: false, description: '起始行' },
      ],
    })
    const schema = buildParameterSchema(withParams)
    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        offset: { type: 'number', description: '起始行' },
      },
      required: ['path'],
    })
  })

  it('没声明参数时回落到通用 args 数组', () => {
    const schema = buildParameterSchema(TOOLS[0]) as { properties: Record<string, unknown> }
    expect(Object.keys(schema.properties)).toEqual(['args'])
  })

  it('生成的 OpenAI 定义带 name/description/parameters', () => {
    const defs = buildOpenAIToolDefinitions(TOOLS.slice(0, 2))
    expect(defs[0].type).toBe('function')
    expect(defs[0].function.name).toBe('ls')
    expect(defs[0].function.description).toContain('用法')
    expect(defs[0].function.parameters).toBeTruthy()
  })

  it('提示词只给计数与约定，不罗列工具清单', () => {
    // 工具的名称/描述/参数 schema 已由请求的 tools 字段承载，
    // 正文再列一遍是重复信息，会白白占用上下文。
    const resolved = resolveActiveTools(base({ groupIds: ['programming'] }))
    const hint = buildToolHint(resolved)
    expect(hint).toContain('tools 字段')
    expect(hint).toContain(String(resolved.tools.length))
    expect(hint).not.toContain('- ls')
    expect(hint).not.toContain('- read-file')
  })

  it('没有可用工具时明确告知模型不要调用工具', () => {
    const hint = buildToolHint({ ...resolveActiveTools(base()), tools: [], names: [] } as never)
    expect(hint).toContain('没有启用任何工具')
  })
})
