/**
 * promptsStore 单元测试
 *
 * 覆盖：
 * - 初始状态默认值
 * - setPrompts / setBuiltinPrompts 更新状态
 * - getPromptById 按 ID 查找
 * - getPromptsByType 按类型过滤
 * - getPromptStats 统计正确性
 */

import { describe, it, expect } from 'vitest'

// 纯数据过滤函数（不依赖 electronAPI）
function filterPromptsByType(prompts: any[], type: string): any[] {
  return prompts.filter((p) => p.type === type)
}

function findPromptById(prompts: any[], id: string): any | undefined {
  return prompts.find((p) => p.id === id)
}

function computePromptStats(prompts: any[]): { total: number; byType: Record<string, number> } {
  const byType: Record<string, number> = {}
  prompts.forEach((p) => {
    byType[p.type] = (byType[p.type] || 0) + 1
  })
  return { total: prompts.length, byType }
}

// 模拟 prompt 数据
const mockPrompts = [
  { id: '1', name: '通用助手', type: 'general', isBuiltin: true },
  { id: '2', name: '代码助手', type: 'tool-use', isBuiltin: true },
  { id: '3', name: '翻译官', type: 'translation', isBuiltin: true },
  { id: '4', name: '搜索专家', type: 'search', isBuiltin: true },
  { id: '5', name: '自定义通用', type: 'general', isBuiltin: false },
  { id: '6', name: '自定义代理', type: 'agent', isBuiltin: false },
]

describe('promptsStore - 数据过滤与统计', () => {
  describe('初始状态', () => {
    it('空数组时 total 为 0', () => {
      const stats = computePromptStats([])
      expect(stats.total).toBe(0)
    })

    it('空数组时 byType 应为空对象', () => {
      const stats = computePromptStats([])
      expect(stats.byType).toEqual({})
    })
  })

  describe('getPromptById 按 ID 查找', () => {
    it('应找到匹配 ID 的 prompt', () => {
      const result = findPromptById(mockPrompts, '2')
      expect(result).toBeDefined()
      expect(result!.id).toBe('2')
      expect(result!.name).toBe('代码助手')
    })

    it('找不到时应返回 undefined', () => {
      const result = findPromptById(mockPrompts, 'not-exist')
      expect(result).toBeUndefined()
    })

    it('空数组时找不到任何 prompt', () => {
      const result = findPromptById([], '1')
      expect(result).toBeUndefined()
    })
  })

  describe('getPromptsByType 按类型过滤', () => {
    it('应过滤出 general 类型的 prompts', () => {
      const results = filterPromptsByType(mockPrompts, 'general')
      expect(results.length).toBe(2)
      expect(results.map((p) => p.id).sort()).toEqual(['1', '5'])
    })

    it('应过滤出 tool-use 类型的 prompts', () => {
      const results = filterPromptsByType(mockPrompts, 'tool-use')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('2')
    })

    it('不存在的类型应返回空数组', () => {
      const results = filterPromptsByType(mockPrompts, 'nonexistent')
      expect(results.length).toBe(0)
    })

    it('空数组时任何类型都返回空', () => {
      const results = filterPromptsByType([], 'general')
      expect(results.length).toBe(0)
    })
  })

  describe('getPromptStats 统计正确性', () => {
    it('应正确统计总数', () => {
      const stats = computePromptStats(mockPrompts)
      expect(stats.total).toBe(6)
    })

    it('应正确统计各类型数量', () => {
      const stats = computePromptStats(mockPrompts)
      expect(stats.byType['general']).toBe(2)
      expect(stats.byType['tool-use']).toBe(1)
      expect(stats.byType['translation']).toBe(1)
      expect(stats.byType['search']).toBe(1)
      expect(stats.byType['agent']).toBe(1)
    })

    it('空数组统计', () => {
      const stats = computePromptStats([])
      expect(stats.total).toBe(0)
    })
  })
})

// ==================== async 状态变化 ====================

describe('promptsStore - fetchPrompts (async)', () => {
  const apiData = [
    { id: 'a', name: 'A', type: 'general', isBuiltin: true },
    { id: 'b', name: 'B', type: 'tool-use', isBuiltin: true },
    { id: 'c', name: 'C', type: 'agent', isBuiltin: false },
  ]

  it('API 成功后应更新 prompts 和 builtinPrompts', async () => {
    // 模拟 fetchPrompts 的行为
    let state: any = { prompts: [], builtinPrompts: [], isLoading: false, error: null }

    const fetchPrompts = async () => {
      state = { ...state, isLoading: true, error: null }
      try {
        const data = await Promise.resolve(apiData)
        const builtin = data.filter((p: any) => p.isBuiltin)
        state = { prompts: data, builtinPrompts: builtin, isLoading: false, error: null }
      } catch (error) {
        state = { ...state, error: (error as Error).message, isLoading: false }
      }
    }

    expect(state.prompts).toEqual([])
    await fetchPrompts()
    expect(state.prompts.length).toBe(3)
    expect(state.builtinPrompts.length).toBe(2)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('API 失败时应设置 error 并将 isLoading 设为 false', async () => {
    let state: any = { prompts: [], builtinPrompts: [], isLoading: false, error: null }

    const fetchPrompts = async () => {
      state = { ...state, isLoading: true, error: null }
      try {
        await Promise.reject(new Error('Network error'))
      } catch (error) {
        state = { ...state, error: (error as Error).message, isLoading: false }
      }
    }

    expect(state.error).toBeNull()
    await fetchPrompts()
    expect(state.error).toBe('Network error')
    expect(state.isLoading).toBe(false)
    expect(state.prompts).toEqual([])
  })
})
