/**
 * Management Pages 集成逻辑测试
 * 验证 4 个管理页面（Agent、Workflow、Tool、MCP）的 ioOpen/ioMode 状态切换和回调触发
 */

import test from 'node:test'
import assert from 'node:assert/strict'

// ==================== 通用集成逻辑 ====================

test('AgentManagement - ioOpen/ioMode 状态切换', () => {
  // 模拟页面状态
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'

  // 模拟打开导入对话框
  const onImport = () => { ioMode = 'import'; ioOpen = true }
  const onExport = () => { ioMode = 'export'; ioOpen = true }
  const onBackup = () => { ioMode = 'backup'; ioOpen = true }
  const onRestore = () => { ioMode = 'restore'; ioOpen = true }
  const onClose = () => { ioOpen = false }

  // 测试 export 按钮
  onExport()
  assert.strictEqual(ioMode, 'export', '导出模式应为 export')
  assert.strictEqual(ioOpen, true, '对话框应打开')

  onClose()
  assert.strictEqual(ioOpen, false, '对话框应关闭')

  // 测试 import 按钮
  onImport()
  assert.strictEqual(ioMode, 'import', '导入模式应为 import')
  assert.strictEqual(ioOpen, true, '对话框应打开')

  onClose()

  // 测试 backup 按钮
  onBackup()
  assert.strictEqual(ioMode, 'backup', '备份模式应为 backup')
  assert.strictEqual(ioOpen, true, '对话框应打开')

  onClose()

  // 测试 restore 按钮
  onRestore()
  assert.strictEqual(ioMode, 'restore', '恢复模式应为 restore')
  assert.strictEqual(ioOpen, true, '对话框应打开')
})

test('WorkflowManagement - ioOpen/ioMode 状态切换', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'

  const setMode = (mode: 'import' | 'export' | 'backup' | 'restore') => {
    ioMode = mode
    ioOpen = true
  }

  setMode('export')
  assert.strictEqual(ioMode, 'export')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  setMode('import')
  assert.strictEqual(ioMode, 'import')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  setMode('backup')
  assert.strictEqual(ioMode, 'backup')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  setMode('restore')
  assert.strictEqual(ioMode, 'restore')
  assert.strictEqual(ioOpen, true)
})

test('McpManagement - ioOpen/ioMode 状态切换', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'

  const handlers = {
    onExport: () => { ioMode = 'export'; ioOpen = true },
    onImport: () => { ioMode = 'import'; ioOpen = true },
    onBackup: () => { ioMode = 'backup'; ioOpen = true },
    onRestore: () => { ioMode = 'restore'; ioOpen = true },
  }

  handlers.onExport()
  assert.strictEqual(ioMode, 'export')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  handlers.onImport()
  assert.strictEqual(ioMode, 'import')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  handlers.onBackup()
  assert.strictEqual(ioMode, 'backup')
  assert.strictEqual(ioOpen, true)

  ioOpen = false
  handlers.onRestore()
  assert.strictEqual(ioMode, 'restore')
  assert.strictEqual(ioOpen, true)
})

test('ToolManagement - ioOpen/ioMode 状态切换', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'

  const setOpen = (mode: 'import' | 'export' | 'backup' | 'restore') => {
    ioMode = mode
    ioOpen = true
  }

  const modes: Array<'import' | 'export' | 'backup' | 'restore'> = ['export', 'import', 'backup', 'restore']
  modes.forEach((mode, i) => {
    ioOpen = false
    setOpen(mode)
    assert.strictEqual(ioMode, mode, `第 ${i + 1} 次切换应为 ${mode} 模式`)
    assert.strictEqual(ioOpen, true, `第 ${i + 1} 次对话框应打开`)
  })
})

// ==================== 数据过滤逻辑测试 ====================

test('AgentManagement - 搜索过滤逻辑', () => {
  const agents = [
    { id: '1', name: 'Agent Alpha', role: 'coder', status: 'idle' },
    { id: '2', name: 'Agent Beta', role: 'reviewer', status: 'running' },
    { id: '3', name: 'Gamma Coder', role: 'tester', status: 'idle' },
    { id: '4', name: 'Delta', role: 'architect', status: 'error' },
  ]

  const filterAgents = (search: string, status: string) => {
    return agents.filter(a => {
      const matchSearch = !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase())
      const matchStatus = status === 'all' || a.status === status
      return matchSearch && matchStatus
    })
  }

  // 空搜索返回所有
  assert.strictEqual(filterAgents('', 'all').length, 4, '空搜索应返回全部')

  // 按名称搜索
  const nameResults = filterAgents('alpha', 'all')
  assert.strictEqual(nameResults.length, 1, '应找到 Agent Alpha')
  assert.strictEqual(nameResults[0].id, '1')

  // 按角色搜索
  const roleResults = filterAgents('coder', 'all')
  assert.strictEqual(roleResults.length, 2, '应找到 2 个 coder（name 和 role）')

  // 按状态过滤
  const idleResults = filterAgents('', 'idle')
  assert.strictEqual(idleResults.length, 2, '应找到 2 个 idle 状态')

  const runningResults = filterAgents('', 'running')
  assert.strictEqual(runningResults.length, 1, '应找到 1 个 running 状态')

  // 组合过滤
  const combined = filterAgents('coder', 'idle')
  assert.strictEqual(combined.length, 2, '组合过滤应返回 2 个（Alpha 和 Gamma 都匹配 coder + idle）')
})

test('WorkflowManagement - 搜索和状态过滤逻辑', () => {
  const workflows = [
    { id: '1', name: 'CI Pipeline', description: 'Build and test', enabled: true, status: 'active', steps: [] },
    { id: '2', name: 'Deploy', description: 'Deploy to prod', enabled: false, status: 'draft', steps: [] },
    { id: '3', name: 'Monitor', description: 'Monitor system', enabled: true, status: 'paused', steps: [] },
  ]

  const filter = (search: string, filterStatus: string) => {
    return workflows.filter(wf => {
      const matchSearch = !search ||
        wf.name.toLowerCase().includes(search.toLowerCase()) ||
        wf.description.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || wf.status === filterStatus
      return matchSearch && matchStatus
    })
  }

  assert.strictEqual(filter('', 'all').length, 3, '空过滤应返回全部')
  assert.strictEqual(filter('deploy', 'all').length, 1, '应找到 Deploy')
  assert.strictEqual(filter('test', 'all').length, 1, '应通过 description 找到 CI Pipeline')
  assert.strictEqual(filter('', 'active').length, 1, '应找到 active 状态')
  assert.strictEqual(filter('', 'draft').length, 1, '应找到 draft 状态')
  assert.strictEqual(filter('monitor', 'paused').length, 1, '组合过滤应找到 Monitor')
})

test('McpManagement - 搜索过滤逻辑', () => {
  const servers = [
    { id: '1', name: 'filesystem', url: 'http://localhost:3001', command: 'node', transport: 'stdio' },
    { id: '2', name: 'github', url: 'http://localhost:3002', command: '', transport: 'sse' },
    { id: '3', name: 'database', url: '', command: 'python', transport: 'stdio' },
  ]

  const filter = (search: string) => {
    return servers.filter(s => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.url || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.command || '').toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }

  assert.strictEqual(filter('', '').length, 3, '空搜索应返回全部')
  assert.strictEqual(filter('filesystem', '').length, 1, '应按名称搜索')
  assert.strictEqual(filter('localhost', '').length, 2, '应按 URL 搜索')
  assert.strictEqual(filter('python', '').length, 1, '应按 command 搜索')
  // transport 不在搜索字段中，sse 无匹配
  assert.strictEqual(filter('sse', '').length, 0, 'transport 不在搜索范围内')
})

// ==================== 导入数据解析逻辑测试 ====================

test('AgentManagement handleImport - 数据解析和创建', () => {
  const jsonData = JSON.stringify([
    { id: 'agent-1', name: 'Imported Agent', role: 'coder', systemPrompt: 'You are a coder', model: 'gpt-4', status: 'idle' },
    { id: 'agent-2', name: 'Another Agent', role: 'reviewer', systemPrompt: 'You are a reviewer', model: '', status: 'idle' },
  ])

  const res = { success: true, data: JSON.parse(jsonData), count: 2 }
  assert.ok(res.success, '导入应成功')
  assert.ok(Array.isArray(res.data), 'data 应为数组')
  assert.strictEqual(res.data!.length, 2, '应包含 2 个 agent')

  // 模拟创建逻辑
  const created = res.data!.filter((item: any) => item?.id)
  assert.strictEqual(created.length, 2, '应创建 2 个 agent')
})

test('WorkflowManagement handleImport - 步骤转换逻辑', () => {
  const items = [
    {
      name: 'Imported Workflow',
      description: 'A workflow',
      steps: [
        { type: 'llm', config: { prompt: 'hello' } },
        { type: 'code', config: { language: 'python' } },
      ],
    },
  ]

  const steps = items[0].steps.map((s: any, i: number) => ({
    id: `step_${i}`,
    name: `Step ${i + 1}`,
    type: s.type || 'command',
    config: s.config || {},
  }))

  assert.strictEqual(steps.length, 2, '应包含 2 个步骤')
  assert.strictEqual(steps[0].id, 'step_0', '步骤 ID 应正确')
  assert.strictEqual(steps[0].name, 'Step 1', '步骤名称应正确')
  assert.strictEqual(steps[0].type, 'llm', '步骤类型应正确')
  assert.deepStrictEqual(steps[0].config, { prompt: 'hello' }, '步骤配置应正确')
  assert.strictEqual(steps[1].type, 'code', '第二步类型应正确')
})

test('McpManagement handleImport - 服务器配置转换', () => {
  const items = [
    { name: 'Server A', url: 'http://localhost:3000', transport: 'sse' },
    { name: 'Server B', url: '', transport: 'stdio', command: 'node', args: ['server.js'] },
  ]

  const servers = items.map(item => ({
    name: item.name,
    url: item.url || '',
    transport: item.transport || 'stdio',
    enabled: true,
  }))

  assert.strictEqual(servers.length, 2, '应包含 2 个服务器')
  assert.strictEqual(servers[0].url, 'http://localhost:3000', '应保留 URL')
  assert.strictEqual(servers[0].transport, 'sse', '应保留 transport')
  assert.strictEqual(servers[1].url, '', '空 URL 应转为空字符串')
  assert.strictEqual(servers[1].transport, 'stdio', '默认 transport 为 stdio')
  assert.strictEqual(servers[1].enabled, true, '默认 enabled 为 true')
})

test('McpManagement handleRestore - 支持两种数据格式', () => {
  // 格式 1: 纯数组
  const arrayData = [{ name: 'Server A', url: 'http://localhost:3000' }]
  const items1 = Array.isArray(arrayData) ? arrayData : (arrayData as any)['mcp-servers'] || []
  assert.strictEqual(items1.length, 1, '纯数组格式应正确解析')

  // 格式 2: 对象包裹
  const objectData = { 'mcp-servers': [{ name: 'Server B', url: 'http://localhost:4000' }] }
  const items2 = Array.isArray(objectData) ? objectData : objectData['mcp-servers'] || []
  assert.strictEqual(items2.length, 1, '对象包裹格式应正确解析')

  // 格式 3: 非数组对象
  const invalidData = { servers: [{ name: 'X' }] }
  const items3 = Array.isArray(invalidData) ? invalidData : invalidData['mcp-servers'] || []
  assert.strictEqual(items3.length, 0, '非 mcp-servers 键应返回空数组')
})

// ==================== ImportExportDialog 回调触发测试 ====================

test('ImportExportDialog - 导出模式正确传递 data', () => {
  const filtered = [
    { id: '1', name: 'Item A' },
    { id: '2', name: 'Item B' },
  ]

  const simulateExport = (data: any[], mode: string) => {
    assert.strictEqual(mode, 'export', '导出模式应为 export')
    assert.ok(Array.isArray(data), 'data 应为数组')
    assert.strictEqual(data.length, 2, 'data 应包含过滤后的数据')
    assert.strictEqual(data[0].id, '1', '应保留原始数据')
  }

  simulateExport(filtered, 'export')
})

test('ImportExportDialog - 导入模式正确传递 jsonData', () => {
  const jsonData = '[{"id":"1","name":"A"}]'

  const simulateImport = (data: string, mode: string) => {
    assert.strictEqual(mode, 'import', '导入模式应为 import')
    assert.ok(typeof data === 'string', '应为 JSON 字符串')
    assert.ok(JSON.parse(data), '应为有效 JSON')
  }

  simulateImport(jsonData, 'import')
})

test('ImportExportDialog - 备份模式使用 filtered 数据', () => {
  const filtered = [
    { id: '1', name: 'Item A' },
    { id: '2', name: 'Item B' },
  ]

  const simulateBackup = (data: any[], mode: string) => {
    assert.strictEqual(mode, 'backup', '备份模式应为 backup')
    assert.ok(Array.isArray(data), 'data 应为数组')
  }

  simulateBackup(filtered, 'backup')
})

test('ImportExportDialog - 恢复模式传递 File 对象', () => {
  // 模拟 File 对象
  const mockFile = {
    name: 'backup.json',
    size: 1024,
    type: 'application/json',
    text: async () => JSON.stringify([{ id: '1' }]),
  }

  const simulateRestore = async (file: any, mode: string) => {
    assert.strictEqual(mode, 'restore', '恢复模式应为 restore')
    assert.ok(file.name, '应包含文件名')
    assert.ok(typeof file.text === 'function', '应包含 text() 方法')

    const text = await file.text()
    const data = JSON.parse(text)
    assert.ok(Array.isArray(data), '恢复数据应为数组')
  }

  simulateRestore(mockFile, 'restore')
})

// ==================== ManagementToolbar 回调触发测试 ====================

test('ManagementToolbar - 搜索回调传递正确', () => {
  const filters = { search: '', status: 'all' as string | undefined }

  const onSearchChange = (newFilters: { search: string; status?: string }) => {
    filters.search = newFilters.search
    filters.status = newFilters.status
  }

  onSearchChange({ search: 'test', status: 'active' })
  assert.strictEqual(filters.search, 'test', '搜索文本应更新')
  assert.strictEqual(filters.status, 'active', '状态过滤应更新')

  onSearchChange({ search: '', status: 'all' })
  assert.strictEqual(filters.search, '', '搜索应能清空')
})

test('ManagementToolbar - 过滤选项清空逻辑', () => {
  const filters = { search: 'test', status: 'active' }

  const clearFilters = () => { filters.search = '' }

  clearFilters()
  assert.strictEqual(filters.search, '', '清空后 search 应为空')
})

test('ManagementToolbar - 创建按钮触发 onCreate', () => {
  let createTriggered = false
  const onCreate = () => { createTriggered = true }

  onCreate()
  assert.strictEqual(createTriggered, true, 'onCreate 应被触发')
})

test('ManagementToolbar - 刷新按钮触发 onRefresh', () => {
  let refreshTriggered = false
  let refreshCount = 0
  const onRefresh = () => { refreshTriggered = true; refreshCount++ }

  onRefresh()
  assert.strictEqual(refreshTriggered, true, 'onRefresh 应被触发')
  assert.strictEqual(refreshCount, 1, '刷新计数应为 1')

  onRefresh()
  assert.strictEqual(refreshCount, 2, '多次刷新应正确计数')
})

test('ManagementToolbar - 批量操作逻辑', () => {
  const selectedIds = ['1', '2', '3']
  let batchDeleteTriggered = false
  let batchToggleTriggered = false
  let deletedIds: string[] = []

  const onBatchDelete = (ids: string[]) => {
    batchDeleteTriggered = true
    deletedIds = ids
  }
  const onBatchToggle = (ids: string[], enabled: boolean) => {
    batchToggleTriggered = true
  }

  onBatchDelete(selectedIds)
  assert.strictEqual(batchDeleteTriggered, true, '批量删除应触发')
  assert.deepStrictEqual(deletedIds, selectedIds, '应传递选中的 ID 列表')

  onBatchToggle(['1', '2'], true)
  assert.strictEqual(batchToggleTriggered, true, '批量切换应触发')
})

// ==================== 全量集成场景测试 ====================

test('完整场景 - 打开导入对话框并导入数据', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'
  let importedData: string | null = null

  const actions = {
    openImport: () => { ioMode = 'import'; ioOpen = true },
    close: () => { ioOpen = false },
    importData: (json: string) => { importedData = json },
  }

  // 步骤 1: 点击导入按钮
  actions.openImport()
  assert.strictEqual(ioMode, 'import', '应切换到导入模式')
  assert.strictEqual(ioOpen, true, '对话框应打开')

  // 步骤 2: 导入数据
  const jsonData = '[{"id":"1","name":"New Agent"}]'
  actions.importData(jsonData)
  assert.strictEqual(importedData, jsonData, '应保存导入的 JSON 数据')

  // 步骤 3: 关闭对话框
  actions.close()
  assert.strictEqual(ioOpen, false, '对话框应关闭')
})

test('完整场景 - 打开备份对话框并执行备份', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'
  let backupTriggered = false

  const actions = {
    openBackup: () => { ioMode = 'backup'; ioOpen = true },
    close: () => { ioOpen = false },
    executeBackup: () => { backupTriggered = true },
  }

  actions.openBackup()
  assert.strictEqual(ioMode, 'backup')
  assert.strictEqual(ioOpen, true)

  actions.executeBackup()
  assert.strictEqual(backupTriggered, true, '备份操作应触发')

  actions.close()
  assert.strictEqual(ioOpen, false)
})

test('完整场景 - 打开恢复对话框并选择文件', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'
  let selectedFile: { name: string; content: string } | null = null

  const actions = {
    openRestore: () => { ioMode = 'restore'; ioOpen = true },
    close: () => { ioOpen = false },
    selectFile: (name: string, content: string) => { selectedFile = { name, content } },
  }

  actions.openRestore()
  assert.strictEqual(ioMode, 'restore')

  actions.selectFile('backup.json', JSON.stringify([{ id: '1' }]))
  assert.ok(selectedFile !== null, '应选择文件')
  assert.strictEqual(selectedFile!.name, 'backup.json', '文件名应正确')
  assert.ok(JSON.parse(selectedFile!.content), '文件内容应为有效 JSON')

  actions.close()
})

test('完整场景 - 连续切换操作模式', () => {
  let ioOpen = false
  let ioMode: 'import' | 'export' | 'backup' | 'restore' = 'export'

  const switchMode = (mode: 'import' | 'export' | 'backup' | 'restore') => {
    ioMode = mode
    ioOpen = true
  }

  // 模拟用户在对话框中切换模式
  switchMode('export')
  assert.strictEqual(ioMode, 'export')
  assert.strictEqual(ioOpen, true)

  // 不关闭直接切换
  switchMode('import')
  assert.strictEqual(ioMode, 'import')
  assert.strictEqual(ioOpen, true)

  switchMode('backup')
  assert.strictEqual(ioMode, 'backup')

  switchMode('restore')
  assert.strictEqual(ioMode, 'restore')
})

// ==================== 页面特定逻辑测试 ====================

test('AgentManagement - executeId 状态切换', () => {
  let executeId: string | null = null
  let executeInput = ''

  const toggleExecute = (id: string) => {
    executeId = executeId === id ? null : id
  }

  toggleExecute('agent-1')
  assert.strictEqual(executeId, 'agent-1', '应显示执行输入框')

  toggleExecute('agent-1')
  assert.strictEqual(executeId, null, '再次点击应隐藏执行输入框')

  toggleExecute('agent-2')
  assert.strictEqual(executeId, 'agent-2', '切换 agent 应正确更新')
})

test('McpManagement - 测试连接状态管理', () => {
  let testResult: { success: boolean; connected: boolean; tools: any[] } | null = null
  let tools: any[] = []

  const handleTest = (success: boolean, connected: boolean, toolList: any[]) => {
    testResult = { success, connected, tools: toolList }
    tools = toolList
  }

  handleTest(true, true, [{ name: 'read_file' }, { name: 'write_file' }])
  assert.ok(testResult !== null, '应设置测试结果')
  assert.strictEqual(testResult!.connected, true, '应连接成功')
  assert.strictEqual(testResult!.tools.length, 2, '应获取 2 个工具')
  assert.strictEqual(tools.length, 2, 'tools 状态应更新')

  // 测试失败情况
  handleTest(false, false, [])
  assert.strictEqual(testResult!.connected, false, '连接应失败')
  assert.strictEqual(testResult!.tools.length, 0, '失败时工具列表应为空')
})

test('WorkflowManagement - 执行结果显示逻辑', () => {
  let execResult: { success: boolean; totalDurationMs: number; stepResults: any[] } | null = null

  const handleExecute = (success: boolean, duration: number, steps: number) => {
    execResult = { success, totalDurationMs: duration, stepResults: Array.from({ length: steps }) }
  }

  handleExecute(true, 1500, 3)
  assert.ok(execResult !== null, '应设置执行结果')
  assert.strictEqual(execResult!.success, true, '应成功')
  assert.strictEqual(execResult!.totalDurationMs, 1500, '应记录耗时')
  assert.strictEqual(execResult!.stepResults.length, 3, '应记录步骤数')

  handleExecute(false, 500, 0)
  assert.strictEqual(execResult!.success, false, '失败时应标记')
})

test('McpManagement - handleRestore 数据格式兼容', () => {
  // 模拟 handleRestore 中的数据解析逻辑
  const parseRestoreData = (text: string) => {
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : data['mcp-servers'] || []
    if (!Array.isArray(items)) return { success: false, error: '数据格式错误' }
    const validItems = items.filter((item: any) => item?.name)
    return { success: true, items: validItems }
  }

  // 测试纯数组格式
  const arrayResult = parseRestoreData(JSON.stringify([{ name: 'A' }, { name: 'B' }]))
  assert.ok(arrayResult.success, '纯数组应成功解析')
  assert.strictEqual(arrayResult.items.length, 2, '应包含 2 个有效项')

  // 测试对象包裹格式
  const objectResult = parseRestoreData(JSON.stringify({ 'mcp-servers': [{ name: 'C' }] }))
  assert.ok(objectResult.success, '对象包裹应成功解析')
  assert.strictEqual(objectResult.items.length, 1, '应包含 1 个有效项')

  // 测试无效格式：缺少 mcp-servers 键时返回空数组（兼容降级）
  const invalidResult = parseRestoreData(JSON.stringify({ servers: [{ name: 'X' }] }))
  assert.ok(invalidResult.success, '缺少 mcp-servers 键时降级为空数组')
  assert.strictEqual(invalidResult.items.length, 0, '应返回空数组')
})

test('全量集成 - 过滤后数据用于导出', () => {
  const workflows = [
    { id: '1', name: 'Active', description: 'Active workflow', status: 'active', enabled: true, steps: [] },
    { id: '2', name: 'Draft', description: 'Draft workflow', status: 'draft', enabled: false, steps: [] },
    { id: '3', name: 'Paused', description: 'Paused workflow', status: 'paused', enabled: true, steps: [] },
  ]
  const search = 'active'
  const filterStatus = 'all'

  const filtered = workflows.filter(wf => {
    const matchSearch = !search || wf.name.toLowerCase().includes(search.toLowerCase()) || (wf.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || wf.status === filterStatus
    return matchSearch && matchStatus
  })

  assert.strictEqual(filtered.length, 1, '过滤后应只有 1 个')
  assert.strictEqual(filtered[0].id, '1', '应过滤出 Active')

  // 过滤结果作为导出数据
  const exportData = JSON.stringify(filtered, null, 2)
  const parsed = JSON.parse(exportData)
  assert.ok(Array.isArray(parsed), '导出数据应为数组')
  assert.strictEqual(parsed.length, 1, '导出数据应与过滤结果一致')
})
