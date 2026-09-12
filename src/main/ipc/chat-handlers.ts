/**
 * main/ipc/chat-handlers.ts — Chat IPC handlers + Profiles IPC handlers + .doge config handlers
 */

import { ipcMain, type WebContents } from 'electron'
import { IpcChannels } from './channels'
import { getEngine } from '../../engine/core'
import { isEngineReady } from '../engine-bridge'
import { ProfileManager } from '../profiles/manager'
import { logManager } from '../logger/manager'
import { storeManager } from '../store/store'
import { syncProfileApiKey } from '../store/apiKeySync'
import { readFileSync, statSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Profile } from '../profiles/manager'
import { Orchestrator } from '../../engine/agent/coordinator/orchestrator'
import { BUILTIN_ROLES } from '../../engine/agent/coordinator/planner'
import { formatSystemError } from '../../shared/formatError'

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

  ipcMain.handle(IpcChannels.CHAT_SEND_MESSAGE, async (event, text: string) => {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const sender = event.sender

    // 检查引擎是否就绪
    if (!isEngineReady()) {
      const initErr = formatSystemError('Engine not initialized', getLang())
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: initErr })
      return { success: false, error: initErr, requestId }
    }

    // 记录聊天流水线日志 — IPC 入口
    let engineConfigSnapshot: Record<string, unknown> = {}
    try {
      const eng = getEngine()
      engineConfigSnapshot = eng.getConfig()

      // 计算真实上游 URL（基于引擎配置中的 provider + baseUrl）
      const providerId = (engineConfigSnapshot.provider as string) || ''
      const engineBaseUrl = (engineConfigSnapshot.baseUrl as string) || 'http://127.0.0.1:8080'
      const engineModel = (engineConfigSnapshot.model as string) || request.model

      // 从 store 中获取 provider 配置，计算真实上游 URL
      let upstreamUrl = engineBaseUrl + '/v1/chat/completions'
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
        chatEngineUrl: engineBaseUrl + '/v1/chat/completions',
        chatEngineProvider: providerId,
        chatEngineModel: engineModel,
        chatUpstreamUrl: upstreamUrl,
        chatNotes: '[IPC] Message received, forwarding to Engine',
      })
    } catch {
      // engine not ready yet, log without config
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
        errorMessage: 'Engine not initialized',
      })
      const initErr = formatSystemError('Engine not initialized', getLang())
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: initErr })
      return { success: false, error: initErr, requestId }
    }

    try {
      const eng = getEngine()
      const t0 = Date.now()
      console.log('[IPC][CHAT_SEND_MESSAGE] calling eng.query text=', JSON.stringify(text).slice(0, 50), 'requestId=', requestId)
      const onStream = (chunk: string) => {
        sender.send(IpcChannels.CHAT_STREAM_CHUNK, { requestId, chunk })
      }
      const result = await eng.query(text, null as any, onStream)
      console.log('[IPC][CHAT_SEND_MESSAGE] eng.query DONE after', Date.now() - t0, 'ms, contentLen=', result.content?.length, 'requestId=', requestId)
      sender.send(IpcChannels.CHAT_STREAM_DONE, { requestId, content: result.content, toolOutput: result.toolOutput })
      return { success: true, requestId }
    } catch (e) {
      const raw = (e as Error).message
      const msg = formatSystemError(raw, getLang())
      console.error('[IPC][CHAT_SEND_MESSAGE] eng.query ERROR:', msg, 'requestId=', requestId)
      sender.send(IpcChannels.CHAT_STREAM_ERROR, { requestId, error: msg })
      return { success: false, error: msg, requestId }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_GET_HISTORY, async () => {
    if (!isEngineReady()) {
      return { messages: [] }
    }
    try {
      return getEngine().getHistory()
    } catch {
      return { messages: [] }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_CLEAR_HISTORY, async () => {
    if (!isEngineReady()) {
      return false
    }
    try {
      getEngine().clearHistory()
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
      return getEngine().getConfig()
    } catch {
      return {}
    }
  })

  ipcMain.handle(IpcChannels.CHAT_SET_CONFIG, async (_, updates: Record<string, unknown>) => {
    if (!isEngineReady()) {
      return { success: false, error: 'Engine not initialized' }
    }
    try {
      const eng = getEngine()
      if (eng.updateConfig) {
        eng.updateConfig(updates as Parameters<typeof eng.updateConfig>[0])
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.CHAT_EXECUTE_COMMAND, async (_, name: string, args: string[]) => {
    logManager.info('[IPC] chat:executeCommand', { data: { name, args } })
    try {
      const result = await getEngine().executeCommand(name, args)
      logManager.info('[IPC] chat:executeCommand result', { data: { success: result.success } })
      return result
    } catch (e) {
      const msg = (e as Error).message
      logManager.error('[IPC] chat:executeCommand error', { data: { error: msg } })
      return { success: false, error: msg }
    }
  })

  // ==================== Profiles IPC Handlers ====================

  const pm = new ProfileManager()

  ipcMain.handle(IpcChannels.PROFILES_GET_ALL, async () => {
    logManager.info('[IPC] profiles:getAll invoked')
    try {
      const profiles = pm.list()
      const active = pm.getActive()?.name ?? null
      logManager.info('[IPC] profiles:getAll success', { data: { count: profiles.length, active } })
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
      const targetBaseUrl = 'http://127.0.0.1:8080'
      engineCfg.baseUrl = targetBaseUrl
      getEngine().updateConfig(engineCfg)

      // 统一使用 syncProfileApiKey 同步到代理认证列表
      syncProfileApiKey(profile)

      logManager.info('[IPC] profiles:setActive success', { data: { proxyUrl: targetBaseUrl } })
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

  // ==================== Team Task 多角色任务 ====================

  ipcMain.handle(IpcChannels.TEAM_EXECUTE, async (event, description: string, customRoles?: Array<{ id: string; name: string; systemPrompt: string }>) => {
    const sender = event.sender as WebContents
    const eng = getEngine()
    const cfg = eng.getConfig()
    const plansDir = join(process.cwd(), '.kx2code', 'plans', 'team')
    const roles = customRoles && customRoles.length > 0 ? customRoles : BUILTIN_ROLES

    try {
      const orchestrator = new Orchestrator(
        {
          llm: {
            provider: cfg.provider as 'openai' | 'anthropic',
            apiKey: cfg.apiKey as string,
            model: cfg.model as string,
            baseUrl: cfg.baseUrl as string,
            maxTokens: cfg.maxTokens as number || 4096,
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
