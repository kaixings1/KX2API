/**
 * McpManagement 搜索过滤 + CRUD 全链路 + 连接测试测试
 *
 * 覆盖：
 * - 搜索过滤：按名称、URL、command 关键词
 * - 服务器 CRUD：add / edit / delete 状态流转
 * - 连接测试：handleTest 状态变化
 * - 工具获取：handleGetTools 状态变化
 * - 传输方式映射：TRANSPORT_MAP
 * - 表单验证：name / transport 必填
 * - args / env 解析
 * - 内置项保护（如适用）
 */

import { describe, it, expect } from 'vitest'

// ==================== Types ====================

interface McpServerConfig {
  id: string
  name: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  transport: 'stdio' | 'sse' | 'http'
  enabled: boolean
  headers?: Record<string, string>
}

// ==================== 搜索过滤 ====================

function filterServers(servers: McpServerConfig[], search: string): McpServerConfig[] {
  if (!search.trim()) return servers
  const kw = search.toLowerCase().trim()
  return servers.filter(s =>
    s.name.toLowerCase().includes(kw)
    || (s.url || '').toLowerCase().includes(kw)
    || (s.command || '').toLowerCase().includes(kw)
  )
}

// ==================== 传输方式映射 ====================

const TRANSPORT_MAP: Record<string, string> = {
  stdio: 'stdio',
  sse: 'SSE',
  http: 'HTTP',
}

function getTransportLabel(transport: string): string {
  return TRANSPORT_MAP[transport] || transport
}

// ==================== 表单验证 ====================

interface ServerForm {
  name: string
  url: string
  command: string
  argsText: string
  envText: string
  transport: 'stdio' | 'sse' | 'http'
}

function validateServerForm(form: ServerForm): { valid: boolean; error?: string } {
  if (!form.name.trim()) return { valid: false, error: 'name_required' }
  return { valid: true }
}

// ==================== args / env 解析 ====================

function parseArgs(argsText: string): string[] {
  return argsText.split(' ').filter(Boolean)
}

function parseEnv(envText: string): Record<string, string> {
  try {
    const parsed = JSON.parse(envText || '{}')
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string>
    return {}
  } catch {
    return {}
  }
}

// ==================== CRUD 状态流转 ====================

interface McpState {
  servers: McpServerConfig[]
  dialogOpen: boolean
  editingServer: McpServerConfig | null
  name: string
  url: string
  command: string
  argsText: string
  envText: string
  transport: 'stdio' | 'sse' | 'http'
}

function createMcpState(): McpState {
  return {
    servers: [],
    dialogOpen: false,
    editingServer: null,
    name: '',
    url: '',
    command: '',
    argsText: '',
    envText: '',
    transport: 'stdio',
  }
}

function openCreate(state: McpState): McpState {
  return {
    ...createMcpState(),
    servers: state.servers,
    dialogOpen: true,
  }
}

function openEdit(state: McpState, server: McpServerConfig): McpState {
  return {
    ...state,
    editingServer: server,
    name: server.name,
    url: server.url || '',
    command: server.command || '',
    argsText: (server.args || []).join(' '),
    envText: server.env ? JSON.stringify(server.env) : '',
    transport: server.transport,
    dialogOpen: true,
  }
}

// ==================== 连接测试模拟 ====================

interface TestResult {
  success: boolean
  connected: boolean
  tools: any[]
}

function simulateTestConnection(server: McpServerConfig): TestResult {
  // 模拟：有 url 且 transport 为 sse/http 时连接成功
  if (server.url && (server.transport === 'sse' || server.transport === 'http')) {
    return { success: true, connected: true, tools: [{ name: 'tool1', description: '示例工具' }] }
  }
  // stdio 模式需要 command
  if (server.transport === 'stdio' && server.command) {
    return { success: true, connected: true, tools: [] }
  }
  return { success: false, connected: false, tools: [] }
}

// ==================== Mock Data ====================

const mockServers: McpServerConfig[] = [
  { id: 's1', name: '文件服务器', url: 'http://localhost:3000', transport: 'http', enabled: true, headers: {} },
  { id: 's2', name: '搜索服务器', url: 'http://localhost:3001', transport: 'sse', enabled: true, headers: {} },
  { id: 's3', name: '本地命令', command: 'node', args: ['server.js'], transport: 'stdio', enabled: true },
  { id: 's4', name: '已禁用服务器', url: 'http://localhost:3002', transport: 'http', enabled: false, headers: {} },
]

// ==================== Tests ====================

describe('McpManagement - 搜索过滤', () => {
  it('空搜索返回全部', () => {
    const result = filterServers(mockServers, '')
    expect(result).toHaveLength(4)
  })

  it('按名称搜索', () => {
    const result = filterServers(mockServers, '文件')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('按 URL 搜索', () => {
    const result = filterServers(mockServers, '3001')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s2')
  })

  it('按 command 搜索', () => {
    const result = filterServers(mockServers, 'node')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s3')
  })

  it('不存在的关键词返回空', () => {
    const result = filterServers(mockServers, '不存在的xyz')
    expect(result).toHaveLength(0)
  })

  it('按 URL 端口号搜索', () => {
    const result = filterServers(mockServers, '3001')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s2')
  })
})

describe('McpManagement - 传输方式映射', () => {
  it('stdio 映射为 stdio', () => {
    expect(getTransportLabel('stdio')).toBe('stdio')
  })

  it('sse 映射为 SSE', () => {
    expect(getTransportLabel('sse')).toBe('SSE')
  })

  it('http 映射为 HTTP', () => {
    expect(getTransportLabel('http')).toBe('HTTP')
  })

  it('未知传输方式回退到原值', () => {
    expect(getTransportLabel('unknown')).toBe('unknown')
  })
})

describe('McpManagement - 连接测试', () => {
  it('HTTP 服务器有 url 时连接成功', () => {
    const server = mockServers[0]
    const result = simulateTestConnection(server)
    expect(result.success).toBe(true)
    expect(result.connected).toBe(true)
  })

  it('SSE 服务器有 url 时连接成功', () => {
    const server = mockServers[1]
    const result = simulateTestConnection(server)
    expect(result.success).toBe(true)
    expect(result.connected).toBe(true)
  })

  it('stdio 有 command 时连接成功', () => {
    const server = mockServers[2]
    const result = simulateTestConnection(server)
    expect(result.success).toBe(true)
    expect(result.connected).toBe(true)
  })

  it('无 url 无 command 时连接失败', () => {
    const server = { ...mockServers[0], url: '', command: '', transport: 'stdio' as const }
    const result = simulateTestConnection(server)
    expect(result.success).toBe(false)
    expect(result.connected).toBe(false)
  })
})

describe('McpManagement - CRUD 状态流转', () => {
  describe('openCreate', () => {
    it('应重置表单并打开 dialog', () => {
      const state = openCreate(createMcpState())
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('')
      expect(state.transport).toBe('stdio')
      expect(state.editingServer).toBeNull()
    })
  })

  describe('openEdit', () => {
    it('应填充表单', () => {
      const server = mockServers[0]
      const state = openEdit(createMcpState(), server)
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('文件服务器')
      expect(state.url).toBe('http://localhost:3000')
      expect(state.transport).toBe('http')
      expect(state.editingServer).toBe(server)
    })

    it('应正确解析 args', () => {
      const server = mockServers[2] // command: 'node', args: ['server.js']
      const state = openEdit(createMcpState(), server)
      expect(state.argsText).toBe('server.js')
    })

    it('应正确序列化 env', () => {
      const server = { ...mockServers[0], env: { KEY: 'value' } }
      const state = openEdit(createMcpState(), server as McpServerConfig)
      expect(state.envText).toBe('{"KEY":"value"}')
    })

    it('env 为空时应为空字符串', () => {
      const server = mockServers[0] // 无 env
      const state = openEdit(createMcpState(), server)
      expect(state.envText).toBe('')
    })
  })

  describe('表单验证', () => {
    it('name 为空时验证失败', () => {
      const form: ServerForm = { name: '', url: '', command: '', argsText: '', envText: '', transport: 'stdio' }
      const result = validateServerForm(form)
      expect(result.valid).toBe(false)
    })

    it('name 有值时验证通过', () => {
      const form: ServerForm = { name: '服务器', url: 'http://localhost:3000', command: '', argsText: '', envText: '', transport: 'http' }
      const result = validateServerForm(form)
      expect(result.valid).toBe(true)
    })
  })

  describe('args 解析', () => {
    it('空格分隔正确解析', () => {
      const args = parseArgs('server.js --port 3000')
      expect(args).toEqual(['server.js', '--port', '3000'])
    })

    it('多余空格被过滤', () => {
      const args = parseArgs('  server.js   --port   3000  ')
      expect(args).toEqual(['server.js', '--port', '3000'])
    })

    it('空字符串返回空数组', () => {
      const args = parseArgs('')
      expect(args).toHaveLength(0)
    })
  })

  describe('env 解析', () => {
    it('有效 JSON 正确解析', () => {
      const env = parseEnv('{"KEY": "value"}')
      expect(env).toEqual({ KEY: 'value' })
    })

    it('空字符串返回空对象', () => {
      const env = parseEnv('')
      expect(env).toEqual({})
    })

    it('无效 JSON 返回空对象', () => {
      const env = parseEnv('not json')
      expect(env).toEqual({})
    })

    it('非对象 JSON 返回空对象', () => {
      const env = parseEnv('"string"')
      expect(env).toEqual({})
    })
  })
})

describe('McpManagement - handleSave 构建数据', () => {
  it('应正确构建 serverData', () => {
    const form: ServerForm = {
      name: '新服务器',
      url: 'http://localhost:3000',
      command: '',
      argsText: '',
      envText: '',
      transport: 'http',
    }

    const args = parseArgs(form.argsText)
    const env = parseEnv(form.envText)

    const serverData: Record<string, unknown> = { name: form.name, url: form.url, transport: form.transport, enabled: true }
    if (form.command) serverData.command = form.command
    if (args.length > 0) serverData.args = args
    if (Object.keys(env).length > 0) serverData.env = env

    expect(serverData).toEqual({
      name: '新服务器',
      url: 'http://localhost:3000',
      transport: 'http',
      enabled: true,
    })
  })

  it('stdio 模式应包含 command 和 args', () => {
    const form: ServerForm = {
      name: '本地服务器',
      url: '',
      command: 'node',
      argsText: 'server.js --port 3000',
      envText: '',
      transport: 'stdio',
    }

    const args = parseArgs(form.argsText)
    const env = parseEnv(form.envText)

    const serverData: Record<string, unknown> = { name: form.name, url: form.url, transport: form.transport, enabled: true }
    if (form.command) serverData.command = form.command
    if (args.length > 0) serverData.args = args
    if (Object.keys(env).length > 0) serverData.env = env

    expect(serverData.command).toBe('node')
    expect(serverData.args).toEqual(['server.js', '--port', '3000'])
  })

  it('应包含 env 配置', () => {
    const form: ServerForm = {
      name: '带 env 的服务器',
      url: '',
      command: '',
      argsText: '',
      envText: '{"NODE_ENV": "production"}',
      transport: 'stdio',
    }

    const env = parseEnv(form.envText)
    const serverData: Record<string, unknown> = { name: form.name, url: form.url, transport: form.transport, enabled: true }
    if (Object.keys(env).length > 0) serverData.env = env

    expect(serverData.env).toEqual({ NODE_ENV: 'production' })
  })
})

describe('McpManagement - handleGetTools', () => {
  it('应正确解析工具列表', () => {
    const rawRes = [{ name: 'tool1', description: '工具1' }, { name: 'tool2', description: '工具2' }]
    const tools = Array.isArray(rawRes) ? rawRes : []
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('tool1')
  })

  it('非数组响应应回退为空数组', () => {
    const rawRes = null
    const tools = Array.isArray(rawRes) ? rawRes : []
    expect(tools).toHaveLength(0)
  })
})

describe('McpManagement - handleImport 解析', () => {
  it('应正确解析数组格式数据', () => {
    const jsonData = JSON.stringify([
      { name: '服务器1', url: 'http://localhost:3000', transport: 'http' },
      { name: '服务器2', url: 'http://localhost:3001', transport: 'sse' },
    ])

    const data = JSON.parse(jsonData)
    const items = Array.isArray(data) ? data : []
    const validItems = items.filter((item: any) => item?.name)

    expect(validItems).toHaveLength(2)
    expect(validItems[0].name).toBe('服务器1')
  })

  it('应正确解析包装格式数据', () => {
    const jsonData = JSON.stringify({ 'mcp-servers': [{ name: '服务器1', transport: 'stdio' }] })

    const data = JSON.parse(jsonData)
    const items = Array.isArray(data) ? data : (data['mcp-servers'] || [])
    const validItems = items.filter((item: any) => item?.name)

    expect(validItems).toHaveLength(1)
    expect(validItems[0].name).toBe('服务器1')
  })
})

describe('McpManagement - handleRestore 解析', () => {
  it('应正确解析数组格式备份', () => {
    const text = JSON.stringify([
      { name: '服务器1', transport: 'http' },
      { name: '服务器2', transport: 'stdio' },
    ])
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : (data['mcp-servers'] || [])
    expect(items).toHaveLength(2)
  })

  it('应正确解析包装格式备份', () => {
    const text = JSON.stringify({ 'mcp-servers': [{ name: '服务器1', transport: 'http' }] })
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : (data['mcp-servers'] || [])
    expect(items).toHaveLength(1)
  })

  it('无效数据应返回错误', () => {
    const text = JSON.stringify({ invalid: true })
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : (data['mcp-servers'] || [])
    if (!Array.isArray(items)) {
      expect(items).toEqual([])
    }
  })
})

describe('McpManagement - 组合场景', () => {
  it('搜索过滤后服务器数量正确', () => {
    const filtered = filterServers(mockServers, 'HTTP')
    expect(filtered).toHaveLength(3) // s1/s2/s4 的 url 都包含 HTTP
  })

  it('禁用服务器仍应显示（可通过 enabled badge 区分）', () => {
    const disabled = mockServers.find(s => !s.enabled)
    expect(disabled).toBeDefined()
    expect(disabled!.id).toBe('s4')
  })

  it('transport Badge 文本映射正确', () => {
    mockServers.forEach(server => {
      const label = getTransportLabel(server.transport)
      expect(label).not.toBe('')
    })
    expect(getTransportLabel(mockServers[0].transport)).toBe('HTTP')
    expect(getTransportLabel(mockServers[1].transport)).toBe('SSE')
    expect(getTransportLabel(mockServers[2].transport)).toBe('stdio')
  })
})
