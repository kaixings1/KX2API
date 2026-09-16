/**
 * toolFileStore 单测 —— 文件化主存储：JSON/XML 双格式读写、迁移、清理
 *
 * 用 mock electron（app.getPath → 每测试独立的临时目录）+ mock storeManager，
 * 直接验证 toolFileStore 对 `userData/tools/{tools,groups,hintRules}/*.json|.xml`
 * 的真实文件读写行为，避免拖入真实 Electron。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import { join } from 'path'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import type { ToolDefinition, ToolGroup, ToolHintRule, ToolManagementStore } from '../types'

// 共享可变的工作目录：electron mock 与测试体都指向它，保证写入与断言语义一致
const tmpCtl = vi.hoisted(() => ({ dir: '' as string }))

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => tmpCtl.dir,
    getVersion: () => '1.0.0',
    isPackaged: false,
  },
}))

const mockStoreData: { data?: ToolManagementStore } = vi.hoisted(() => ({ data: { tools: [], groups: [], hintRules: [] } }))

vi.mock('../../store/store', () => ({
  storeManager: {
    getConfig: () => ({ toolManagement: mockStoreData.data }),
    updateConfig: () => ({}),
  },
}))

import { toolFileStore, migrateCustomRulesFromStore } from '../toolFileStore'

function tool(id: string): ToolDefinition {
  return {
    id, name: id, displayName: id, description: 'd', usage: `/${id}`, platform: 'all',
    parameters: [], tags: [], enabled: true, builtin: false, createdAt: 1, updatedAt: 1,
  }
}
function group(id: string, name: string, toolIds: string[]): ToolGroup {
  return { id, name, description: '', toolIds, enabled: true, builtin: false, createdAt: 1 }
}
function rule(id: string, patterns: string[]): ToolHintRule {
  return { id, name: id, description: '', patterns, groupIds: ['g'], priority: 1, enabled: true, builtin: false, createdAt: 1 }
}

const filePath = (sub: string, id: string, ext: 'json' | 'xml'): string =>
  join(appUserData(), 'tools', sub, `${id}.${ext}`)

function appUserData(): string {
  return tmpCtl.dir
}

beforeEach(() => {
  tmpCtl.dir = mkdtempSync(join(os.tmpdir(), 'kx2-toolfile-'))
  mockStoreData.data = { tools: [], groups: [], hintRules: [] }
})

afterEach(() => {
  if (tmpCtl.dir) {
    rmSync(tmpCtl.dir, { recursive: true, force: true })
    tmpCtl.dir = ''
  }
})

describe('toolFileStore — JSON/XML 双格式读写', () => {
  it('saveTool 写出 .json 与 .xml 两个镜像，listTools 从 JSON 读回', () => {
    const t = tool('my-tool')
    toolFileStore.saveTool(t)
    expect(existsSync(filePath('tools', 'my-tool', 'json'))).toBe(true)
    expect(existsSync(filePath('tools', 'my-tool', 'xml'))).toBe(true)
    const list = toolFileStore.listTools()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('my-tool')
  })

  it('删除 .json 仅留 .xml 时，list 仍能从 XML 兜底读回', () => {
    toolFileStore.saveTool(tool('xml-only'))
    rmSync(filePath('tools', 'xml-only', 'json'), { force: true })
    expect(existsSync(filePath('tools', 'xml-only', 'json'))).toBe(false)
    expect(existsSync(filePath('tools', 'xml-only', 'xml'))).toBe(true)
    const list = toolFileStore.listTools()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('xml-only')
  })

  it('deleteTool 同时移除 json 与 xml', () => {
    toolFileStore.saveTool(tool('gone'))
    toolFileStore.deleteTool('gone')
    expect(existsSync(filePath('tools', 'gone', 'json'))).toBe(false)
    expect(existsSync(filePath('tools', 'gone', 'xml'))).toBe(false)
    expect(toolFileStore.listTools()).toHaveLength(0)
  })

  it('分组/规则同样写文件并从对应子目录读取', () => {
    toolFileStore.saveGroup(group('g1', '文件', ['ls']))
    toolFileStore.saveHintRule(rule('r1', ['查看']))
    const g = toolFileStore.listGroups()
    const rr = toolFileStore.listHintRules()
    expect(g).toHaveLength(1)
    expect(g[0].id).toBe('g1')
    expect(rr).toHaveLength(1)
    expect(rr[0].patterns).toEqual(['查看'])
  })
})

describe('toolFileStore — 迁移与清理', () => {
  it('migrateCustomRulesFromStore 把 store 里非 builtin 导出成文件', () => {
    mockStoreData.data = {
      tools: [tool('custom-a'), { ...tool('builtin-a'), builtin: true }],
      groups: [group('gp', '分成', ['x'])],
      hintRules: [rule('rd', ['k'])],
    }
    const counts = migrateCustomRulesFromStore()
    expect(counts).toEqual({ tools: 1, groups: 1, hintRules: 1 })
    expect(existsSync(filePath('tools', 'builtin-a', 'json'))).toBe(false)
    expect(existsSync(filePath('tools', 'custom-a', 'json'))).toBe(true)
    expect(existsSync(filePath('groups', 'gp', 'json'))).toBe(true)
    expect(existsSync(filePath('hintRules', 'rd', 'json'))).toBe(true)
  })

  it('目录已有文件时不重复迁移（countCustom > 0 → 跳过）', () => {
    toolFileStore.saveTool(tool('existing'))
    const counts = migrateCustomRulesFromStore()
    expect(counts.tools).toBe(0)
    expect(toolFileStore.listTools()).toHaveLength(1)
  })

  it('resetAll 清空所有子目录，且后续 save 能重建', () => {
    toolFileStore.saveTool(tool('a'))
    toolFileStore.saveGroup(group('g', '组', []))
    toolFileStore.resetAll()
    expect(toolFileStore.listTools()).toHaveLength(0)
    expect(toolFileStore.listGroups()).toHaveLength(0)
    const t = tool('b')
    toolFileStore.saveTool(t)
    expect(toolFileStore.listTools()).toEqual([t])
  })
})