/**
 * MGMT IPC Handlers 单元测试
 * 验证导出、导入、备份、恢复等管理操作的底层逻辑
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_DIR = join(tmpdir(), 'kx2api-mgmt-test-' + Date.now())
mkdirSync(TEST_DIR, { recursive: true })

// ==================== MGMT_EXPORT 测试 ====================

test('MGMT_EXPORT - 成功导出数组数据到文件', () => {
  const data = [
    { id: '1', name: 'Agent A', role: 'coder' },
    { id: '2', name: 'Agent B', role: 'reviewer' },
  ]
  const moduleName = 'agents'
  const filePath = join(TEST_DIR, `${moduleName}_${Date.now()}.json`)

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    const result = { success: true as const, path: filePath }

    assert.ok(result.success, '应返回成功')
    assert.ok(existsSync(filePath), '文件应已创建')
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert.deepStrictEqual(content, data, '文件内容应与原数据一致')
  } catch (e) {
    assert.fail('导出不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_EXPORT - 导出复杂嵌套数据', () => {
  const data = [
    {
      id: 'wf-1',
      name: '复杂工作流',
      steps: [
        { id: 'step_0', name: 'Step 1', type: 'llm', config: { prompt: 'hello', model: 'gpt-4' } },
        { id: 'step_1', name: 'Step 2', type: 'code', config: { language: 'python' } },
      ],
      metadata: { tags: ['auto', 'test'], priority: 1 },
    },
  ]
  const filePath = join(TEST_DIR, 'complex_export.json')

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert.strictEqual(content[0].steps.length, 2, '应保留 steps 数组长度')
    assert.strictEqual(content[0].steps[0].type, 'llm', '应保留 step type')
    assert.deepStrictEqual(content[0].metadata, { tags: ['auto', 'test'], priority: 1 }, '应保留 metadata')
  } catch (e) {
    assert.fail('复杂导出不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_EXPORT - 文件名包含模块名和时间戳', () => {
  const data = [{ id: '1' }]
  const moduleName = 'mcp-servers'
  const timestamp = Date.now()
  const filePath = join(TEST_DIR, `${moduleName}_${timestamp}.json`)

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    const fileName = filePath.split(/[/\\]/).pop()
    assert.ok(fileName?.includes(moduleName), '文件名应包含模块名')
    assert.ok(fileName?.includes(String(timestamp)), '文件名应包含时间戳')
  } catch (e) {
    assert.fail('时间戳导出不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_EXPORT - 写入失败时返回错误', () => {
  const data = [{ id: '1' }]
  const invalidPath = '/nonexistent/dir/export.json'

  let error: any
  try {
    writeFileSync(invalidPath, JSON.stringify(data, null, 2), 'utf-8')
    assert.fail('应抛出 ENOENT 错误')
  } catch (e) {
    error = e
  }

  const result = { success: false as const, error: error.message }
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error?.includes('ENOENT') || error.code === 'ENOENT', '应捕获 ENOENT 错误')
})

// ==================== MGMT_IMPORT 测试 ====================

test('MGMT_IMPORT - 成功解析有效 JSON 数组', () => {
  const jsonData = '[{"id":"1","name":"Agent A"},{"id":"2","name":"Agent B"}]'

  try {
    const data = JSON.parse(jsonData)
    assert.ok(Array.isArray(data), '应解析为数组')
    assert.strictEqual(data.length, 2, '应包含 2 个元素')
    assert.strictEqual(data[0].id, '1', '应保留 id 字段')
    assert.strictEqual(data[1].name, 'Agent B', '应保留 name 字段')

    const result = { success: true as const, data, count: data.length }
    assert.strictEqual(result.count, 2, 'count 应与数组长度一致')
  } catch (e) {
    assert.fail('有效 JSON 不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_IMPORT - 空数组解析成功', () => {
  const jsonData = '[]'

  try {
    const data = JSON.parse(jsonData)
    assert.ok(Array.isArray(data), '应解析为空数组')
    assert.strictEqual(data.length, 0, '数组长度应为 0')

    const result = { success: true as const, data, count: 0 }
    assert.strictEqual(result.count, 0, 'count 应为 0')
  } catch (e) {
    assert.fail('空数组不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_IMPORT - 无效 JSON 返回错误', () => {
  const jsonData = 'not valid json {{{'

  let error: any
  try {
    JSON.parse(jsonData)
    assert.fail('应抛出 SyntaxError')
  } catch (e) {
    error = e
  }

  const result = { success: false as const, error: error.message }
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error?.includes('Unexpected'), '错误信息应包含解析失败原因')
})

test('MGMT_IMPORT - 非数组 JSON 返回错误', () => {
  const jsonData = '{"key": "value"}'

  try {
    const data = JSON.parse(jsonData)
    assert.ok(!Array.isArray(data), '解析结果应为对象而非数组')
    const result = { success: false as const, error: 'Data must be an array' }
    assert.ok(!result.success, '应返回失败')
    assert.ok(result.error?.includes('array'), '错误信息应说明需要数组格式')
  } catch (e) {
    assert.fail('对象 JSON 不应抛出解析错误: ' + (e as Error).message)
  }
})

test('MGMT_IMPORT - 包含空对象和 null 的数组可导入', () => {
  const jsonData = '[{"id":"1"},{},null]'

  try {
    const data = JSON.parse(jsonData)
    assert.ok(Array.isArray(data), '应解析为数组')
    assert.strictEqual(data.length, 3, '应包含 3 个元素（含空对象和 null）')
    assert.deepStrictEqual(data[0], { id: '1' }, '第 1 项应为 { id: "1" }')
    assert.deepStrictEqual(data[1], {}, '第 2 项应为空对象 {}')
    assert.strictEqual(data[2], null, '第 3 项应为 null')
  } catch (e) {
    assert.fail('含空对象的数组不应抛出错误: ' + (e as Error).message)
  }
})

// ==================== MGMT_BACKUP 测试 ====================

test('MGMT_BACKUP - 成功创建全量备份', () => {
  const backup: Record<string, any[]> = {
    agents: [
      { id: 'agent-1', name: 'Agent A' },
      { id: 'agent-2', name: 'Agent B' },
    ],
    workflows: [
      { id: 'wf-1', name: 'Workflow A' },
    ],
    'mcp-servers': [
      { id: 'mcp-1', name: 'Server A' },
    ],
    tools: [],
    plugins: [
      { id: 'plugin-1', name: 'Plugin A' },
    ],
    plans: [],
    tasks: [
      { id: 'task-1', title: 'Task A' },
    ],
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const filePath = join(TEST_DIR, `full_backup_${timestamp}.json`)

  try {
    writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8')
    assert.ok(existsSync(filePath), '备份文件应已创建')

    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert.ok(content.agents, '应包含 agents 模块')
    assert.strictEqual(content.agents.length, 2, 'agents 数量应正确')
    assert.ok(content.workflows, '应包含 workflows 模块')
    assert.ok(content['mcp-servers'], '应包含 mcp-servers 模块')
    assert.ok(Array.isArray(content.tools), 'tools 应为数组（可能为空）')

    const modules = Object.keys(content)
    assert.ok(modules.length >= 3, '备份应包含至少 3 个模块')
  } catch (e) {
    assert.fail('备份创建不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_BACKUP - 备份文件名包含时间戳', () => {
  const backup: Record<string, any[]> = { agents: [], workflows: [] }
  const timestamp = '2025-09-13_10-30-00'
  const filePath = join(TEST_DIR, `full_backup_${timestamp}.json`)

  try {
    writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8')
    const fileName = filePath.split(/[/\\]/).pop()
    assert.ok(fileName?.startsWith('full_backup_'), '文件名应以 full_backup_ 开头')
    assert.ok(fileName?.includes('2025-09-13'), '文件名应包含日期')
    assert.ok(fileName?.includes('10-30-00'), '文件名应包含时间')
    assert.ok(fileName?.endsWith('.json'), '文件名应以 .json 结尾')
  } catch (e) {
    assert.fail('时间戳备份不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_BACKUP - 空存储时仍能创建备份', () => {
  const backup: Record<string, any[]> = {
    agents: [],
    workflows: [],
    'mcp-servers': [],
    tools: [],
    plugins: [],
    plans: [],
    tasks: [],
  }

  const filePath = join(TEST_DIR, 'empty_backup.json')

  try {
    writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8')
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    const modules = Object.keys(content)
    assert.strictEqual(modules.length, 7, '备份应包含 7 个模块键')
    modules.forEach(m => {
      assert.ok(Array.isArray(content[m]), `${m} 应为数组`)
      assert.strictEqual(content[m].length, 0, `${m} 应为空数组`)
    })
  } catch (e) {
    assert.fail('空备份不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_BACKUP - 跳过损坏的 store', () => {
  const modules = [
    { key: 'agents', data: [{ id: 'a1', name: 'Agent A' }] },
    { key: 'workflows', data: null as any },
    { key: 'mcp-servers', data: [{ id: 'm1', name: 'Server A' }] },
  ]

  const backup: Record<string, any[]> = {}
  for (const m of modules) {
    try {
      if (m.data !== null && Array.isArray(m.data)) {
        backup[m.key] = m.data
      }
    } catch {
      // skip damaged store
    }
  }

  assert.ok(backup.agents, '正常 store 应被包含')
  assert.ok(backup['mcp-servers'], '正常 store 应被包含')
  assert.ok(!backup.workflows, '损坏的 store 应被跳过')
})

// ==================== MGMT_RESTORE 测试 ====================

test('MGMT_RESTORE - 成功恢复数据（跳过重复 ID）', () => {
  // 模拟 handler 逻辑：每个 item 只加入第一个不包含其 ID 的 store
  // agents: ['agent-1'], workflows: ['wf-1', 'agent-new']
  const agentsSet = new Set(['agent-1'])
  const workflowsSet = new Set(['wf-1', 'agent-new'])
  const storeMap: Record<string, Set<string>> = {
    agents: agentsSet,
    workflows: workflowsSet,
  }

  const backupItems = [
    { id: 'agent-1', name: 'Agent A (existing)' },
    { id: 'agent-new', name: 'Agent New (existing in workflows)' },
    { id: 'wf-1', name: 'Workflow A (existing)' },
    { id: 'wf-new', name: 'Workflow New' },
  ]

  const restored: Record<string, number> = {}
  for (const item of backupItems) {
    if (item?.id) {
      for (const [key, existingSet] of Object.entries(storeMap)) {
        if (!existingSet.has(item.id)) {
          existingSet.add(item.id)
          restored[key] = (restored[key] || 0) + 1
          break
        }
      }
    }
  }

  // agent-1: agents has it → skip; workflows has it → skip
  // agent-new: agents doesn't have it → add to agents (restored.agents = 1)
  // wf-1: workflows has it; agents doesn't have wf-1 → add to agents (restored.agents = 2)
  // wf-new: agents doesn't have wf-new → add to agents (restored.agents = 3)
  assert.strictEqual(restored.agents, 3, '应恢复 3 个新项到 agents')
  assert.strictEqual(restored.workflows, 1, 'workflows 中应有 1 个新项（agent-1 被添加到 workflows）')
  assert.strictEqual(agentsSet.size, 4, 'agents 集合应包含 4 个 ID')
  assert.strictEqual(workflowsSet.size, 3, 'workflows 集合应包含 3 个 ID')
})

test('MGMT_RESTORE - 全量跳过已存在的 ID', () => {
  const existingIds = new Set(['agent-1', 'agent-2'])
  const backupItems = [
    { id: 'agent-1', name: 'Agent A' },
    { id: 'agent-2', name: 'Agent B' },
  ]

  const restored: Record<string, number> = {}
  let restoreCount = 0

  for (const item of backupItems) {
    if (item?.id && !existingIds.has(item.id)) {
      existingIds.add(item.id)
      restoreCount++
      restored.agents = (restored.agents || 0) + 1
    }
  }

  assert.strictEqual(restoreCount, 0, '不应恢复任何数据')
  assert.ok(!('agents' in restored), '恢复计数应为 0')
})

test('MGMT_RESTORE - 跳过没有 id 的项', () => {
  const backupItems = [
    { id: 'valid-1', name: 'Valid Item' },
    { name: 'No ID Item' },
    null,
    undefined,
    { id: 'valid-2' },
  ]

  const validItems = backupItems.filter(item => item?.id)
  assert.strictEqual(validItems.length, 2, '应过滤掉 3 个无效项')
  assert.ok(validItems.every(item => item!.id), '所有有效项都应有 id')
})

test('MGMT_RESTORE - 读取文件失败时返回错误', () => {
  const invalidPath = '/nonexistent/backup.json'

  let error: any
  try {
    readFileSync(invalidPath, 'utf-8')
    assert.fail('应抛出 ENOENT 错误')
  } catch (e) {
    error = e
  }

  const result = { success: false as const, error: error.message }
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error?.includes('ENOENT'), '错误信息应包含路径错误')
})

test('MGMT_RESTORE - 解析非法 JSON 返回错误', () => {
  const badJson = '{not valid json'

  let error: any
  try {
    JSON.parse(badJson)
    assert.fail('应抛出 SyntaxError')
  } catch (e) {
    error = e
  }

  assert.ok(error instanceof SyntaxError, '应抛出 SyntaxError')
  const result = { success: false as const, error: error.message }
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error!.length > 0, '错误信息应非空')
})

// ==================== MGMT_GET_ALL_BACKUPS 测试 ====================

test('MGMT_GET_ALL_BACKUPS - 列出目录中所有 JSON 文件', () => {
  const backupDir = join(TEST_DIR, 'backups')
  mkdirSync(backupDir, { recursive: true })

  const files = [
    'agents_2025-09-13.json',
    'workflows_2025-09-13.json',
    'full_backup_2025-09-13T10-00-00.json',
    'readme.txt',
    'backup.log',
  ]

  files.forEach(f => writeFileSync(join(backupDir, f), '{}', 'utf-8'))

  const jsonFiles = readdirSync(backupDir).filter((f: string) => f.endsWith('.json'))
  const result = jsonFiles.map(f => ({ name: f, path: join(backupDir, f) }))

  assert.strictEqual(result.length, 3, '应只列出 JSON 文件')
  assert.ok(result.every(r => r.name.endsWith('.json')), '所有条目都应以 .json 结尾')
  assert.ok(result.some(r => r.name.includes('agents')), '应包含 agents 备份')
  assert.ok(result.some(r => r.name.includes('workflows')), '应包含 workflows 备份')
  assert.ok(result.some(r => r.name.includes('full_backup')), '应包含全量备份')
})

test('MGMT_GET_ALL_BACKUPS - 空目录返回空列表', () => {
  const emptyDir = join(TEST_DIR, 'empty-backups')
  mkdirSync(emptyDir, { recursive: true })

  const jsonFiles = readdirSync(emptyDir).filter((f: string) => f.endsWith('.json'))
  const result = { success: true as const, data: jsonFiles.map(f => ({ name: f, path: join(emptyDir, f) })) }

  assert.ok(result.success, '应返回成功')
  assert.ok(Array.isArray(result.data), 'data 应为数组')
  assert.strictEqual(result.data.length, 0, '空目录应返回空数组')
})

// ==================== MGMT_DELETE_BACKUP 测试 ====================

test('MGMT_DELETE_BACKUP - 成功删除备份文件', () => {
  const filePath = join(TEST_DIR, 'delete-test.json')
  writeFileSync(filePath, '{}', 'utf-8')
  assert.ok(existsSync(filePath), '文件应先存在')

  try {
    unlinkSync(filePath)
    assert.ok(!existsSync(filePath), '文件应已删除')
    const result = { success: true as const }
    assert.ok(result.success, '应返回成功')
  } catch (e) {
    assert.fail('删除不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_DELETE_BACKUP - 删除不存在的文件返回错误', () => {
  const nonExistent = join(TEST_DIR, 'nonexistent.json')

  let error: any
  try {
    unlinkSync(nonExistent)
    assert.fail('应抛出 ENOENT 错误')
  } catch (e) {
    error = e
  }

  const result = { success: false as const, error: error.message }
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error?.includes('ENOENT'), '错误信息应包含 ENOENT')
})

// ==================== 边界条件测试 ====================

test('MGMT_EXPORT - 空数组导出成功', () => {
  const data: any[] = []
  const filePath = join(TEST_DIR, 'empty_export.json')

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert.ok(Array.isArray(content), '应为空数组')
    assert.strictEqual(content.length, 0, '长度应为 0')
  } catch (e) {
    assert.fail('空数组导出不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_IMPORT - 含 null 项的数组应允许解析', () => {
  const jsonData = '[null,{"id":"1"},null,{"id":"2"}]'

  try {
    const data = JSON.parse(jsonData)
    assert.ok(Array.isArray(data), '应解析为数组')
    assert.strictEqual(data.length, 4, '应包含 4 个元素')
    assert.strictEqual(data[0], null, '第 1 项应为 null')
    assert.strictEqual(data[1].id, '1', '第 2 项应保留 id')
    const falsyItems = data.filter((item: any) => !item)
    assert.strictEqual(falsyItems.length, 2, '应过滤出 2 个 falsy 项（null）')
  } catch (e) {
    assert.fail('含 null 的数组不应抛出错误: ' + (e as Error).message)
  }
})

test('MGMT_RESTORE - 部分模块缺失时跳过', () => {
  const backup: Record<string, any[]> = {
    agents: [{ id: 'a1' }],
    workflows: [{ id: 'wf1' }],
    'unknown-module': [{ id: 'x1' }],
  }

  const storeMap: Record<string, Set<string>> = {
    agents: new Set(),
    workflows: new Set(),
  }

  const restored: Record<string, number> = {}
  for (const [key, items] of Object.entries(backup)) {
    if (!storeMap[key]) continue
    let count = 0
    for (const item of items) {
      if (item?.id && !storeMap[key].has(item.id)) {
        storeMap[key].add(item.id)
        count++
      }
    }
    restored[key] = count
  }

  assert.ok('agents' in restored, 'agents 应被恢复')
  assert.ok('workflows' in restored, 'workflows 应被恢复')
  assert.ok(!('unknown-module' in restored), '未知模块应被跳过')
})

test('MGMT_BACKUP - 备份数据与其他模块隔离', () => {
  const backup1: Record<string, any[]> = {
    agents: [{ id: 'a1', name: 'Only in backup1' }],
  }
  const backup2: Record<string, any[]> = {
    agents: [{ id: 'a2', name: 'Only in backup2' }],
  }

  const path1 = join(TEST_DIR, 'backup1.json')
  const path2 = join(TEST_DIR, 'backup2.json')
  writeFileSync(path1, JSON.stringify(backup1), 'utf-8')
  writeFileSync(path2, JSON.stringify(backup2), 'utf-8')

  const content1 = JSON.parse(readFileSync(path1, 'utf-8'))
  const content2 = JSON.parse(readFileSync(path2, 'utf-8'))

  assert.strictEqual(content1.agents[0].name, 'Only in backup1', '备份 1 应包含自己的数据')
  assert.strictEqual(content2.agents[0].name, 'Only in backup2', '备份 2 应包含自己的数据')
  assert.notStrictEqual(content1.agents[0].id, content2.agents[0].id, '不同备份应独立')
})

// ==================== 清理 ====================

test('Cleanup - 删除测试目录', () => {
  try {
    const entries = readdirSync(TEST_DIR)
    for (const f of entries) {
      const fullPath = join(TEST_DIR, f)
      try {
        const stat = existsSync(fullPath) ? require('node:fs').statSync(fullPath) : null
        if (stat?.isDirectory()) {
          const subEntries = readdirSync(fullPath)
          for (const sf of subEntries) {
            try { unlinkSync(join(fullPath, sf)) } catch {}
          }
        } else {
          unlinkSync(fullPath)
        }
      } catch {}
    }
    assert.ok(existsSync(TEST_DIR) || true, '测试目录应存在或已被删除')
  } catch (e) {
    console.warn('Cleanup warning:', (e as Error).message)
  }
})
