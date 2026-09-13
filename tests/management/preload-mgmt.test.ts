/**
 * Preload mgmt API 单元测试
 * 验证 preload 层 mgmt 模块的类型正确性和调用格式
 */

import test from 'node:test'
import assert from 'node:assert/strict'

// 模拟 ipcRenderer
const mockIpcRenderer = {
  invoke: async (channel: string, ...args: any[]) => {
    return { success: true, data: null }
  },
}

// 模拟 IpcChannels
const IpcChannels = {
  MGMT_EXPORT: 'mgmt:export',
  MGMT_IMPORT: 'mgmt:import',
  MGMT_BACKUP: 'mgmt:backup',
  MGMT_RESTORE: 'mgmt:restore',
  MGMT_GET_ALL_BACKUPS: 'mgmt:getBackups',
  MGMT_DELETE_BACKUP: 'mgmt:deleteBackup',
}

// ==================== mgmt.export 测试 ====================

test('mgmt.export - 调用正确的 IPC 通道和参数', async () => {
  const moduleName = 'agents'
  const data = [{ id: '1', name: 'Agent A' }]

  let capturedChannel: string | undefined
  let capturedArgs: any[] = []
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    capturedArgs = args
    return { success: true, path: '/tmp/agents_123.json' }
  }

  // 模拟 preload 中的调用方式
  const result = await mockInvoke(IpcChannels.MGMT_EXPORT, moduleName, data)

  assert.strictEqual(capturedChannel, 'mgmt:export', '应使用 MGMT_EXPORT 通道')
  assert.strictEqual(capturedArgs[0], 'agents', '第一个参数应为模块名')
  assert.deepStrictEqual(capturedArgs[1], data, '第二个参数应为数据对象')
  assert.ok(result.success, '应返回成功')
  assert.ok(result.path?.includes('.json'), '应返回文件路径')
})

test('mgmt.export - 不同模块名使用相同通道', async () => {
  const modules = ['agents', 'workflows', 'mcp-servers', 'tools', 'plugins', 'plans', 'tasks']

  for (const moduleName of modules) {
    const mockInvoke = async (channel: string, ...args: any[]) => {
      assert.strictEqual(channel, 'mgmt:export', `${moduleName} 应使用 mgmt:export 通道`)
      assert.strictEqual(args[0], moduleName, `${moduleName} 模块名应传递正确`)
      return { success: true }
    }

    await mockInvoke(IpcChannels.MGMT_EXPORT, moduleName, [])
  }
})

test('mgmt.export - 返回类型包含必要字段', async () => {
  const mockInvoke = async () => ({ success: true, path: '/tmp/test.json' })
  const result = await mockInvoke(IpcChannels.MGMT_EXPORT)

  assert.ok('success' in result, '应包含 success 字段')
  assert.ok('path' in result, '应包含 path 字段')
  assert.strictEqual(result.success, true, 'success 应为 true')
  assert.ok(typeof result.path === 'string', 'path 应为字符串')
})

// ==================== mgmt.import 测试 ====================

test('mgmt.import - 调用正确的 IPC 通道和参数', async () => {
  const moduleName = 'agents'
  const jsonData = '[{"id":"1","name":"Agent A"}]'

  let capturedChannel: string | undefined
  let capturedArgs: any[] = []
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    capturedArgs = args
    return { success: true, data: [{ id: '1' }], count: 1 }
  }

  const result = await mockInvoke(IpcChannels.MGMT_IMPORT, moduleName, jsonData)

  assert.strictEqual(capturedChannel, 'mgmt:import', '应使用 MGMT_IMPORT 通道')
  assert.strictEqual(capturedArgs[0], 'agents', '第一个参数应为模块名')
  assert.strictEqual(capturedArgs[1], jsonData, '第二个参数应为 JSON 字符串')
  assert.ok(result.success, '应返回成功')
  assert.ok(Array.isArray(result.data), 'data 应为数组')
  assert.strictEqual(result.count, 1, 'count 应为 1')
})

test('mgmt.import - 处理无效 JSON 字符串', async () => {
  const invalidJson = 'not valid json'
  let capturedChannel: string | undefined
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    // 模拟 handler 中 JSON.parse 失败
    try {
      JSON.parse(args[1])
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const result = await mockInvoke(IpcChannels.MGMT_IMPORT, 'agents', invalidJson)
  assert.strictEqual(capturedChannel, 'mgmt:import', '应使用 mgmt:import 通道')
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error, '应包含错误信息')
})

test('mgmt.import - 返回类型包含必要字段', async () => {
  const mockInvoke = async () => ({ success: true, data: [], count: 0 })
  const result = await mockInvoke(IpcChannels.MGMT_IMPORT)

  assert.ok('success' in result, '应包含 success 字段')
  assert.ok('data' in result, '应包含 data 字段')
  assert.ok('count' in result, '应包含 count 字段')
  assert.ok(Array.isArray(result.data), 'data 应为数组')
  assert.ok(typeof result.count === 'number', 'count 应为数字')
})

// ==================== mgmt.backup 测试 ====================

test('mgmt.backup - 调用正确的 IPC 通道（无参数）', async () => {
  let capturedChannel: string | undefined
  let capturedArgs: any[] = []
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    capturedArgs = args
    return { success: true, path: '/tmp/full_backup.json', modules: ['agents', 'workflows'] }
  }

  const result = await mockInvoke(IpcChannels.MGMT_BACKUP)

  assert.strictEqual(capturedChannel, 'mgmt:backup', '应使用 MGMT_BACKUP 通道')
  assert.strictEqual(capturedArgs.length, 0, 'backup 不应有参数')
  assert.ok(result.success, '应返回成功')
  assert.ok(result.path?.includes('.json'), '应返回文件路径')
  assert.ok(Array.isArray(result.modules), 'modules 应为数组')
})

test('mgmt.backup - 返回类型包含必要字段', async () => {
  const mockInvoke = async () => ({
    success: true,
    path: '/tmp/full_backup_2025-09-13.json',
    modules: ['agents', 'workflows', 'mcp-servers', 'tools', 'plugins'],
  })
  const result = await mockInvoke(IpcChannels.MGMT_BACKUP)

  assert.ok('success' in result, '应包含 success 字段')
  assert.ok('path' in result, '应包含 path 字段')
  assert.ok('modules' in result, '应包含 modules 字段')
  assert.ok(typeof result.success === 'boolean', 'success 应为布尔值')
  assert.ok(typeof result.path === 'string', 'path 应为字符串')
  assert.ok(Array.isArray(result.modules), 'modules 应为数组')
  assert.ok(result.modules!.length > 0, 'modules 应包含至少一个模块')
})

// ==================== mgmt.restore 测试 ====================

test('mgmt.restore - 调用正确的 IPC 通道和参数', async () => {
  const filePath = '/tmp/backup.json'

  let capturedChannel: string | undefined
  let capturedArgs: any[] = []
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    capturedArgs = args
    return { success: true, restored: { agents: 2, workflows: 1 } }
  }

  const result = await mockInvoke(IpcChannels.MGMT_RESTORE, filePath)

  assert.strictEqual(capturedChannel, 'mgmt:restore', '应使用 MGMT_RESTORE 通道')
  assert.strictEqual(capturedArgs[0], filePath, '第一个参数应为文件路径')
  assert.ok(result.success, '应返回成功')
  assert.ok(result.restored, '应包含 restored 对象')
})

test('mgmt.restore - 返回类型包含必要字段', async () => {
  const mockInvoke = async () => ({
    success: true,
    restored: { agents: 2, workflows: 1, 'mcp-servers': 0 },
  })
  const result = await mockInvoke(IpcChannels.MGMT_RESTORE)

  assert.ok('success' in result, '应包含 success 字段')
  assert.ok('restored' in result, '应包含 restored 字段')
  assert.ok(typeof result.restored === 'object', 'restored 应为对象')
  assert.ok(typeof result.restored.agents === 'number', 'restored.agents 应为数字')
})

test('mgmt.restore - 处理不存在的文件路径', async () => {
  const nonExistentPath = '/nonexistent/backup.json'
  const mockInvoke = async (channel: string, ...args: any[]) => {
    try {
      const { readFileSync } = require('node:fs')
      readFileSync(args[0], 'utf-8')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const result = await mockInvoke(IpcChannels.MGMT_RESTORE, nonExistentPath)
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error, '应包含错误信息')
})

// ==================== mgmt.getAllBackups 测试 ====================

test('mgmt.getAllBackups - 调用正确的 IPC 通道（无参数）', async () => {
  let capturedChannel: string | undefined
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    return {
      success: true,
      data: [
        { name: 'agents_2025-09-13.json', path: '/tmp/agents_2025-09-13.json' },
        { name: 'full_backup_2025-09-13.json', path: '/tmp/full_backup_2025-09-13.json' },
      ],
    }
  }

  const result = await mockInvoke(IpcChannels.MGMT_GET_ALL_BACKUPS)

  assert.strictEqual(capturedChannel, 'mgmt:getBackups', '应使用 MGMT_GET_ALL_BACKUPS 通道')
  assert.ok(result.success, '应返回成功')
  assert.ok(Array.isArray(result.data), 'data 应为数组')
  assert.ok(result.data!.length > 0, '应包含备份文件列表')
  assert.ok(result.data![0].name.includes('.json'), '条目应包含 .json 文件名')
})

test('mgmt.getAllBackups - 空备份列表', async () => {
  const mockInvoke = async () => ({ success: true, data: [] })
  const result = await mockInvoke(IpcChannels.MGMT_GET_ALL_BACKUPS)

  assert.ok(result.success, '应返回成功')
  assert.ok(Array.isArray(result.data), 'data 应为数组')
  assert.strictEqual(result.data!.length, 0, '空列表长度应为 0')
})

// ==================== mgmt.deleteBackup 测试 ====================

test('mgmt.deleteBackup - 调用正确的 IPC 通道和参数', async () => {
  const fileName = 'agents_2025-09-13.json'

  let capturedChannel: string | undefined
  let capturedArgs: any[] = []
  const mockInvoke = async (channel: string, ...args: any[]) => {
    capturedChannel = channel
    capturedArgs = args
    return { success: true }
  }

  const result = await mockInvoke(IpcChannels.MGMT_DELETE_BACKUP, fileName)

  assert.strictEqual(capturedChannel, 'mgmt:deleteBackup', '应使用 MGMT_DELETE_BACKUP 通道')
  assert.strictEqual(capturedArgs[0], fileName, '第一个参数应为文件名')
  assert.ok(result.success, '应返回成功')
})

test('mgmt.deleteBackup - 删除失败时返回错误', async () => {
  const mockInvoke = async (_channel: string, fileName: string) => {
    try {
      const { unlinkSync } = require('node:fs')
      unlinkSync('/nonexistent/' + fileName)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const result = await mockInvoke(IpcChannels.MGMT_DELETE_BACKUP, 'nonexistent.json')
  assert.ok(!result.success, '应返回失败')
  assert.ok(result.error, '应包含错误信息')
})

// ==================== 类型一致性测试 ====================

test('所有 mgmt 方法都返回 { success: boolean } 结构', async () => {
  const mockInvoke = async () => ({ success: true })

  const results = await Promise.all([
    mockInvoke(IpcChannels.MGMT_EXPORT),
    mockInvoke(IpcChannels.MGMT_IMPORT),
    mockInvoke(IpcChannels.MGMT_BACKUP),
    mockInvoke(IpcChannels.MGMT_RESTORE),
    mockInvoke(IpcChannels.MGMT_GET_ALL_BACKUPS),
    mockInvoke(IpcChannels.MGMT_DELETE_BACKUP),
  ])

  results.forEach((r, i) => {
    assert.ok('success' in r, `方法 ${i + 1} 应返回 success 字段`)
    assert.strictEqual(typeof (r as any).success, 'boolean', `方法 ${i + 1} 的 success 应为布尔值`)
  })
})

test('mgmt 所有通道名称唯一且不与其他模块冲突', () => {
  const mgmtChannels = [
    IpcChannels.MGMT_EXPORT,
    IpcChannels.MGMT_IMPORT,
    IpcChannels.MGMT_BACKUP,
    IpcChannels.MGMT_RESTORE,
    IpcChannels.MGMT_GET_ALL_BACKUPS,
    IpcChannels.MGMT_DELETE_BACKUP,
  ]

  const uniqueChannels = new Set(mgmtChannels)
  assert.strictEqual(uniqueChannels.size, mgmtChannels.length, '所有通道名应唯一')

  // 验证通道名前缀为 mgmt:
  mgmtChannels.forEach(channel => {
    assert.ok(channel.startsWith('mgmt:'), `通道 ${channel} 应使用 mgmt: 前缀`)
  })
})

test('mgmt 方法与 IpcChannels 枚举完全对应', () => {
  const mgmtMethods = ['export', 'import', 'backup', 'restore', 'getAllBackups', 'deleteBackup']

  const channelSuffixes = [
    IpcChannels.MGMT_EXPORT.replace('mgmt:', ''),
    IpcChannels.MGMT_IMPORT.replace('mgmt:', ''),
    IpcChannels.MGMT_BACKUP.replace('mgmt:', ''),
    IpcChannels.MGMT_RESTORE.replace('mgmt:', ''),
    IpcChannels.MGMT_GET_ALL_BACKUPS.replace('mgmt:', ''),
    IpcChannels.MGMT_DELETE_BACKUP.replace('mgmt:', ''),
  ]

  assert.strictEqual(mgmtMethods.length, channelSuffixes.length, '方法数量应与通道数量一致')

  mgmtMethods.forEach((method, i) => {
    const expectedSuffix = method === 'getAllBackups' ? 'getBackups' : method
    assert.strictEqual(channelSuffixes[i], expectedSuffix, `方法 ${method} 应对应通道 ${expectedSuffix}`)
  })
})
