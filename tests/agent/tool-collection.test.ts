/**
 * ToolCollection 单元测试
 * 验证工具集合管理模块的核心逻辑
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolCollection, type ToolResult } from '../../src/main/proxy/tools/toolCollection.ts'
import type { Command } from '../../src/main/proxy/tools/toolCollection.ts'

// 创建 mock 命令，不依赖 commandRegistry
function createMockCommand(name: string, description: string, output: string): Command {
  return {
    name,
    description,
    execute: async () => ({ success: true, output }),
  }
}

test('ToolCollection - constructor 接收初始命令', () => {
  const collection = new ToolCollection([
    createMockCommand('cmd1', 'Command 1', 'output1'),
    createMockCommand('cmd2', 'Command 2', 'output2'),
  ])
  assert.strictEqual(collection.getToolNames().length, 2)
  assert.ok(collection.hasTool('cmd1'))
  assert.ok(collection.hasTool('cmd2'))
})

test('ToolCollection - addTool 添加新工具', () => {
  const collection = new ToolCollection()
  const cmd = createMockCommand('test', 'Test', 'result')
  collection.addTool(cmd)
  assert.ok(collection.hasTool('test'))
  assert.strictEqual(collection.getTool('test')!.name, 'test')
})

test('ToolCollection - addTool 重复添加跳过', () => {
  const collection = new ToolCollection()
  const cmd1 = createMockCommand('dup', 'First', 'first')
  const cmd2 = createMockCommand('dup', 'Second', 'second')
  collection.addTool(cmd1)
  collection.addTool(cmd2)
  assert.strictEqual(collection.getToolNames().length, 1)
})

test('ToolCollection - addTools 批量添加', () => {
  const collection = new ToolCollection()
  collection.addTools(
    createMockCommand('a', 'A', 'a'),
    createMockCommand('b', 'B', 'b'),
    createMockCommand('c', 'C', 'c'),
  )
  assert.strictEqual(collection.getToolNames().length, 3)
})

test('ToolCollection - getTool 未找到返回 undefined', () => {
  const collection = new ToolCollection()
  assert.strictEqual(collection.getTool('nonexistent'), undefined)
})

test('ToolCollection - getAllTools 返回所有命令', () => {
  const collection = new ToolCollection([
    createMockCommand('x', 'X', 'x'),
    createMockCommand('y', 'Y', 'y'),
  ])
  const all = collection.getAllTools()
  assert.strictEqual(all.length, 2)
  assert.ok(all.every(t => typeof t.execute === 'function'))
})

test('ToolCollection - execute 成功执行', async () => {
  const collection = new ToolCollection([
    createMockCommand('ok', 'OK', 'success output'),
  ])
  const result: ToolResult = await collection.execute('ok', [])
  assert.ok(result.success)
  assert.strictEqual(result.output, 'success output')
  assert.strictEqual(result.error, undefined)
})

test('ToolCollection - execute 未知命令返回错误', async () => {
  const collection = new ToolCollection()
  const result: ToolResult = await collection.execute('nonexistent', [])
  assert.ok(!result.success)
  assert.ok(result.error?.includes('Unknown tool'))
})

test('ToolCollection - execute 执行异常返回错误', async () => {
  const collection = new ToolCollection([{
    name: 'failing',
    description: 'Fails',
    execute: async () => { throw new Error('boom') },
  }])
  const result: ToolResult = await collection.execute('failing', [])
  assert.ok(!result.success)
  assert.ok(result.error?.includes('boom'))
})

test('ToolCollection - executeAll 执行所有命令', async () => {
  const collection = new ToolCollection([
    createMockCommand('a', 'A', 'a-out'),
    createMockCommand('b', 'B', 'b-out'),
  ])
  const results = await collection.executeAll()
  assert.strictEqual(results.length, 2)
  assert.ok(results.every(r => r.success))
})

test('ToolCollection - syncFromRegistry 从全局注册表同步', () => {
  // 使用独立实例测试 syncFromRegistry，避免修改全局实例
  const collection = new ToolCollection()
  // 先添加一些自有工具
  collection.addTool(createMockCommand('own', 'Own', 'own'))
  const before = collection.getToolNames().length
  // syncFromRegistry 会把 registry 中已有的命令加入（不覆盖）
  collection.syncFromRegistry()
  const after = collection.getToolNames().length
  assert.ok(after >= before, `syncFromRegistry 后数量不应减少: ${before} -> ${after}`)
})
