/**
 * Proxy Service Module - Chat Completions Route
 * Implements /v1/chat/completions route
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { PassThrough } from 'stream'
import { ChatCompletionRequest, ChatCompletionResponse, ProxyContext } from '../types'
import { loadBalancer } from '../loadbalancer'
import { requestForwarder } from '../forwarder'
import { streamHandler } from '../stream'
import { proxyStatusManager } from '../status'
import { modelMapper } from '../modelMapper'
import { storeManager } from '../../store/store'
import { 
  isAnthropicToolFormat,
  transformResponseToAnthropic,
  transformChunkToAnthropic
} from '../utils/toolFormatConverter'

const router = new Router({ prefix: '/v1/chat' })

/**
 * Generate Request ID
 */
function generateRequestId(): string {
  return `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Get Client IP
 */
function getClientIP(ctx: Context): string {
  return ctx.headers['x-real-ip'] as string ||
    ctx.headers['x-forwarded-for'] as string ||
    ctx.ip ||
    'unknown'
}

/**
 * Extract user input from messages (last user message, full content)
 */
function extractUserInput(messages: Array<{ role: string; content?: string | any[] | null }>): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'user' && msg.content) {
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter((p: any) => p.type === 'text')
        if (textParts.length > 0) {
          content = textParts.map((p: any) => p.text || '').join(' ')
        }
      }
      if (content) {
        return content
      }
    }
  }
  return undefined
}

/**
 * Handle Chat Completions Request
 */
router.post('/completions', async (ctx: Context) => {
  const startTime = Date.now()
  const requestId = generateRequestId()
  const clientIP = getClientIP(ctx)

  // koa-bodyparser 未增强 @types/koa 的 body 类型（默认 {}），先断言再取字段
  const rawBody = ctx.request.body as { model?: string; stream?: boolean } | undefined
  console.log(`[Chat] ENTER reqId=${requestId} model=${rawBody?.model || '?'} stream=${rawBody?.stream || '?'}`)

  let request: ChatCompletionRequest
  try {
    request = ctx.request.body as ChatCompletionRequest
    console.log('[Chat] STEP-1 body ok model=', request.model, 'stream=', request.stream, 'msgs=', request.messages?.length, 'tools=', request.tools?.length)
  } catch (error) {
    console.error('[Chat][ROUTE] body parse error:', error)
    ctx.status = 400
    ctx.body = {
      error: {
        message: '请求体不合法',
        type: 'invalid_request_error',
        param: null,
        code: null,
      },
    }
    return
  }

  if (!request.model) {
    console.warn('[Chat][ROUTE] missing model field')
    ctx.status = 400
    ctx.body = {
      error: {
        message: '缺少必填字段：model',
        type: 'invalid_request_error',
        param: 'model',
        code: null,
      },
    }
    return
  }

  if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
    console.warn('[Chat][ROUTE] missing messages field')
    ctx.status = 400
    ctx.body = {
      error: {
        message: '缺少必填字段：messages',
        type: 'invalid_request_error',
        param: 'messages',
        code: null,
      },
    }
    return
  }

  // Read feature parameters from Headers (lower priority than request body)
  const webSearchFromHeader = ctx.headers['x-web-search'] === 'true'
  const reasoningEffortFromHeader = ctx.headers['x-reasoning-effort'] as 'low' | 'medium' | 'high' | undefined
  const deepResearchFromHeader = ctx.headers['x-deep-research'] === 'true'

  // Handle reasoningEffort (camelCase) from AI SDK - convert to reasoning_effort (snake_case)
  const requestAny = request as any
  if (requestAny.reasoningEffort && !request.reasoning_effort) {
    request.reasoning_effort = requestAny.reasoningEffort
    console.log('[Chat] Reasoning effort set via reasoningEffort (camelCase):', requestAny.reasoningEffort)
    delete requestAny.reasoningEffort
  }

  // Merge into request (request body parameters take priority)
  if (webSearchFromHeader && request.web_search === undefined) {
    request.web_search = true
    console.log('[Chat] Web search enabled via X-Web-Search header')
  }
  if (reasoningEffortFromHeader && request.reasoning_effort === undefined) {
    request.reasoning_effort = reasoningEffortFromHeader
    console.log('[Chat] Reasoning effort set via X-Reasoning-Effort header:', reasoningEffortFromHeader)
  }
  if (deepResearchFromHeader && request.deep_research === undefined) {
    request.deep_research = true
    console.log('[Chat] Deep research enabled via X-Deep-Research header')
  }

  const config = storeManager.getConfig()
  const preferredProviderId = modelMapper.getPreferredProvider(request.model)
  const preferredAccountId = modelMapper.getPreferredAccount(request.model)

  const selection = loadBalancer.selectAccount(
    request.model,
    config.loadBalanceStrategy,
    preferredProviderId,
    preferredAccountId
  )

  if (!selection) {
    console.log('[Chat] selectAccount returned null')

    // Build diagnostic info from load balancer logs
    const allProviders = storeManager.getProviders()
    const enabledProviders = allProviders.filter(p => p.enabled)
    let hint = ''

    if (enabledProviders.length === 0) {
      hint = '没有启用的供应商，请在设置中启用至少一个供应商。'
    } else {
      for (const provider of enabledProviders) {
        const effectiveModels = storeManager.getEffectiveModels(provider.id)
        // 原实现写成裸 `model`，但本作用域只有 `request.model`。
        // 这段是「无可用账户」时的诊断提示构造 —— 走到这里本是为了给出
        // 「哪个供应商不支持该模型」，却因 ReferenceError 让整条错误处理路径崩掉，
        // 用户反而看不到任何原因。
        const requestedModel = String(request.model ?? '')
        const supported = effectiveModels.some(
          m => m.displayName.toLowerCase() === requestedModel.toLowerCase(),
        )
        const accounts = storeManager.getAccountsByProviderId(provider.id, true)
        const activeAccounts = accounts.filter(a => a.status === 'active' && a.credentials?.token)

        if (!supported) {
          hint += `供应商"${provider.name}"不支持模型"${request.model}"。`
        } else if (activeAccounts.length === 0) {
          if (accounts.length === 0) {
            hint += `供应商"${provider.name}"没有配置账户，请添加账户。`
          } else {
            const badAccounts = accounts.map(a => `${a.name}(${a.status})`).join(', ')
            hint += `供应商"${provider.name}"的账户状态异常: ${badAccounts}。`
          }
        }
      }
    }

    if (!hint) {
      hint = '所有供应商均无可用账户，请检查供应商配置和账户状态。'
    }

    ctx.status = 503
    ctx.body = {
      error: {
        message: `模型 "${request.model}" 无可用账户。${hint}`,
        type: 'service_unavailable_error',
        param: null,
        code: 'no_available_account',
      },
    }
    return
  }

  const { account, provider, actualModel } = selection
  console.log('[Chat] STEP-3 selected provider=', provider.id, 'account=', account.id, 'model=', actualModel)

  const context: ProxyContext = {
    requestId,
    providerId: provider.id,
    accountId: account.id,
    model: request.model,
    actualModel,
    startTime,
    isStream: request.stream || false,
    clientIP,
  }

  proxyStatusManager.recordRequestStart(request.model, provider.id, account.id)

  try {
    const result = await requestForwarder.forwardChatCompletion(
      request,
      account,
      provider,
      actualModel,
      context
    )

    const latency = Date.now() - startTime

    if (!result.success) {
      proxyStatusManager.recordRequestFailure(latency)

      if (result.status && result.status >= 400 && result.status !== 429) {
        loadBalancer.markAccountFailed(account.id)
      }

      ctx.status = result.status || 500
      ctx.body = {
        error: {
          message: result.error || 'Request failed',
          type: 'api_error',
          param: null,
          code: null,
        },
      }

      storeManager.addLog('error', `Request failed: ${result.error}`, {
        requestId,
        providerId: provider.id,
        accountId: account.id,
        model: request.model,
        latency,
      })

      const userInput = extractUserInput(request.messages)
      const errorResponseBody = JSON.stringify({
        error: {
          message: result.error || 'Request failed',
          type: 'api_error',
          param: null,
          code: null,
        },
      })
      storeManager.addRequestLog({
        timestamp: startTime,
        status: 'error',
        statusCode: result.status || 500,
        method: 'POST',
        url: '/v1/chat/completions',
        model: request.model,
        actualModel,
        providerId: provider.id,
        providerName: provider.name,
        accountId: account.id,
        accountName: account.name,
        requestBody: JSON.stringify(request),
        userInput,
        webSearch: request.web_search,
        reasoningEffort: request.reasoning_effort,
        responseStatus: result.status || 500,
        responseBody: errorResponseBody,
        responsePreview: errorResponseBody?.slice(0, 1000),
        latency,
        isStream: request.stream || false,
        errorMessage: result.error,
      })

      storeManager.recordRequestInStats(false, latency, request.model, provider.id, account.id)

      return
    }

    loadBalancer.clearAccountFailure(account.id)

    proxyStatusManager.recordRequestSuccess(latency)

    storeManager.updateAccount(account.id, {
      lastUsed: Date.now(),
      requestCount: (account.requestCount || 0) + 1,
      todayUsed: (account.todayUsed || 0) + 1,
    })

    storeManager.addLog('debug', `Request succeeded`, {
      requestId,
      providerId: provider.id,
      accountId: account.id,
      model: request.model,
      actualModel,
      latency,
      isStream: request.stream,
    })

    const userInput = extractUserInput(request.messages)
    // Prepare response body for logging (only for non-stream requests)
    const responseBodyForLog = !request.stream && result.body
      ? JSON.stringify(result.body)
      : undefined

    // Build upstream URL for logging from provider config
    const chatPath = provider.chatPath || '/chat/completions'
    let baseUrl = provider.apiEndpoint || ''
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    const computedUpstreamUrl = chatPath.startsWith('/')
      ? `${baseUrl}${chatPath}`
      : `${baseUrl}/${chatPath}`
    const upstreamUrl = computedUpstreamUrl

    // For streaming requests, we'll collect content and update the log later
    let logEntryId: string | undefined

    if (!request.stream) {
      // Non-streaming: record log with response body now
      const logEntry = storeManager.addRequestLog({
        timestamp: startTime,
        status: 'success',
        statusCode: 200,
        method: 'POST',
        url: '/v1/chat/completions',
        model: request.model,
        actualModel,
        providerId: provider.id,
        providerName: provider.name,
        accountId: account.id,
        accountName: account.name,
        requestBody: JSON.stringify(request),
        userInput,
        webSearch: request.web_search,
        reasoningEffort: request.reasoning_effort,
        responseStatus: 200,
        responseBody: responseBodyForLog,
        responsePreview: responseBodyForLog?.slice(0, 1000),
        latency,
        isStream: false,
        chatUpstreamUrl: upstreamUrl,
        chatProxyProviderId: provider.id,
        chatProxyProviderName: provider.name,
        chatProxyAccountId: account.id,
        chatProxyAccountName: account.name,
        chatProxyActualModel: actualModel,
        chatUpstreamStatus: result.status || 200,
        chatUpstreamIsStream: false,
        chatProxyProcessLatency: latency,
        chatNotes: '[Proxy] Forwarded to ' + provider.name + '/' + account.name + ', model=' + actualModel,
      })
      logEntryId = logEntry.id
    } else {
      // Streaming: record log now, will update response body later
      const logEntry = storeManager.addRequestLog({
        timestamp: startTime,
        status: 'success',
        statusCode: 200,
        method: 'POST',
        url: '/v1/chat/completions',
        model: request.model,
        actualModel,
        providerId: provider.id,
        providerName: provider.name,
        accountId: account.id,
        accountName: account.name,
        requestBody: JSON.stringify(request),
        userInput,
        webSearch: request.web_search,
        reasoningEffort: request.reasoning_effort,
        responseStatus: 200,
        latency,
        isStream: true,
        chatUpstreamUrl: upstreamUrl,
        chatProxyProviderId: provider.id,
        chatProxyProviderName: provider.name,
        chatProxyAccountId: account.id,
        chatProxyAccountName: account.name,
        chatProxyActualModel: actualModel,
        chatUpstreamStatus: result.status || 200,
        chatUpstreamIsStream: true,
        chatProxyProcessLatency: latency,
        chatNotes: '[Proxy] Streaming to ' + provider.name + '/' + account.name + ', model=' + actualModel,
      })
      logEntryId = logEntry.id
    }

    storeManager.recordRequestInStats(true, latency, request.model, provider.id, account.id)

    if (request.stream === true && result.stream) {
      ctx.set('Content-Type', 'text/event-stream')
      ctx.set('Cache-Control', 'no-cache')
      ctx.set('Connection', 'keep-alive')
      ctx.set('X-Accel-Buffering', 'no')

      // Create a wrapper stream to handle errors and collect content
      const wrapperStream = new PassThrough()

      // Propagate generatedByProxy flag for server middleware logging.
      // PassThrough 本身没有该字段，是运行时挂在流上的自定义标记，
      // 由 server.ts 经 ctx.body 读取（(gen) 标签）。
      if (result.generatedByProxy) {
        ;(wrapperStream as PassThrough & { generatedByProxy?: boolean }).generatedByProxy = true
      }

      // Collect stream content for logging (raw SSE output)
      let collectedContent = ''

      // Handle stream errors
      result.stream.once('error', (err: Error) => {
        console.error('[Chat] Stream error:', err.message)

        // Send error as SSE event
        const errorEvent = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: actualModel,
          choices: [{
            index: 0,
            delta: {
              content: `\n\n[Error: ${err.message}]`,
            },
            finish_reason: 'stop',
          }],
        }

        wrapperStream.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
        wrapperStream.write('data: [DONE]\n\n')
        wrapperStream.end()

        storeManager.addLog('error', `Stream error: ${err.message}`, {
          requestId,
          providerId: provider.id,
          accountId: account.id,
          model: request.model,
        })
      })

      // Check if stream is already in correct SSE format (from adapters like Kimi, GLM, DeepSeek)
      if (result.skipTransform) {
        // Stream is already formatted, pipe through wrapper and collect
        result.stream.on('data', (chunk: Buffer) => {
          collectedContent += chunk.toString()
        })

        result.stream.pipe(wrapperStream, { end: false })

        // When source stream ends or closes, update log and end wrapper.
        // Avoid emitting a duplicate `[DONE]`: some adapters (e.g. StepFun)
        // already write their own terminating `[DONE]`, so appending another
        // data: [DONE] here would send two terminator frames to the client and
        // can make the frontend stop rendering or hang.
        let streamEnded = false
        const endWrapperStream = () => {
          if (streamEnded) return
          streamEnded = true
          const alreadyDone = collectedContent.trimEnd().endsWith('data: [DONE]') ||
            collectedContent.trimEnd().endsWith('data:[DONE]')
          if (wrapperStream.writable) {
            wrapperStream.end(alreadyDone ? '' : 'data: [DONE]\n\n')
          }
          if (logEntryId) {
            storeManager.updateRequestLog(logEntryId, {
              responseBody: collectedContent,
              responsePreview: collectedContent.slice(0, 1000),
            })
          }
        }
        result.stream.once('end', endWrapperStream)
        result.stream.once('close', endWrapperStream)
      } else {
        // Need to transform the stream
        const transformStream = streamHandler.createTransformStream(
          actualModel,
          requestId,
          () => {
            // 补上 accountId：以前只写 requestId，导致按账号统计（账号详情的请求趋势）查不到流式请求
            storeManager.addLog('debug', `Stream response completed`, {
              requestId,
              providerId: provider.id,
              accountId: account.id,
              model: request.model,
              actualModel,
              isStream: true,
            })
          }
        )

        // Collect from transform stream output
        transformStream.on('data', (chunk: Buffer) => {
          collectedContent += chunk.toString()
        })

        result.stream.pipe(transformStream)
        transformStream.pipe(wrapperStream, { end: false })

        transformStream.once('end', () => {
          // Update log with collected response
          if (logEntryId) {
            storeManager.updateRequestLog(logEntryId, {
              responseBody: collectedContent,
              responsePreview: collectedContent.slice(0, 1000),
            })
          }
          wrapperStream.end()
        })
      }

      ctx.body = wrapperStream
    } else {
      ctx.set('Content-Type', 'application/json')

      if (result.body) {
        // Propagate generatedByProxy flag so server.ts middleware can log (gen) tag
        // Note: applyToolCallsToResponse may have already set this on result.body
        if (result.generatedByProxy && !(result.body as any).generatedByProxy) {
          (result.body as any).generatedByProxy = true
        }

        // Check if we need to transform to Anthropic format
        if (isAnthropicToolFormat(request.tool_format)) {
          ctx.body = transformResponseToAnthropic(result.body)
          console.log('[Chat] Transformed response to Anthropic tool format')
        } else {
          ctx.body = result.body
        }
      } else {
        ctx.body = {
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: actualModel,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      }
    }
  } catch (error) {
    const latency = Date.now() - startTime
    proxyStatusManager.recordRequestFailure(latency)

    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const errorStack = error instanceof Error ? error.stack : undefined

    ctx.status = 500
    ctx.body = {
      error: {
        message: errorMessage,
        type: 'internal_error',
        param: null,
        code: null,
      },
    }

    console.error('[Chat][ROUTE] UNCAUGHT EXCEPTION:', errorMessage)
    console.error('[Chat][ROUTE] stack:', error instanceof Error ? error.stack?.slice(0, 500) : String(error).slice(0, 500))
    storeManager.addLog('error', `Request exception: ${errorMessage}`, {
      requestId,
      providerId: provider.id,
      accountId: account.id,
      model: request.model,
      latency,
      error: errorMessage,
    })

    const userInput = extractUserInput(request.messages)
    const exceptionResponseBody = JSON.stringify({
      error: {
        message: errorMessage,
        type: 'internal_error',
        param: null,
        code: null,
      },
    })
    storeManager.addRequestLog({
      timestamp: startTime,
      status: 'error',
      statusCode: 500,
      method: 'POST',
      url: '/v1/chat/completions',
      model: request.model,
      actualModel,
      providerId: provider.id,
      providerName: provider.name,
      accountId: account.id,
      accountName: account.name,
      requestBody: JSON.stringify(request),
      userInput,
      webSearch: request.web_search,
      reasoningEffort: request.reasoning_effort,
      responseStatus: 500,
      responseBody: exceptionResponseBody,
      latency,
      isStream: request.stream || false,
      errorMessage,
      errorStack,
    })

    storeManager.recordRequestInStats(false, latency, request.model, provider.id, account.id)
  }
})

export default router

