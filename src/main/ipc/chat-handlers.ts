/**
 * main/ipc/chat-handlers.ts — Chat IPC handlers + Profiles IPC handlers + .doge config handlers
 *
 * 升级点（吸收 CLI 版 messageLoop 事件驱动架构）：
 * - 使用 QueryEngine.onEvent 接收 AgentEvent 流
 * - 将事件转发为 IPC 消息到渲染层
 * - 支持 Human-in-the-loop 暂停/恢复
 */

import { ipcMain, type WebContents } from 'electron'
import { IpcChannels } from './channels'
import { QueryEngine, type AgentEvent } from '../../engine/index'
import { isEngineReady, getEngineInstance, updateEngineApiClient } from '../engine-bridge'
import { ProfileManager } from '../profiles/manager'
import { logManager } from '../logger/manager'
import { storeManager } from '../store/store'
import { syncProfileApiKey } from '../store/apiKeySync'
import { configGroupManager } from '../store/configGroups'
import { readFileSync, statSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Profile } from '../profiles/manager'
import type { ConfigGroup, ConfigGroupData } from '../store/configGroups'
import { Orchestrator } from '../../engine/agent/coordinator/orchestrator'
import { BUILTIN_ROLES } from '../../engine/agent/coordinator/planner'
import { formatSystemError } from '../../shared/formatError'

/**
 * 回合结束后的后台任务：Stop 钩子 + 自动记忆提取。
 *
 * 这两件事都属「增强项」：失败静默、绝不阻塞、绝不影响已返回给用户的回复。
 * 提取记忆会额外消耗模型额度，因此默认关闭，需用户在设置里显式开启。
 */
async function runPostTurnTasks(
  userText: string,
  messages: ReadonlyArray<{ role?: string; content?: unknown }>,
): Promise<void> {
  // 1) Stop 钩子：让用户脚本在每轮结束时介入
  try {
    const { runStop } = await import('../hooks/index.ts')
    await runStop()
  } catch (e) {
    console.warn('[Chat] Stop hook skipped:', (e as Error).message)
  }

  // 2) 工具活跃集历史重建。
  //
  // 活跃集此前只存在内存与落盘里，二者都可能与「历史事实」不一致：
  // 落盘有 2s 防抖（最后几秒的 tool_load 可能没写）、重启后内存为空。
  // 历史是事实来源 —— 用反扫补齐，避免「模型以为工具可用但调用失败」。
  //
  // 刻意放在回合结束后（历史刚写完），而不是启动时：
  // 启动时历史可能还没加载，此时反扫等于扫了个空数组。
  try {
    const { reconcileFromHistory } = await import('../tools/toolMetaTools.ts')
    const { toolManager } = await import('../tools/toolManager.ts')
    const available = new Set(toolManager.getAllTools().map((t) => t.name))
    reconcileFromHistory('default', messages, available)
  } catch (e) {
    console.warn('[Chat] tool active-set reconcile skipped:', (e as Error).message)
  }

  // 3) 自动记忆：仅在用户开启时才跑
  try {
    const cfg = storeManager.getConfig() as {
      autoMemory?: { enabled?: boolean; maxInputChars?: number }
    }
    if (!cfg?.autoMemory?.enabled) return

    const assistantText = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n')
    const conversation = `用户：${userText}\n\n助手：${assistantText}`

    const { extractMemoryFromTurn } = await import('../../engine/memory/autoMemory.ts')
    const active = new ProfileManager().getActive()
    const result = await extractMemoryFromTurn(conversation, {
      enabled: true,
      maxInputChars: cfg.autoMemory.maxInputChars,
      api: active
        ? {
            provider: active.provider || 'openai',
            apiKey: active.apiKey || '',
            model: active.model || 'gpt-4o',
            baseUrl: active.baseUrl,
          }
        : void 0,
    })
    if (result.written) {
      console.log('[Chat] 自动记忆已写入:', result.file)
    } else if (result.skipped) {
      console.log('[Chat] 自动记忆跳过:', result.skipped)
    }
  } catch (e) {
    console.warn('[Chat] autoMemory skipped:', (e as Error).message)
  }
}

function getLang(): string {
  try {
    const config = storeManager.getConfig()
    return (config as Record<string, string>)?.language || 'en-US'
  } catch {
    return 'en-US'
  }
}

let handlersRegistered = false

export function registerChatHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  // ==================== Chat IPC Handlers ====================

  ipcMain.handle(IpcChannels.CHAT_SEND_MESSAGE, async (event, text: string) => {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const sender = event.sender

    // 检查引擎是否就绪
    if (!isEngineReady()) {
      const initErr = formatSystemError('引擎未初始化', getLang())
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: initErr })
      return { success: false, error: initErr, requestId }
    }

    const eng = getEngineInstance()!

    // 记录聊天流水线日志 — IPC 入口
    let engineConfigSnapshot: Record<string, unknown> = {}
    try {
      engineConfigSnapshot = eng.getConfig()

      // 计算真实上游 URL（基于引擎配置中的 provider + baseUrl）
      const providerId = (engineConfigSnapshot.provider as string) || ''
      const engineModel = (engineConfigSnapshot.model as string) || 'gpt-4o'

      // 从 store 中获取 provider 配置，计算真实上游 URL
      let upstreamUrl = 'http://127.0.0.1:8080/v1/chat/completions'
      try {
        const provider = storeManager.getProviderById(providerId)
        if (provider) {
          const chatPath = (provider as any).chatPath || '/v1/chat/completions'
          const base = (provider.apiEndpoint || '').replace(/\/+$/, '')
          const path = chatPath.startsWith('/') ? chatPath : '/' + chatPath
          upstreamUrl = base ? (base + path) : upstreamUrl
        }
      } catch {
        // provider not found, use fallback
      }

      storeManager.addRequestLog({
        timestamp: Date.now(),
        status: 'pending',
        statusCode: 0,
        method: 'POST',
        url: '/v1/chat/completions',
        model: engineModel,
        isStream: true,
        responseStatus: 0,
        chatUserInput: text,
        chatEngineInput: text,
        chatEngineUrl: 'http://127.0.0.1:8080/v1/chat/completions',
        chatEngineProvider: providerId,
        chatEngineModel: engineModel,
        chatUpstreamUrl: upstreamUrl,
        chatNotes: '[IPC] Message received, forwarding to Engine',
      })
    } catch {
      storeManager.addRequestLog({
        timestamp: Date.now(),
        status: 'error',
        statusCode: 500,
        method: 'POST',
        url: '/v1/chat/completions',
        model: '',
        isStream: false,
        responseStatus: 500,
        chatUserInput: text,
        chatEngineInput: text,
        chatNotes: '[IPC] Engine not ready',
        errorMessage: '引擎未初始化',
      })
      const initErr = formatSystemError('引擎未初始化', getLang())
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: initErr })
      return { success: false, error: initErr, requestId }
    }

    try {
      const t0 = Date.now()

      // 使用事件驱动模式：将 MessageLoop 的 AgentEvent 转发为 IPC 消息
      const eventHandler = (event: AgentEvent) => {
        // 防御：sender 可能在窗口关闭后失效，避免 Electron 抛出 Missing required channel argument
        if (!sender?.isDestroyed?.()) {
          switch (event.type) {
            case 'response_chunk':
              sender.send(IpcChannels.CHAT_STREAM_CHUNK, { requestId, chunk: event.content as string })
              break
            case 'reasoning':
              sender.send(IpcChannels.CHAT_STREAM_REASONING, { requestId, reasoning: event.text as string })
              break
            case 'tool_call_start':
              sender.send(IpcChannels.CHAT_STREAM_TOOL_START, {
                requestId,
                toolUseId: event.toolUseId,
                toolName: event.toolName,
                input: event.input,
              })
              break
            case 'post_tool_use':
              sender.send(IpcChannels.CHAT_STREAM_TOOL_RESULT, {
                requestId,
                toolUseId: event.toolUseId,
                toolName: event.toolName,
                success: event.success,
                output: event.output,
                error: event.error,
              })
              break
            case 'needs_user':
              sender.send(IpcChannels.CHAT_STREAM_NEEDS_USER, {
                requestId,
                prompt: event.prompt,
              })
              break
            case 'error':
              sender.send(IpcChannels.CHAT_STREAM_ERROR, {
                requestId,
                error: event.error,
                stack: event.stack,
              })
              break
            case 'aborted':
              sender.send(IpcChannels.CHAT_STREAM_ABORTED, { requestId })
              break
            case 'done':
              const result = event.result
              const lastMessage = result.messages[result.messages.length - 1]
              const content = lastMessage?.content && typeof lastMessage.content === 'string'
                ? lastMessage.content
                : ''
              sender.send(IpcChannels.CHAT_STREAM_DONE, {
                requestId,
                content,
                toolOutput: '',
                iterations: result.iterations,
                duration: result.duration,
              })
              break
          }
        }
      }

      // 注册事件处理器后执行查询（把 eventHandler 注入引擎，驱动 response_chunk/done/error 事件
      // 转发到渲染层；engine.query 的 onEvent 默认是空回调，不传会导致前端收不到任何流事件）
      const result = await eng.query(text, eventHandler)

      // eventHandler 已在 'done' 事件中发送 CHAT_STREAM_DONE，此处无需重复发送
      const lastMsg = result.messages[result.messages.length - 1]
      const resolvedContent = lastMsg?.content && typeof lastMsg.content === 'string' ? lastMsg.content : ''
      console.log('[IPC][CHAT_SEND_MESSAGE] eng.query DONE after', Date.now() - t0, 'ms, contentLen=', resolvedContent.length, 'requestId=', requestId)

      // 回合结束后台处理：Stop 钩子 + 自动记忆。
      // 刻意不 await —— 用户不应为后台任务等待，失败也不影响本次回复。
      void runPostTurnTasks(text, result.messages)

      return { success: true, requestId }
    } catch (e) {
      const raw = (e as Error).message
      const msg = formatSystemError(raw, getLang())
      console.error('[IPC][CHAT_SEND_MESSAGE] eng.query ERROR:', msg, 'requestId=', requestId)
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: msg })
      return { success: false, error: msg, requestId }
    }
  })

  // 新增：消息循环事件订阅（渲染层可通过此通道实时接收事件）
  ipcMain.handle(IpcChannels.CHAT_SUBSCRIBE_EVENTS, async (event) => {
    const sender = event.sender
    const eng = getEngineInstance()
    if (!eng) return { success: false, error: '引擎未初始化' }

    const unsubscribe = () => {
      // 移除事件处理器（实际实现中需要维护订阅列表）
      console.log('[IPC] chat:subscribeEvents unsubscribed')
    }

    // 返回订阅确认
    return { success: true, message: 'Events subscribed' }
  })

  // 新增：取消事件订阅
  ipcMain.handle(IpcChannels.CHAT_UNSUBSCRIBE_EVENTS, async () => {
    return { success: true }
  })

  ipcMain.handle(IpcChannels.CHAT_GET_HISTORY, async () => {
    if (!isEngineReady()) {
      return { messages: [] }
    }
    try {
      return { messages: getEngineInstance()!.getHistory() }
    } catch {
      return { messages: [] }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_CLEAR_HISTORY, async () => {
    if (!isEngineReady()) {
      return false
    }
    try {
      getEngineInstance()!.clearHistory()

      // 会话状态随之作废，必须一并清理 —— 否则新会话会复用上一个会话的
      // 派生状态：记忆召回缓存（按用户输入指纹索引）、工具结果替换决策
      // （冻结语义会让新会话继续沿用旧决策）。
      try {
        const { clearSectionCache } = await import('../../engine/promptSections.ts')
        clearSectionCache()
      } catch { /* 缓存清理属增强项，失败不影响主流程 */ }
      try {
        const { resetRequestBuilderCaches } = await import('../engine-bridge.ts')
        resetRequestBuilderCaches()
      } catch { /* 同上 */ }

      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IpcChannels.CHAT_GET_CONFIG, async () => {
    if (!isEngineReady()) {
      return {}
    }
    try {
      return getEngineInstance()!.getConfig()
    } catch {
      return {}
    }
  })

  ipcMain.handle(IpcChannels.CHAT_SET_CONFIG, async (_, updates: Record<string, unknown>) => {
    if (!isEngineReady()) {
      return { success: false, error: '引擎未初始化' }
    }
    try {
      // 重建引擎 API 客户端使 baseUrl / apiKey / model 真正生效。
      const configUpdate: {
        provider?: string; model?: string; apiKey?: string; baseUrl?: string
        systemPrompt?: string; promptGroups?: Record<string, unknown>
      } = {
        provider: updates.provider as string,
        model: updates.model as string,
        apiKey: updates.apiKey as string,
        baseUrl: updates.baseUrl as string,
      }
      if (typeof updates.systemPrompt === 'string') configUpdate.systemPrompt = updates.systemPrompt
      if (updates.promptGroups && typeof updates.promptGroups === 'object') configUpdate.promptGroups = updates.promptGroups as Record<string, unknown>
      updateEngineApiClient(configUpdate)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_EXECUTE_COMMAND, async (_, name: string, args: string[]) => {
    logManager.info('[IPC] chat:executeCommand', { data: { name, args } })
    try {
      const eng = getEngineInstance()
      if (!eng) {
        return { success: false, error: '引擎未初始化' }
      }
      // QueryEngine.executeCommand：ToolCollection → 命令注册表
      const result = await eng.executeCommand(name, args)
      logManager.info('[IPC] chat:executeCommand result', { data: { success: result.success } })
      return result
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] chat:executeCommand error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  // 新增：Human-in-the-loop 权限响应
  ipcMain.handle(IpcChannels.CHAT_GRANT_PERMISSION, async (_, requestId: string) => {
    try {
      getEngineInstance()?.grantPermission(requestId)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_DENY_PERMISSION, async (_, requestId: string) => {
    try {
      getEngineInstance()?.denyPermission(requestId)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 新增：暂停/恢复
  ipcMain.handle(IpcChannels.CHAT_PAUSE, async (_, reason?: string) => {
    try {
      getEngineInstance()?.pause(reason)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_RESUME, async (_, input?: string) => {
    try {
      getEngineInstance()?.resume(input)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 新增：获取引擎状态
  ipcMain.handle(IpcChannels.CHAT_GET_STATE, async () => {
    try {
      return { state: getEngineInstance()?.getState() || 'idle' }
    } catch {
      return { state: 'idle' }
    }
  })

  // ==================== Profiles IPC Handlers ====================

  const pm = new ProfileManager()

  ipcMain.handle(IpcChannels.PROFILES_GET_ALL, async () => {
    logManager.info('[IPC] profiles:getAll invoked')
    try {
      const profiles = pm.list()
      const projectPaths = pm.getProjectPaths()
      const active = pm.getActive()?.name ?? null
      logManager.info('[IPC] profiles:getAll success', {
        data: { count: profiles.length, active, projectPaths, names: profiles.map((p: any) => p.name) }
      })
      return { success: true, profiles, activeProfile: active }
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] profiles:getAll error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IpcChannels.PROFILES_GET_ACTIVE, async () => {
    try {
      return { success: true, profile: pm.getActive() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PROFILES_SET_ACTIVE, async (_, name: string) => {
    logManager.info('[IPC] profiles:setActive', { data: { name } })
    try {
      const profile = pm.setActive(name)
      if (!profile) {
        logManager.warn('[IPC] profiles:setActive not found', { data: { name } })
        return { success: false, error: '配置组 "' + name + '" 不存在' }
      }
      const engineCfg = pm.toEngineConfig(profile)
      // 用配置组自己的 provider / baseUrl / apiKey / model 重建引擎 API 客户端（直连）。
      // 注意：engine.updateConfig() 不处理 baseUrl / apiKey，只有 updateEngineApiClient()
      // 会重建 sendMessage 闭包，所以以前写死的 127.0.0.1:8080 既无效、又会让
      // 「选配置组后直连」悄悄变成访问本地代理。代理模式请用 UI 的模式开关。
      updateEngineApiClient({
        provider: engineCfg.provider,
        model: engineCfg.model,
        apiKey: engineCfg.apiKey,
        baseUrl: engineCfg.baseUrl,
        ...(engineCfg.systemPrompt ? { systemPrompt: engineCfg.systemPrompt } : {}),
        ...(engineCfg.promptGroups ? { promptGroups: engineCfg.promptGroups } : {}),
      })

      // 统一使用 syncProfileApiKey 同步到代理认证列表
      syncProfileApiKey(profile)

      logManager.info('[IPC] profiles:setActive success', { data: { baseUrl: engineCfg.baseUrl, model: engineCfg.model } })
      return { success: true, profile }
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] profiles:setActive error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IpcChannels.PROFILES_UPSERT, async (_, profile: Profile) => {
    logManager.info('[IPC] profiles:upsert', { data: { name: profile.name } })
    try {
      pm.upsert(profile)
      logManager.info('[IPC] profiles:upsert success')
      return { success: true }
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] profiles:upsert error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IpcChannels.PROFILES_REMOVE, async (_, name: string) => {
    logManager.info('[IPC] profiles:remove', { data: { name } })
    try {
      const ok = pm.remove(name)
      if (ok) {
        logManager.info('[IPC] profiles:remove success')
      } else {
        logManager.warn('[IPC] profiles:remove not found', { data: { name } })
      }
      return { success: ok, error: ok ? null : '配置组 "' + name + '" 不存在' }
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] profiles:remove error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  // ==================== .doge Config File IPC Handlers ====================

  const DOGE_DIR = join(process.cwd(), '.doge')

  ipcMain.handle(IpcChannels.DOGE_LIST_CONFIG_FILES, async () => {
    try {
      const files: Array<{ name: string; path: string; size: number; modified: number }> = []
      const entries = readdirSync(DOGE_DIR)
      for (const name of entries) {
        const fullPath = join(DOGE_DIR, name)
        try {
          const stat = statSync(fullPath)
          if (stat.isFile() && name.endsWith('.json')) {
            files.push({
              name,
              path: fullPath,
              size: stat.size,
              modified: stat.mtimeMs,
            })
          }
        } catch {
          // skip unreadable entries
        }
      }
      files.sort((a, b) => b.modified - a.modified)
      return { success: true, files }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.DOGE_READ_CONFIG_FILE, async (_, name: string) => {
    try {
      const fullPath = join(DOGE_DIR, name)
      const content = readFileSync(fullPath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.DOGE_DELETE_CONFIG_FILE, async (_, name: string) => {
    try {
      const fullPath = join(DOGE_DIR, name)
      unlinkSync(fullPath)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Config Groups IPC Handlers ====================

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_LIST, async () => {
    try {
      const groups = configGroupManager.listGroups()
      const active = configGroupManager.getActiveGroup()
      return { success: true, groups, activeGroup: active?.id ?? null }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_GET, async (_, id: string) => {
    try {
      const group = configGroupManager.getGroup(id)
      if (!group) {
        return { success: false, error: '配置组不存在' }
      }
      const data = configGroupManager.readGroup(id)
      return { success: true, group, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_GET_BY_ID, async (_, id: string) => {
    try {
      const group = configGroupManager.getGroup(id)
      if (!group) {
        return { success: false, error: '配置组不存在' }
      }
      const data = configGroupManager.readGroup(id)
      return { success: true, group, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_CREATE, async (_, id: string, data?: Partial<ConfigGroupData>) => {
    try {
      const group = configGroupManager.createGroup(id, data)
      if (!group) {
        return { success: false, error: '配置组已存在' }
      }
      return { success: true, group }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_UPDATE, async (_, id: string, data: ConfigGroupData) => {
    try {
      const existing = configGroupManager.readGroup(id)
      if (!existing) {
        return { success: false, error: '配置组不存在' }
      }
      const success = configGroupManager.writeGroup(id, data)
      if (!success) {
        return { success: false, error: '写入配置组失败' }
      }
      const group = configGroupManager.getGroup(id)
      return { success: true, group }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_DELETE, async (_, id: string) => {
    try {
      const success = configGroupManager.deleteGroup(id)
      if (!success) {
        return { success: false, error: '配置组不存在' }
      }
      return { success: true, id, deleted: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_SET_ACTIVE, async (_, id: string) => {
    try {
      const success = configGroupManager.setActiveGroup(id)
      if (!success) {
        return { success: false, error: '配置组不存在' }
      }
      const group = configGroupManager.getGroup(id)
      return { success: true, group }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CONFIG_GROUPS_SWITCH, async (event, id: string) => {
    try {
      const groups = configGroupManager.listGroups()
      const target = groups.find((g) => g.id === id)
      if (!target) {
        return { success: false, error: '配置组不存在' }
      }

      // 1. 设置当前配置组为活跃
      configGroupManager.setActiveGroup(id)

      // 2. 读取目标配置组数据中的 activePreset，获取该 preset 的完整配置
      const groupData = configGroupManager.readGroup(id)
      if (!groupData || !groupData.activePreset) {
        return { success: false, error: '配置组中没有已启用的预设' }
      }

      const preset = groupData.presets[groupData.activePreset]
      if (!preset) {
        return { success: false, error: '配置组中未找到已启用的预设' }
      }

      // 3. 同步 apiKey 到代理认证列表
      if (preset.apiKey) {
        syncProfileApiKey({
          name: groupData.activePreset,
          apiKey: preset.apiKey,
          baseUrl: preset.baseURL,
          provider: preset.provider,
          model: preset.model,
        } as Profile)
      }

      // 4. 更新引擎配置（同样需要重建 API 客户端，否则 baseUrl / apiKey 不生效）
      updateEngineApiClient({
        provider: preset.provider,
        baseUrl: preset.baseURL,
        apiKey: preset.apiKey,
        model: preset.model,
      })

      // 5. 通知前端配置已变更
      try {
        const sender = event.sender
        sender.send(IpcChannels.CONFIG_CHANGED, { groupId: id, presetId: groupData.activePreset })
      } catch {
        // webContents 可能已关闭
      }

      logManager.info('[IPC] configGroups:switch success', { data: { groupId: id, presetId: groupData.activePreset } })
      return { success: true, group: target, preset: groupData.activePreset }
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] configGroups:switch error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  // ==================== Team Task 多角色任务 ====================

  ipcMain.handle(IpcChannels.TEAM_EXECUTE, async (event, description: string, customRoles?: Array<{ id: string; name: string; systemPrompt: string }>) => {
    const sender = event.sender as WebContents
    const eng = getEngineInstance()
    if (!eng) {
      sender.send(IpcChannels.TEAM_STREAM_ERROR, { error: '引擎未初始化' })
      return { success: false, error: '引擎未初始化' }
    }
    const cfg = eng.getConfig()
    const plansDir = join(process.cwd(), '.kx2code', 'plans', 'team')
    const roles = customRoles && customRoles.length > 0 ? customRoles : BUILTIN_ROLES

    try {
      const orchestrator = new Orchestrator(
        {
          llm: {
            provider: (cfg.provider as 'openai' | 'anthropic') || 'openai',
            apiKey: (cfg.apiKey as string) || '',
            model: (cfg.model as string) || 'gpt-4o',
            baseUrl: (cfg.baseUrl as string) || '',
            maxTokens: (cfg.maxOutputTokens as number) || 4096,
          },
          maxDiscussionRounds: 2,
          maxRetries: 0,
          plansDir,
          cwd: process.cwd(),
        },
        {
          onPhaseChange: (phase, detail) => {
            sender.send(IpcChannels.TEAM_STREAM_PHASE, { phase, detail })
          },
          onDiscussionRound: (round) => {
            const role = roles.find((r: any) => r.id === round.roleId)
            sender.send(IpcChannels.TEAM_STREAM_DISCUSSION, {
              id: round.id,
              phase: round.phase,
              roleId: round.roleId,
              roleName: role?.name || round.roleId,
              content: round.content,
            })
          },
          onTaskStart: (task) => {
            sender.send(IpcChannels.TEAM_STREAM_TASK, { type: 'start', taskId: task.id, description: task.description })
          },
          onTaskComplete: (task, result) => {
            sender.send(IpcChannels.TEAM_STREAM_TASK, {
              type: 'complete',
              taskId: task.id,
              description: task.description,
              success: result.success,
              durationMs: result.durationMs,
              output: result.output?.slice(0, 500),
              error: result.error,
            })
          },
          onPlanGenerated: (plan) => {
            sender.send(IpcChannels.TEAM_STREAM_PHASE, { phase: 'plan-generated', detail: plan.id })
          },
        },
        roles
      )

      const report = await orchestrator.execute({
        id: 'team-' + Date.now(),
        description,
      })

      sender.send(IpcChannels.TEAM_STREAM_DONE, {
        success: report.success,
        totalDurationMs: report.totalDurationMs,
        discussionRounds: report.discussionRounds,
        taskResults: report.taskResults,
        planId: report.planId,
      })

      return { success: true, report }
    } catch (e) {
      const err = (e as Error).message
      sender.send(IpcChannels.TEAM_STREAM_ERROR, { error: err })
      return { success: false, error: err }
    }
  })

  ipcMain.handle(IpcChannels.TEAM_GET_RESULT, async (_, planId: string) => {
    try {
      const plansDir = join(process.cwd(), '.kx2code', 'plans', 'team')
      const files = existsSync(plansDir) ? readdirSync(plansDir) : []
      const match = files.find(f => f.startsWith(planId) && f.endsWith('.report.json'))
      if (!match) return { success: false, error: '未找到报告' }
      const data = JSON.parse(readFileSync(join(plansDir, match), 'utf-8'))
      return { success: true, data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

}

