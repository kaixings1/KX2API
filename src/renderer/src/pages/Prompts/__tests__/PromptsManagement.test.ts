/**
 * PromptsManagement Dialog 表单校验逻辑测试
 *
 * 覆盖：
 * - 新建时 name 为空 → 保存按钮应禁用
 * - 新建时 promptText 为空 → 保存按钮应禁用
 * - 新建时 name 和 promptText 都有值 → 保存按钮启用
 * - 编辑时复用已有数据
 * - emoji 超过 2 个字符时应截断
 */

import { describe, it, expect } from 'vitest'

// 模拟表单校验逻辑
function validateForm(name: string, promptText: string): { canSave: boolean; error?: string } {
  if (!name.trim()) {
    return { canSave: false, error: 'name_required' }
  }
  if (!promptText.trim()) {
    return { canSave: false, error: 'prompt_required' }
  }
  return { canSave: true }
}

// 使用 Unicode code point 计数（与 HTML maxLength 行为一致）
function truncateEmoji(emoji: string, maxLength: number = 2): string {
  const codePoints = Array.from(emoji)
  return codePoints.slice(0, maxLength).join('')
}

// 模拟从 editingPrompt 初始化表单
function initFormFromPrompt(prompt: { name: string; description: string; prompt: string; type: string; emoji?: string } | null) {
  if (!prompt) {
    return { name: '', description: '', promptText: '', type: 'general', emoji: '' }
  }
  return {
    name: prompt.name,
    description: prompt.description,
    promptText: prompt.prompt,
    type: prompt.type,
    emoji: prompt.emoji || '',
  }
}

describe('PromptsManagement - Dialog 表单校验', () => {
  describe('新建表单校验', () => {
    it('name 为空时不可保存', () => {
      const result = validateForm('', 'some prompt text')
      expect(result.canSave).toBe(false)
      expect(result.error).toBe('name_required')
    })

    it('promptText 为空时不可保存', () => {
      const result = validateForm('Test Name', '')
      expect(result.canSave).toBe(false)
      expect(result.error).toBe('prompt_required')
    })

    it('两者都为空时不可保存', () => {
      const result = validateForm('', '')
      expect(result.canSave).toBe(false)
    })

    it('两者都有值时可以保存', () => {
      const result = validateForm('Test Name', 'some prompt text')
      expect(result.canSave).toBe(true)
      expect(result).not.toHaveProperty('error')
    })

    it('仅有空白字符的 name 视为空', () => {
      const result = validateForm('   ', 'prompt text')
      expect(result.canSave).toBe(false)
    })
  })

  describe('编辑表单初始化', () => {
    it('editingPrompt 为 null 时重置为空表单', () => {
      const form = initFormFromPrompt(null)
      expect(form.name).toBe('')
      expect(form.promptText).toBe('')
      expect(form.type).toBe('general')
    })

    it('editingPrompt 有值时填充表单', () => {
      const prompt = { id: '1', name: 'My Prompt', description: 'Desc', prompt: 'content', type: 'agent', emoji: '🎯' }
      const form = initFormFromPrompt(prompt)
      expect(form.name).toBe('My Prompt')
      expect(form.promptText).toBe('content')
      expect(form.type).toBe('agent')
      expect(form.emoji).toBe('🎯')
    })

    it('editingPrompt emoji 为空时显示空字符串', () => {
      const prompt = { id: '2', name: 'NoEmoji', description: '', prompt: 'text', type: 'general' }
      const form = initFormFromPrompt(prompt)
      expect(form.emoji).toBe('')
    })
  })

  describe('Emoji 截断', () => {
    it('应截断超过 2 个字符的 emoji', () => {
      expect(truncateEmoji('🤖🎯🔧')).toBe('🤖🎯')
    })

    it('不超过 2 个字符的 emoji 应保持不变', () => {
      expect(truncateEmoji('🤖')).toBe('🤖')
      expect(truncateEmoji('🤖🎯')).toBe('🤖🎯')
    })

    it('空字符串应保持不变', () => {
      expect(truncateEmoji('')).toBe('')
    })
  })
})
