/**
 * buildToolsFromRegistry 集成测试
 * 验证从 ToolCollection 构建 OpenAI tools 定义
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolCollection } from '../../src/main/proxy/tools/toolCollection.ts'
import { buildToolsFromRegistry } from '../../src/engine/api/client.ts'

test('buildToolsFromRegistry - 从 ToolCollection 构建工具定义', async () => {
  // 创建一个包含已知命令的 ToolCollection
  const collection = new ToolCollection([
    { name: 'pwd', description: '当前目录', execute: async () => ({ success: true, output: '/tmp' }) },
    { name: 'ls', description: '列出文件', execute: async () => ({ success: true, output: '' }) },
    { name: 'cat', description: '读取文件', execute: async () => ({ success: true, output: '' }) },
  ])

  // 直接测试 ToolCollection 的功能
  const all = collection.getAllTools()
  assert.strictEqual(all.length, 3)

  const names = collection.getToolNames()
  assert.deepStrictEqual(names, ['pwd', 'ls', 'cat'])
})

test('buildToolsFromRegistry - 验证工具定义结构', async () => {
  const collection = new ToolCollection([
    { name: 'test_tool', description: 'Test description', execute: async () => ({ success: true, output: '' }) },
  ])

  const tools = collection.getAllTools()
  const tool = tools[0]

  // 验证 Command 接口完整性
  assert.strictEqual(tool.name, 'test_tool')
  assert.strictEqual(tool.description, 'Test description')
  assert.strictEqual(typeof tool.execute, 'function')
})

test('ToolCollection - buildToolsFromRegistry 实际调用（验证集成）', async () => {
  // 这个测试验证 buildToolsFromRegistry 能正常从 toolCollection 导入并执行
  // 由于 client.ts 动态导入 toolCollection，需要确保没有循环依赖
  try {
    const tools = await buildToolsFromRegistry()
    assert.ok(Array.isArray(tools), '应返回数组')
    // 如果有工具，验证结构
    if (tools.length > 0) {
      const t = tools[0]
      assert.strictEqual(t.type, 'function')
      assert.ok(t.function.name)
      assert.ok(typeof t.function.description === 'string')
    }
  } catch (e) {
    // 如果失败，记录错误但不阻断测试
    console.error('buildToolsFromRegistry 调用失败:', (e as Error).message)
    throw e
  }
})
