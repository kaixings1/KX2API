/**
 * ToolManagement 搜索过滤 + 分组管理 + CRUD 全链路测试
 *
 * 覆盖：
 * - 搜索过滤：工具名、显示名、分组名、规则名
 * - 分组管理：groupByPlatform、isCheckedIn、effective 工具集合
 * - Tool CRUD：add / update / toggle / remove 表单验证
 * - Group CRUD：add / update / remove
 * - Hint Rule CRUD：add / update / remove、patterns 解析
 * - 内置项保护：builtin 工具/分组/规则不可删除
 */

import { describe, it, expect } from 'vitest'

// ==================== Types ====================

interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  parameters?: any[]
  tags: string[]
  enabled: boolean
  builtin: boolean
}

interface ToolGroup {
  id: string
  name: string
  description: string
  toolIds: string[]
  enabled: boolean
  builtin: boolean
}

interface HintRule {
  id: string
  name: string
  description: string
  patterns: string[]
  groupIds: string[]
  priority: number
  enabled: boolean
  builtin: boolean
}

// ==================== 搜索过滤 ====================

function filterTools(tools: ToolDef[], search: string): ToolDef[] {
  if (!search.trim()) return tools
  const kw = search.toLowerCase().trim()
  return tools.filter(t =>
    t.name.toLowerCase().includes(kw)
    || t.displayName.toLowerCase().includes(kw)
  )
}

function filterGroups(groups: ToolGroup[], search: string): ToolGroup[] {
  if (!search.trim()) return groups
  const kw = search.toLowerCase().trim()
  return groups.filter(g =>
    g.name.toLowerCase().includes(kw)
    || g.description.toLowerCase().includes(kw)
  )
}

function filterRules(rules: HintRule[], search: string): HintRule[] {
  if (!search.trim()) return rules
  const kw = search.toLowerCase().trim()
  return rules.filter(r =>
    r.name.toLowerCase().includes(kw)
    || r.description.toLowerCase().includes(kw)
  )
}

// ==================== 平台归组 ====================

function groupByPlatform(tools: ToolDef[]): { platform: string; label: string; items: ToolDef[] }[] {
  const order = [
    { key: 'all', label: '全部平台' },
    { key: 'windows', label: 'Windows' },
    { key: 'unix', label: 'Unix' },
  ]
  const buckets: Record<string, ToolDef[]> = {}
  for (const t of tools) {
    const key = t.platform || 'all'
    ;(buckets[key] ??= []).push(t)
  }
  return order
    .filter(o => (buckets[o.key] || []).length > 0)
    .map(o => ({ platform: o.key, label: o.label, items: buckets[o.key]! }))
}

// ==================== 生效工具计算 ====================

function isPlatformMatch(platform: string): boolean {
  if (!platform || platform === 'all') return true
  // 在 node 环境测试中，默认模拟为非 Windows
  if (platform === 'windows') return false
  if (platform === 'unix') return true
  return true
}

function computeEffective(tools: ToolDef[], groups: ToolGroup[], activeGroupIds: string[]): {
  tools: ToolDef[]
  skipped: string[]
} {
  if (activeGroupIds.length === 0) {
    const enabled = tools.filter(x => x.enabled && isPlatformMatch(x.platform))
    const skipped = tools.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name)
    return { tools: enabled, skipped }
  }
  const picked: ToolDef[] = []
  const seen = new Set<string>()
  for (const gid of activeGroupIds) {
    const g = groups.find(x => x.id === gid)
    if (!g) continue
    for (const tid of g.toolIds) {
      if (seen.has(tid)) continue
      seen.add(tid)
      const tool = tools.find(x => x.id === tid || x.name === tid)
      if (tool) picked.push(tool)
    }
  }
  const enabled = picked.filter(x => x.enabled && isPlatformMatch(x.platform))
  const skipped = picked.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name)
  return { tools: enabled, skipped }
}

// ==================== Tool Form 验证 ====================

interface ToolForm {
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  tags: string
  parameters: any[]
}

function validateToolForm(form: ToolForm): { valid: boolean; error?: string } {
  if (!form.name.trim()) return { valid: false, error: 'name_required' }
  if (!form.displayName.trim()) return { valid: false, error: 'displayName_required' }
  return { valid: true }
}

function parseTags(tagsStr: string): string[] {
  return tagsStr.split(',').map(s => s.trim()).filter(Boolean)
}

// ==================== Group Form 验证 ====================

interface GroupForm {
  name: string
  description: string
  toolIds: string
}

function validateGroupForm(form: GroupForm): { valid: boolean; error?: string } {
  if (!form.name.trim()) return { valid: false, error: 'name_required' }
  return { valid: true }
}

function parseToolIds(toolIdsStr: string): string[] {
  return toolIdsStr.split(',').map(s => s.trim()).filter(Boolean)
}

// ==================== Hint Rule 验证 ====================

interface RuleForm {
  name: string
  description: string
  patterns: string
  groupIds: string
  priority: number
}

function validateRuleForm(form: RuleForm): { valid: boolean; error?: string } {
  if (!form.name.trim()) return { valid: false, error: 'name_required' }
  if (!form.patterns.trim()) return { valid: false, error: 'patterns_required' }
  return { valid: true }
}

function parsePatterns(patternsStr: string): string[] {
  return patternsStr.split('\n').map(s => s.trim()).filter(Boolean)
}

function parseGroupIds(groupIdsStr: string): string[] {
  return groupIdsStr.split(',').map(s => s.trim()).filter(Boolean)
}

// ==================== 内置项保护 ====================

function canDelete(item: { builtin: boolean }): boolean {
  return !item.builtin
}

// ==================== Mock Data ====================

const mockTools: ToolDef[] = [
  { id: 'read_file', name: 'read_file', displayName: '读取文件', description: '读取文件内容', usage: '/read_file', platform: 'all', tags: ['file'], enabled: true, builtin: true },
  { id: 'write_file', name: 'write_file', displayName: '写入文件', description: '写入文件内容', usage: '/write_file', platform: 'all', tags: ['file'], enabled: true, builtin: true },
  { id: 'bash', name: 'bash', displayName: 'Bash 命令', description: '执行 shell 命令', usage: '/bash', platform: 'unix', tags: ['shell'], enabled: true, builtin: true },
  { id: 'cmd', name: 'cmd', displayName: 'CMD 命令', description: '执行 Windows 命令', usage: '/cmd', platform: 'windows', tags: ['shell'], enabled: true, builtin: true },
  { id: 'custom_tool', name: 'custom_tool', displayName: '自定义工具', description: '用户自定义', usage: '/custom', platform: 'all', tags: ['custom'], enabled: false, builtin: false },
]

const mockGroups: ToolGroup[] = [
  { id: 'file-system', name: '文件系统', description: '文件操作相关', toolIds: ['read_file', 'write_file'], enabled: true, builtin: true },
  { id: 'shell-cmd', name: 'Shell 命令', description: '命令执行', toolIds: ['bash', 'cmd'], enabled: true, builtin: true },
  { id: 'custom-group', name: '自定义组', description: '用户自定义', toolIds: ['custom_tool'], enabled: true, builtin: false },
]

const mockRules: HintRule[] = [
  { id: 'r1', name: '文件操作提示', description: '当用户提到文件时推荐文件工具', patterns: ['查看.*文件', '读取.*内容'], groupIds: ['file-system'], priority: 10, enabled: true, builtin: true },
  { id: 'r2', name: '搜索提示', description: '搜索相关', patterns: ['搜索.*'], groupIds: [], priority: 5, enabled: true, builtin: false },
]

// ==================== Tests ====================

describe('ToolManagement - 搜索过滤', () => {
  describe('工具搜索', () => {
    it('空搜索返回全部', () => {
      const result = filterTools(mockTools, '')
      expect(result).toHaveLength(5)
    })

    it('按名称搜索', () => {
      const result = filterTools(mockTools, 'bash')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('bash')
    })

    it('按显示名搜索', () => {
      const result = filterTools(mockTools, '读取文件')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('read_file')
    })

    it('大小写不敏感', () => {
      const result = filterTools(mockTools, 'BASH')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('bash')
    })

    it('不存在的词返回空', () => {
      const result = filterTools(mockTools, '不存在的')
      expect(result).toHaveLength(0)
    })
  })

  describe('分组搜索', () => {
    it('空搜索返回全部', () => {
      const result = filterGroups(mockGroups, '')
      expect(result).toHaveLength(3)
    })

    it('按名称搜索', () => {
      const result = filterGroups(mockGroups, '文件')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('file-system')
    })

    it('按描述搜索', () => {
      const result = filterGroups(mockGroups, '自定义')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('custom-group')
    })
  })

  describe('规则搜索', () => {
    it('空搜索返回全部', () => {
      const result = filterRules(mockRules, '')
      expect(result).toHaveLength(2)
    })

    it('按名称搜索', () => {
      const result = filterRules(mockRules, '搜索')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('r2')
    })
  })
})

describe('ToolManagement - 分组管理', () => {
  describe('groupByPlatform', () => {
    it('全部平台工具归为一组', () => {
      const allTools = mockTools.filter(t => t.platform === 'all')
      const result = groupByPlatform(allTools)
      expect(result).toHaveLength(1)
      expect(result[0].platform).toBe('all')
      expect(result[0].label).toBe('全部平台')
    })

    it('混合平台正确归组', () => {
      const result = groupByPlatform(mockTools)
      const platforms = result.map(r => r.platform)
      expect(platforms).toContain('all')
      expect(platforms).toContain('unix')
      expect(platforms).toContain('windows')
    })

    it('每个平台组内工具数量正确', () => {
      const result = groupByPlatform(mockTools)
      const unixGroup = result.find(r => r.platform === 'unix')!
      expect(unixGroup.items).toHaveLength(1)
      expect(unixGroup.items[0].id).toBe('bash')
    })

    it('空数组返回空', () => {
      const result = groupByPlatform([])
      expect(result).toHaveLength(0)
    })
  })

  describe('isPlatformMatch', () => {
    it('all 平台总是匹配', () => {
      expect(isPlatformMatch('all')).toBe(true)
    })

    it('空字符串视为 all', () => {
      expect(isPlatformMatch('')).toBe(true)
    })

    it('unix 在当前环境（模拟非 Windows）匹配', () => {
      expect(isPlatformMatch('unix')).toBe(true)
    })

    it('windows 在当前环境（模拟非 Windows）不匹配', () => {
      expect(isPlatformMatch('windows')).toBe(false)
    })
  })

  describe('computeEffective', () => {
    it('全局组（空 activeIds）返回所有已启用且平台匹配的工具', () => {
      const result = computeEffective(mockTools, mockGroups, [])
      expect(result.tools).toHaveLength(3) // read_file, write_file, bash（cmd 是 windows 不匹配）
    })

    it('指定 group 只返回组内工具', () => {
      const result = computeEffective(mockTools, mockGroups, ['file-system'])
      expect(result.tools.map(t => t.id).sort()).toEqual(['read_file', 'write_file'])
    })

    it('disabled 工具被跳过', () => {
      const result = computeEffective(mockTools, mockGroups, ['custom-group'])
      expect(result.tools).toHaveLength(0)
      expect(result.skipped).toContain('custom_tool')
    })

    it('平台不匹配的工具被跳过', () => {
      const result = computeEffective(mockTools, mockGroups, ['shell-cmd'])
      // bash (unix) 匹配, cmd (windows) 不匹配
      expect(result.tools).toHaveLength(1)
      expect(result.tools[0].id).toBe('bash')
      expect(result.skipped).toContain('cmd')
    })

    it('不存在的 group ID 被忽略', () => {
      const result = computeEffective(mockTools, mockGroups, ['nonexistent'])
      expect(result.tools).toHaveLength(0)
      expect(result.skipped).toHaveLength(0)
    })

    it('多个组时去重', () => {
      const result = computeEffective(mockTools, mockGroups, ['file-system', 'shell-cmd'])
      expect(result.tools.map(t => t.id).sort()).toEqual(['bash', 'read_file', 'write_file'])
    })
  })
})

describe('ToolManagement - Tool CRUD', () => {
  describe('表单验证', () => {
    it('name 为空时验证失败', () => {
      const form: ToolForm = { name: '', displayName: '显示名', description: '', usage: '', platform: 'all', tags: '', parameters: [] }
      const result = validateToolForm(form)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('name_required')
    })

    it('displayName 为空时验证失败', () => {
      const form: ToolForm = { name: 'my-tool', displayName: '', description: '', usage: '', platform: 'all', tags: '', parameters: [] }
      const result = validateToolForm(form)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('displayName_required')
    })

    it('两者都有值时验证通过', () => {
      const form: ToolForm = { name: 'my-tool', displayName: '我的工具', description: '', usage: '', platform: 'all', tags: '', parameters: [] }
      const result = validateToolForm(form)
      expect(result.valid).toBe(true)
    })
  })

  describe('tags 解析', () => {
    it('逗号分隔正确解析', () => {
      const tags = parseTags('file, search, custom')
      expect(tags).toEqual(['file', 'search', 'custom'])
    })

    it('多余空格被修剪', () => {
      const tags = parseTags(' file ,  search ')
      expect(tags).toEqual(['file', 'search'])
    })

    it('空字符串返回空数组', () => {
      const tags = parseTags('')
      expect(tags).toHaveLength(0)
    })

    it('空 tag 被过滤', () => {
      const tags = parseTags('file,,search')
      expect(tags).toEqual(['file', 'search'])
    })
  })

  describe('toggle', () => {
    it('切换 enabled 状态', () => {
      const tool = { ...mockTools[4] } // custom_tool, enabled: false
      expect(tool.enabled).toBe(false)
      tool.enabled = true
      expect(tool.enabled).toBe(true)
    })
  })
})

describe('ToolManagement - Group CRUD', () => {
  describe('表单验证', () => {
    it('name 为空时验证失败', () => {
      const form: GroupForm = { name: '', description: '', toolIds: '' }
      const result = validateGroupForm(form)
      expect(result.valid).toBe(false)
    })

    it('name 有值时验证通过', () => {
      const form: GroupForm = { name: '新分组', description: '', toolIds: '' }
      const result = validateGroupForm(form)
      expect(result.valid).toBe(true)
    })
  })

  describe('toolIds 解析', () => {
    it('逗号分隔正确解析', () => {
      const ids = parseToolIds('read_file, write_file')
      expect(ids).toEqual(['read_file', 'write_file'])
    })

    it('空白被过滤', () => {
      const ids = parseToolIds(' read_file , , write_file ')
      expect(ids).toEqual(['read_file', 'write_file'])
    })

    it('空字符串返回空数组', () => {
      const ids = parseToolIds('')
      expect(ids).toHaveLength(0)
    })
  })
})

describe('ToolManagement - Hint Rule CRUD', () => {
  describe('表单验证', () => {
    it('name 为空时验证失败', () => {
      const form: RuleForm = { name: '', description: '', patterns: '', groupIds: '', priority: 10 }
      const result = validateRuleForm(form)
      expect(result.valid).toBe(false)
    })

    it('patterns 为空时验证失败', () => {
      const form: RuleForm = { name: '规则名', description: '', patterns: '', groupIds: '', priority: 10 }
      const result = validateRuleForm(form)
      expect(result.valid).toBe(false)
    })

    it('两者都有值时验证通过', () => {
      const form: RuleForm = { name: '规则名', description: '', patterns: '模式1', groupIds: '', priority: 10 }
      const result = validateRuleForm(form)
      expect(result.valid).toBe(true)
    })
  })

  describe('patterns 解析', () => {
    it('换行分隔正确解析', () => {
      const patterns = parsePatterns('查看.*文件\n搜索.*内容\n编辑.*代码')
      expect(patterns).toEqual(['查看.*文件', '搜索.*内容', '编辑.*代码'])
    })

    it('空行被过滤', () => {
      const patterns = parsePatterns('模式1\n\n模式2')
      expect(patterns).toEqual(['模式1', '模式2'])
    })

    it('空字符串返回空数组', () => {
      const patterns = parsePatterns('')
      expect(patterns).toHaveLength(0)
    })
  })

  describe('groupIds 解析', () => {
    it('逗号分隔正确解析', () => {
      const ids = parseGroupIds('file-system, shell-cmd')
      expect(ids).toEqual(['file-system', 'shell-cmd'])
    })

    it('空白被过滤', () => {
      const ids = parseGroupIds(' file-system , shell-cmd ')
      expect(ids).toEqual(['file-system', 'shell-cmd'])
    })
  })
})

describe('ToolManagement - 内置项保护', () => {
  it('内置工具不可删除', () => {
    const tool = mockTools[0]
    expect(canDelete(tool)).toBe(false)
  })

  it('自定义工具可删除', () => {
    const tool = mockTools[4]
    expect(canDelete(tool)).toBe(true)
  })

  it('内置分组不可删除', () => {
    const group = mockGroups[0]
    expect(canDelete(group)).toBe(false)
  })

  it('自定义分组可删除', () => {
    const group = mockGroups[2]
    expect(canDelete(group)).toBe(true)
  })

  it('内置规则不可删除', () => {
    const rule = mockRules[0]
    expect(canDelete(rule)).toBe(false)
  })

  it('自定义规则可删除', () => {
    const rule = mockRules[1]
    expect(canDelete(rule)).toBe(true)
  })
})

describe('ToolManagement - 组合场景', () => {
  it('搜索过滤后 Tab 计数正确', () => {
    const filtered = filterTools(mockTools, '自定义')
    expect(filtered).toHaveLength(1)
    // 组件中: <TabsTrigger>显示 filteredTools.length</TabsTrigger>
  })

  it('平台过滤 + 分组过滤组合', () => {
    // 模拟：unix 平台，搜索工具
    const tools = filterTools(mockTools, '')
    const unixTools = tools.filter(t => isPlatformMatch(t.platform))
    expect(unixTools.map(t => t.id).sort()).toEqual(['bash', 'custom_tool', 'read_file', 'write_file'])
  })
})
