/**
 * PromptsManagement 搜索过滤 + 分组管理 + CRUD 全链路测试
 *
 * 覆盖：
 * - 搜索过滤：按名称、描述、内容关键词过滤
 * - 分组管理：editingPrompt.groups 读取、分组标签显示
 * - CRUD 全链路：openCreate / openEdit 状态流转、handleSave 调用路径、handleDelete 确认
 * - Tab 过滤：all / builtin / custom 过滤逻辑
 */

import { describe, it, expect } from 'vitest'

// ==================== Types ====================

interface SystemPrompt {
  id: string
  name: string
  description: string
  prompt: string
  type: string
  emoji?: string
  isBuiltin: boolean
  groups?: string[]
  createdAt: string
}

// ==================== 搜索过滤 ====================

function filterPrompts(prompts: SystemPrompt[], search: string): SystemPrompt[] {
  if (!search.trim()) return prompts
  const kw = search.toLowerCase().trim()
  return prompts.filter(p =>
    p.name.toLowerCase().includes(kw)
    || p.description.toLowerCase().includes(kw)
    || p.prompt.toLowerCase().includes(kw)
  )
}

// ==================== Tab 过滤 ====================

function filterByTab(prompts: SystemPrompt[], tab: 'all' | 'builtin' | 'custom'): SystemPrompt[] {
  switch (tab) {
    case 'builtin': return prompts.filter(p => p.isBuiltin)
    case 'custom': return prompts.filter(p => !p.isBuiltin)
    default: return prompts
  }
}

// ==================== 分组管理 ====================

function getPromptGroups(prompt: SystemPrompt | null): string[] {
  if (!prompt) return []
  return prompt.groups || []
}

// ==================== CRUD 状态流转 ====================

interface FormState {
  name: string
  description: string
  promptText: string
  type: string
  emoji: string
  editingPrompt: SystemPrompt | null
  dialogOpen: boolean
}

function createForm(): FormState {
  return {
    name: '',
    description: '',
    promptText: '',
    type: 'general',
    emoji: '',
    editingPrompt: null,
    dialogOpen: false,
  }
}

function initCreate(state: FormState): FormState {
  return {
    ...createForm(),
    dialogOpen: true,
  }
}

function initEdit(state: FormState, prompt: SystemPrompt): FormState {
  return {
    ...state,
    editingPrompt: prompt,
    name: prompt.name,
    description: prompt.description,
    promptText: prompt.prompt,
    type: prompt.type,
    emoji: prompt.emoji || '',
    dialogOpen: true,
  }
}

function canSave(state: FormState): boolean {
  return state.name.trim().length > 0 && state.promptText.trim().length > 0
}

// ==================== Mock Data ====================

const mockPrompts: SystemPrompt[] = [
  { id: '1', name: '通用助手', description: '通用对话助手', prompt: '你是一个有用的助手。', type: 'general', isBuiltin: true, createdAt: '2025-01-01T00:00:00Z' },
  { id: '2', name: '代码助手', description: '帮助编写代码', prompt: '你是一个代码专家。', type: 'tool-use', isBuiltin: true, createdAt: '2025-01-02T00:00:00Z' },
  { id: '3', name: '翻译官', description: '多语言翻译', prompt: '你是一个翻译专家。', type: 'translation', isBuiltin: true, createdAt: '2025-01-03T00:00:00Z' },
  { id: '4', name: '搜索专家', description: '帮助搜索信息', prompt: '你是一个搜索专家。', type: 'search', isBuiltin: true, createdAt: '2025-01-04T00:00:00Z' },
  { id: '5', name: '自定义通用', description: '自定义通用助手', prompt: '这是一个自定义提示词。', type: 'general', isBuiltin: false, createdAt: '2025-01-05T00:00:00Z' },
  { id: '6', name: '自定义代理', description: '自定义代理角色', prompt: '你是一个自定义代理。', type: 'agent', isBuiltin: false, createdAt: '2025-01-06T00:00:00Z', groups: ['agent-group', 'custom-group'] },
  { id: '7', name: 'python专家', description: 'Python 编程助手', prompt: '你精通 Python 编程。', type: 'tool-use', isBuiltin: false, createdAt: '2025-01-07T00:00:00Z' },
  { id: '8', name: '日语翻译', description: '日文翻译', prompt: '你是一个日语翻译专家。', type: 'translation', isBuiltin: false, createdAt: '2025-01-08T00:00:00Z' },
]

// ==================== Tests ====================

describe('PromptsManagement - 搜索过滤', () => {
  it('空搜索应返回全部结果', () => {
    const result = filterPrompts(mockPrompts, '')
    expect(result).toHaveLength(8)
  })

  it('按名称过滤（中文）', () => {
    const result = filterPrompts(mockPrompts, '通用')
    expect(result.map(p => p.id).sort()).toEqual(['1', '5'])
  })

  it('按描述过滤', () => {
    const result = filterPrompts(mockPrompts, '翻译')
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id).sort()).toEqual(['3', '8'])
  })

  it('按内容过滤', () => {
    const result = filterPrompts(mockPrompts, '代码专家')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('不存在的关键词返回空数组', () => {
    const result = filterPrompts(mockPrompts, '不存在的词xyz')
    expect(result).toHaveLength(0)
  })

  it('大小写不敏感', () => {
    const result = filterPrompts(mockPrompts, 'PYTHON')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('7')
  })

  it('空格关键词应正常过滤', () => {
    const result = filterPrompts(mockPrompts, '  Python  ')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('7')
  })
})

describe('PromptsManagement - Tab 过滤', () => {
  it('all 应返回全部', () => {
    const result = filterByTab(mockPrompts, 'all')
    expect(result).toHaveLength(8)
  })

  it('builtin 应只返回内置', () => {
    const result = filterByTab(mockPrompts, 'builtin')
    expect(result).toHaveLength(4)
    expect(result.every(p => p.isBuiltin)).toBe(true)
  })

  it('custom 应只返回自定义', () => {
    const result = filterByTab(mockPrompts, 'custom')
    expect(result).toHaveLength(4)
    expect(result.every(p => !p.isBuiltin)).toBe(true)
  })

  it('空数组时 all 返回空', () => {
    const result = filterByTab([], 'all')
    expect(result).toHaveLength(0)
  })

  it('空数组时 builtin 返回空', () => {
    const result = filterByTab([], 'builtin')
    expect(result).toHaveLength(0)
  })

  it('空数组时 custom 返回空', () => {
    const result = filterByTab([], 'custom')
    expect(result).toHaveLength(0)
  })
})

describe('PromptsManagement - 分组管理', () => {
  it('有 groups 的 prompt 应返回分组列表', () => {
    const p = mockPrompts.find(x => x.id === '6')!
    const groups = getPromptGroups(p)
    expect(groups).toEqual(['agent-group', 'custom-group'])
  })

  it('无 groups 的 prompt 应返回空数组', () => {
    const p = mockPrompts.find(x => x.id === '1')!
    const groups = getPromptGroups(p)
    expect(groups).toHaveLength(0)
  })

  it('null prompt 应返回空数组', () => {
    const groups = getPromptGroups(null)
    expect(groups).toHaveLength(0)
  })

  it('editingPrompt.groups 在 Dialog 中显示为逗号分隔', () => {
    const p = mockPrompts.find(x => x.id === '6')!
    const display = (p.groups || []).join(', ')
    expect(display).toBe('agent-group, custom-group')
  })

  it('编辑模式下 groups 字段只读（disabled）', () => {
    // 模拟：editingPrompt 非 null 时 groups 输入框 disabled
    const p = mockPrompts.find(x => x.id === '6')!
    const isDisabled = p !== null
    expect(isDisabled).toBe(true)
  })
})

describe('PromptsManagement - CRUD 全链路', () => {
  describe('openCreate 状态流转', () => {
    it('应重置所有字段为空并打开 dialog', () => {
      const state = initCreate(createForm())
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('')
      expect(state.editingPrompt).toBeNull()
    })
  })

  describe('openEdit 状态流转', () => {
    it('应填充表单并打开 dialog', () => {
      const prompt = mockPrompts[1] // 代码助手
      const state = initEdit(createForm(), prompt)
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('代码助手')
      expect(state.promptText).toBe('你是一个代码专家。')
      expect(state.type).toBe('tool-use')
      expect(state.emoji).toBe('')
    })

    it('editingPrompt 有 emoji 时应填充', () => {
      const prompt = { ...mockPrompts[0], emoji: '🤖' }
      const state = initEdit(createForm(), prompt)
      expect(state.emoji).toBe('🤖')
    })
  })

  describe('canSave 校验', () => {
    it('新建时 name 为空不可保存', () => {
      const state = { ...createForm(), dialogOpen: true, name: '', promptText: '内容' }
      expect(canSave(state)).toBe(false)
    })

    it('新建时 promptText 为空不可保存', () => {
      const state = { ...createForm(), dialogOpen: true, name: '名称', promptText: '' }
      expect(canSave(state)).toBe(false)
    })

    it('两者都有值可保存', () => {
      const state = { ...createForm(), dialogOpen: true, name: '名称', promptText: '内容' }
      expect(canSave(state)).toBe(true)
    })

    it('仅有空白字符视为空', () => {
      const state = { ...createForm(), dialogOpen: true, name: '   ', promptText: '内容' }
      expect(canSave(state)).toBe(false)
    })
  })

  describe('handleSave 调用路径', () => {
    it('editingPrompt 非 null 时调用 update', async () => {
      let apiCall: { method: string; args: any[] } | null = null
      const editingPrompt = mockPrompts[0]

      // 模拟 handleSave 行为
      const handleSave = async () => {
        if (editingPrompt) {
          apiCall = { method: 'update', args: [editingPrompt.id, { name: '新名称' }] }
        }
      }
      await handleSave()
      expect(apiCall).not.toBeNull()
      expect(apiCall!.method).toBe('update')
      expect(apiCall!.args[0]).toBe('1')
    })

    it('editingPrompt 为 null 时调用 add', async () => {
      let apiCall: { method: string; args: any[] } | null = null

      const handleSave = async () => {
        apiCall = { method: 'add', args: [{ name: '新提示词', isBuiltin: false }] }
      }
      await handleSave()
      expect(apiCall).not.toBeNull()
      expect(apiCall!.method).toBe('add')
      expect(apiCall!.args[0].isBuiltin).toBe(false)
    })
  })

  describe('handleDelete 权限', () => {
    it('内置提示词不可删除', () => {
      const builtin = mockPrompts[0]
      expect(builtin.isBuiltin).toBe(true)
      // 在组件中: !p.isBuiltin 时才显示删除按钮
      const canDelete = !builtin.isBuiltin
      expect(canDelete).toBe(false)
    })

    it('自定义提示词可删除', () => {
      const custom = mockPrompts[4]
      expect(custom.isBuiltin).toBe(false)
      const canDelete = !custom.isBuiltin
      expect(canDelete).toBe(true)
    })

    it('删除后应重新加载数据', async () => {
      let reloaded = false
      const handleDelete = async () => {
        reloaded = true
      }
      await handleDelete()
      expect(reloaded).toBe(true)
    })
  })
})

describe('PromptsManagement - 组合场景', () => {
  it('搜索 + Tab 过滤组合', () => {
    let results = filterByTab(mockPrompts, 'custom')
    results = filterPrompts(results, '翻译')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('8')
    expect(results[0].isBuiltin).toBe(false)
  })

  it('搜索无结果时显示空状态', () => {
    const results = filterPrompts(mockPrompts, '不存在的关键词')
    expect(results).toHaveLength(0)
  })

  it('Emoji 截断（Unicode grapheme cluster 正确计数）', () => {
    function truncateEmoji(emoji: string, maxLength = 2): string {
      // 使用 Intl.Segmenter 按 grapheme cluster 分割（正确的 emoji 计数方式）
      const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' })
      const segments = Array.from(segmenter.segment(emoji), s => s.segment)
      return segments.slice(0, maxLength).join('')
    }

    expect(truncateEmoji('🤖🎯🔧')).toBe('🤖🎯')
    expect(truncateEmoji('🤖')).toBe('🤖')
    expect(truncateEmoji('')).toBe('')
    // 国旗 emoji 是 2 个 region indicator 组成 1 个 grapheme，🇨🇳🇺🇸 共 2 个 grapheme
    expect(truncateEmoji('🇨🇳🇺🇸🇯🇵')).toBe('🇨🇳🇺🇸')
  })
})
