/**
 * main/engine-bridge.ts — 桥接引擎和主进程
 *
 * 职责：
 * - 初始化 KX2Code 完整 QueryEngine
 * - 加载命令注册表
 * - 同步工具到 ToolCollection
 * - 开发模式工具验证
 * - 通过 IPC handlers.ts 暴露功能给渲染层
 */

import { BrowserWindow } from 'electron'
import { QueryEngine, type EngineOptions } from '../engine/index'
import { commandRegistry } from '../engine/commands/registry'
import { importCommands } from '../engine/commands/importer'
import { registerChatHandlers } from './ipc/chat-handlers'
import { ProfileManager } from './profiles/manager'
import { syncProfileApiKey } from './store/apiKeySync'
import { toolCollection } from './proxy/tools/toolCollection'

let engine: QueryEngine | null = null
let engineReady = false
let engineError: string | null = null

export async function initEngineBridge(_mainWindow: BrowserWindow | null): Promise<void> {
  try {
    const pm = new ProfileManager()
    const active = pm.getActive()

    // 从工具定义自动生成技能分类（工具即技能）
    const skillCategories = new Map<string, Array<{ name: string; description: string; category?: string }>>()
    const categorizeTool = (toolName: string): string => {
      const fileTools = ['read_file', 'write_file', 'edit', 'glob', 'grep', 'ls', 'dir', 'find', 'findstr', 'cat']
      const shellTools = ['bash', 'shell', 'command', 'terminal', 'powershell']
      const webTools = ['web_search', 'web_fetch', 'http']
      const gitTools = ['git', 'branch', 'commit', 'diff', 'log']
      const systemTools = ['system', 'process', 'env', 'config']
      const lower = toolName.toLowerCase()
      if (fileTools.some(t => lower.includes(t))) return '文件操作'
      if (shellTools.some(t => lower.includes(t))) return '终端命令'
      if (webTools.some(t => lower.includes(t))) return '网络工具'
      if (gitTools.some(t => lower.includes(t))) return '版本控制'
      if (systemTools.some(t => lower.includes(t))) return '系统管理'
      return '通用工具'
    }
    // 预留：后续可从 profiles 或 .doge 配置中读取用户自定义技能/智能体
    const skills: Array<{ name: string; description: string; category?: string }> = []
    const agents: Array<{ name: string; description: string; model?: string }> = []
    const subagents: Array<{ name: string; description: string }> = []

    if (active) {
      const engineCfg = pm.toEngineConfig(active)
      const opts: EngineOptions = {
        model: engineCfg.model,
        provider: engineCfg.provider,
        maxOutputTokens: engineCfg.maxTokens,
        systemPrompt: '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。',
        skills,
        agents,
        subagents,
      }
      engine = new QueryEngine(opts)
      console.log('[EngineBridge] Active profile:', active.name, 'provider:', engineCfg.provider, 'baseUrl:', engineCfg.baseUrl)

      // 同步 apiKey 到代理认证列表（统一使用 apiKeySync 工具）
      syncProfileApiKey(active)
    } else {
      engine = new QueryEngine({
        model: 'gpt-4o',
        provider: 'openai',
        maxOutputTokens: 4096,
        systemPrompt: '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。',
        skills,
        agents,
        subagents,
      })
      console.log('[EngineBridge] No active profile, using defaults')
    }

    const commandCount = await importCommands()

    // 同步命令到 ToolCollection，确保工具系统与注册表一致
    await toolCollection.syncFromRegistry()
    engineReady = true
    console.log('[EngineBridge] Engine initialized, commands loaded:', commandCount, 'tools synced:', toolCollection.getToolNames().length)

    // 开发模式：启动时自动验证工具调用链路
    if (process.env.NODE_ENV === 'development') {
      console.log('[EngineBridge] Dev mode detected, running tool verification...')
      runDirectToolTests().then((results) => {
        console.log(`[EngineBridge] Tool verification: ${results.passed}/${results.total} passed`)
      }).catch((err) => {
        console.log('[EngineBridge] Tool verification failed:', err)
      })
    }
  } catch (e) {
    engineError = (e as Error).message
    console.log('[EngineBridge] Engine initialization failed:', engineError)
  }
}

/** 获取引擎实例（供 IPC handlers 使用） */
export function getEngineInstance(): QueryEngine | null {
  return engine
}

/** 检查引擎是否就绪 */
export function isEngineReady(): boolean {
  return engineReady && engine !== null
}

/**
 * 直接模拟 tool_call 数据包执行测试
 * 构造 { name, input } 的工具调用格式，直接走 executeLocalTool → 命令注册表 → 本地执行
 * 不经过 LLM API，纯本地解析执行
 */
async function runDirectToolTests(): Promise<{ passed: number; failed: number; total: number }> {
  const { executeLocalTool } = await import('../engine/api/client')

  const tests: Array<{ name: string; args: string[]; desc: string }> = [
    { name: 'pwd',    args: [],                      desc: '当前目录' },
    { name: 'ls',     args: [],                      desc: '列出当前目录' },
    { name: 'dir',    args: [],                      desc: 'Windows 风格目录列表' },
    { name: 'date',   args: [],                      desc: '当前日期时间' },
    { name: 'cat',    args: ['package.json'],        desc: '读取 package.json' },
    { name: 'grep',   args: ['name', 'package.json'],desc: 'grep 搜索' },
    { name: 'find',   args: ['package.json'],        desc: '查找文件' },
    { name: 'findstr',args: ['electron', 'package.json'], desc: 'findstr 搜索' },
    { name: 'where',  args: ['node'],                desc: '查找 node 路径' },
    { name: 'python', args: ['import sys; print(sys.version)'], desc: 'Python 版本' },
  ]

  console.log('[ToolTest] Starting direct tool execution tests, total:', tests.length)
  let passed = 0
  let failed = 0

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i]
    console.log(`\n[ToolTest] ${i + 1}/${tests.length}: /${t.name} — ${t.desc}`)
    console.log(`[ToolTest]   args: [${t.args.map(a => JSON.stringify(a)).join(', ')}]`)
    try {
      const result = await executeLocalTool(t.name, t.args)
      const output = result.output?.trim()
      if (output && !output.includes('错误') && !output.includes('Error')) {
        console.log(`[ToolTest]   PASS: ${output.slice(0, 200)}`)
        passed++
      } else {
        console.log(`[ToolTest]   FAIL: ${output?.slice(0, 200) || '(no output)'}`)
        failed++
      }
    } catch (e) {
      console.error(`[ToolTest]   ERROR:`, (e as Error).message)
      failed++
    }
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n[ToolTest] ===== Results: ${passed} passed, ${failed} failed, total ${tests.length} =====`)
  return { passed, failed, total: tests.length }
}
