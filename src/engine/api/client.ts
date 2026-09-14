/**
 * engine/api/client.ts — LLM API 统一客户端
 *
 * 支持 Anthropic Messages API 和 OpenAI Chat Completions API
 * 流式传输 + Tool Use
 */

import axios, { type AxiosInstance } from 'axios'
import { createParser } from 'eventsource-parser'
import { formatSystemError } from '../../shared/formatError'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

export interface ApiConfig {
  provider: 'anthropic' | 'openai' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
  maxTokens?: number
  maxToolRounds?: number
  maxRepeat?: number
}

export interface StreamCallbacks {
  onText: (text: string) => void
  onToolUse: (block: ContentBlock) => void
  onDone: (fullContent: string, toolCalls: ContentBlock[]) => void
  onError: (error: string) => void
  onReasoning?: (text: string) => void
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCallResult {
  tool_use_id: string
  output: string
}

const MAX_TOOL_ROUNDS = 5

let requestCounter = 0

export async function sendMessageStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  requestCounter++
  const reqId = requestCounter
  const isAnthropic = config.provider === 'anthropic' || (!config.baseUrl && !config.provider)
  console.log('[API] sendMessageStream', { reqId, provider: config.provider, baseUrl: config.baseUrl, model: config.model, isAnthropic })

  try {
    if (isAnthropic) {
      await sendAnthropicStream(config, messages, callbacks, signal, reqId)
    } else {
      await sendOpenAIStreamWithTools(config, messages, callbacks, signal, reqId)
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    const raw = (e as Error)?.message || '请求失败'
    callbacks.onError(formatSystemError(raw))
  }
}

async function sendAnthropicStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com'
  console.log('[API] Anthropic request', { reqId, baseUrl, model: config.model })
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 120000,
  })

  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }))

  const systemMsg = messages.find(m => m.role === 'system')
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    stream: true,
    messages: anthropicMessages,
  }
  if (systemMsg) {
    body.system = typeof systemMsg.content === 'string' ? systemMsg.content : ''
  }

  const anthropicEndpoint = '/v1/messages'
  const response = await client.post(anthropicEndpoint, body, { signal })

  console.log('[API][Anthropic] POST status=', response.status, 'stream=', !!response.data)
  let fullText = ''
  const toolCalls: ContentBlock[] = []

  const parser = createParser({
    onEvent(event) {
      if (event.data && event.data !== '[DONE]') {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta
            if (delta.type === 'text_delta') {
              fullText += delta.text
              callbacks.onText(delta.text)
            } else if (delta.type === 'thinking_delta') {
              if (callbacks.onReasoning) callbacks.onReasoning(delta.thinking || delta.text || '')
            } else if (delta.type === 'input_json_delta') {
              const lastTool = toolCalls[toolCalls.length - 1]
              if (lastTool && lastTool.type === 'tool_use') {
                lastTool.input = { ...lastTool.input, ...JSON.parse(delta.partial_json || '{}') }
              }
            }
          } else if (parsed.type === 'content_block_start') {
            const block = parsed.content_block
            if (block.type === 'tool_use') {
              toolCalls.push({ ...block, input: block.input || {} })
              callbacks.onToolUse(toolCalls[toolCalls.length - 1])
            }
          } else if (parsed.type === 'message_stop') {
            callbacks.onDone(fullText, toolCalls)
          } else if (parsed.type === 'error') {
            callbacks.onError(parsed.error?.message || 'API 错误')
          }
        } catch { /* skip unparseable */ }
      }
    },
    onError(error) {
      callbacks.onError(error)
    },
    onRetry() {},
    onComment() {},
  })

  const lines = typeof response.data === 'string' ? response.data : ''
  console.log('[API][Anthropic] response body length=', lines.length)
  for (const line of lines.split('\n')) {
    if (line.startsWith('data:')) {
      parser.feed(line + '\n')
    }
  }
  callbacks.onDone(fullText, toolCalls)
}

async function sendOpenAIStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
  const hasEndpoint = raw.includes('/chat/completions')
  const endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions'
  console.log('[API] OpenAI request', { reqId, endpoint, model: config.model })

  const client = axios.create({
    baseURL: raw,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    timeout: 120000,
  })

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    stream: true,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    })),
  }

  const response = await client.post(endpoint, body, { signal })
  const lines = typeof response.data === 'string' ? response.data : ''
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines))
      controller.close()
    },
  })
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          callbacks.onDone(fullText, [])
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (!parsed.choices || parsed.choices.length === 0) {
            if (!parsed.error) console.log('[API] Non-streaming response:', JSON.stringify(parsed).slice(0, 200))
            return
          }
          const delta = parsed.choices[0].delta?.content || ''
          if (delta) {
            fullText += delta
            callbacks.onText(delta)
          }
          const reasonChunk = (parsed.choices[0].delta?.reasoning_content || parsed.choices[0].delta?.reasoning || parsed.choices[0].delta?.thinking || '') as string
          if (reasonChunk && callbacks.onReasoning) {
            callbacks.onReasoning(reasonChunk)
          }
        } catch (e) { /* skip */ }
      }
    }
  }
  callbacks.onDone(fullText, [])
}

/**
 * 执行单个本地工具命令（通过 commandRegistry + AgentDispatcher）
 * needsAgent 命令会通过 AgentDispatcher 获得真实执行能力
 */
export async function executeLocalTool(name: string, args: string[]): Promise<ToolCallResult> {
  const { commandRegistry } = await import('../commands/registry')
  const cmd = commandRegistry.get(name)
  if (!cmd) {
    return { tool_use_id: '', output: `错误: 未知命令 /${name}` }
  }

  // 直接执行命令
  const result = await cmd.execute(args)

  // needsAgent 命令通过 AgentDispatcher 获得真实能力
  if (result.needsAgent && !result.error) {
    try {
      const { AgentDispatcher } = await import('../agent/dispatcher.ts')
      const dispatcher = new AgentDispatcher({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        baseUrl: 'http://127.0.0.1:8080',
        maxTokens: 4096,
      })
      const agentResult = await dispatcher.dispatch(name, args)
      return {
        tool_use_id: '',
        output: agentResult.error || agentResult.output || '(Agent 执行完成)',
      }
    } catch (e) {
      return { tool_use_id: '', output: `Agent 执行失败: ${(e as Error).message}` }
    }
  }

  return { tool_use_id: '', output: result.error || result.output || '(无输出)' }
}

/**
 * 从 ToolCollection 构建 OpenAI tools 定义
 * 使用 toolCollection 统一管理工具，消除硬编码白名单
 * 使用动态 import 避免与 registry.ts 形成循环依赖
 */
export async function buildToolsFromRegistry(): Promise<ToolDefinition[]> {
  const { toolCollection } = await import('../../main/proxy/tools/toolCollection.ts')
  const tools: ToolDefinition[] = []
  for (const cmd of toolCollection.getAllTools()) {
    tools.push({
      type: 'function',
      function: {
        name: cmd.name,
        description: cmd.description,
        parameters: {
          type: 'object',
          properties: {
            args: { type: 'array', items: { type: 'string' }, description: '命令参数列表' },
          },
        },
      },
    })
  }
  return tools
}

/**
 * OpenAI tool_use 工具调用循环 — 最多 MAX_TOOL_ROUNDS 轮
 * 每轮：LLM 返回 tool_calls → 本地执行 → 结果喂回 → 再问 LLM
 */
export async function sendOpenAIStreamWithTools(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const tools = await buildToolsFromRegistry()
  console.log('[API] Tool mode enabled, tools:', tools.map(t => t.function.name).join(', '))

  let apiMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content,
  }))

  const maxRounds = config.maxToolRounds || MAX_TOOL_ROUNDS
  const maxRepeat = config.maxRepeat || 3
  let repeatCount = 0
  let lastToolSignature = ''

  function toolSignature(tools: ContentBlock[]): string {
    return tools.map(tc => `${tc.name}:${JSON.stringify(tc.input || {})}`).join('|')
  }

  for (let round = 0; round < maxRounds; round++) {
    const raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
    const hasEndpoint = raw.includes('/chat/completions')
    const endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions'
    console.log(`[API] Tool round ${round + 1}/${maxRounds}`, { endpoint, model: config.model, repeatCount })

    const client = axios.create({
      baseURL: raw,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      timeout: 120000,
    })

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      stream: true,
      messages: apiMessages,
      tools,
    }

    const postStart = Date.now()
    console.log(`[API] POST ${endpoint} model=${config.model} stream=${body.stream} timeout=${client.defaults.timeout || 120000}ms`)
    let response
    try {
      response = await Promise.race([
        client.post(endpoint, body, { signal, responseType: 'stream' }).then(r => {
          console.log(`[API] axios resolved, status=${r.status}`)
          return r
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('POST timeout after 120s')), 120000)),
      ])
    } catch (postError) {
      console.error(`[API] POST FAILED after ${Date.now() - postStart}ms:`, postError instanceof Error ? postError.message : String(postError))
      throw postError
    }
    console.log(`[API] POST SUCCEEDED after ${Date.now() - postStart}ms, status=${response.status}, headers=`, JSON.stringify(response.headers).slice(0, 300))

    const httpStream = response.data
    console.log(`[API] response.data type=${typeof httpStream}, constructor=${httpStream?.constructor?.name}, isStream=${typeof httpStream?.on === 'function'}`)
    let buffer = ''
    let fullText = ''
    const toolCalls: ContentBlock[] = []

    const streamDone = new Promise<void>((resolve, reject) => {
      let chunkCount = 0
      let rawBytes = 0
      let sseLines = 0
      let dataLines = 0

      httpStream.on('data', (chunk: Buffer) => {
        chunkCount++
        rawBytes += chunk.length
        if (chunkCount <= 3) {
          // console.log(`[API][STREAM] chunk#${chunkCount} rawHex=${chunk.slice(0, 120).toString('hex')}`)
        }

        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          sseLines++
          if (!line.startsWith('data: ')) continue
          dataLines++
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            // console.log(`[API][STREAM] received [DONE] sseLines=${sseLines} dataLines=${dataLines}`)
            continue
          }
          try {
            const parsed = JSON.parse(raw)
            if (!parsed.choices?.length) {
              // console.log(`[API][STREAM] no choices, event=${parsed?.object || parsed?.event?.type || 'unknown'}`)
              continue
            }
            const delta = parsed.choices[0].delta
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCalls[idx]) {
                  toolCalls[idx] = {
                    type: 'tool_use',
                    id: tc.id || `tc_${Date.now()}_${idx}`,
                    name: tc.function?.name || '',
                    input: {},
                  }
                }
                if (tc.function?.arguments) {
                  try {
                    toolCalls[idx].input = {
                      ...toolCalls[idx].input,
                      ...JSON.parse(tc.function.arguments),
                    }
                  } catch (e) {
                    toolCalls[idx].input = {
                      ...toolCalls[idx].input,
                      raw: tc.function.arguments,
                    }
                  }
                }
              }
            }
            const text = delta?.content || ''
            if (text) {
              fullText += text
              callbacks.onText(text)
            }
            const reasoning = (delta?.reasoning_content || delta?.reasoning || delta?.thinking || '') as string
            if (reasoning && callbacks.onReasoning) {
              callbacks.onReasoning(reasoning)
            }
            if (dataLines <= 3 || text) {
              // console.log(`[API][STREAM] dataLine#${dataLines} textLen=${text.length} finishReason=${delta?.finish_reason || 'null'}`)
            }
          } catch (e) {
            console.error(`[API][STREAM] parse error:`, (e as Error).message, 'raw=', raw.slice(0, 100))
          }
        }
      })

      httpStream.on('end', () => {
        // console.log(`[API][STREAM] END chunkCount=${chunkCount} rawBytes=${rawBytes} sseLines=${sseLines} dataLines=${dataLines} fullTextLen=${fullText.length} toolCalls=${toolCalls.length}`)
        resolve()
      })
      httpStream.on('error', (err) => {
        console.error(`[API][STREAM] ERROR chunkCount=${chunkCount} rawBytes=${rawBytes}:`, err)
        reject(err)
      })
      httpStream.on('close', () => {
        // console.log(`[API][STREAM] CLOSE chunkCount=${chunkCount} rawBytes=${rawBytes}`)
      })
    })

    await streamDone

    if (toolCalls.length === 0) {
      callbacks.onDone(fullText, [])
      return
    }

    for (const tc of toolCalls) {
      callbacks.onToolUse(tc)
    }

    const toolResults: { role: 'tool'; content: string; tool_call_id: string }[] = []
    for (const tc of toolCalls) {
      let args: string[] = []
      if (Array.isArray(tc.input?.args)) {
        args = tc.input.args.map((a: any) => String(a))
      } else if (tc.input?.raw) {
        args = [String(tc.input.raw)]
      } else if (tc.input && typeof tc.input === 'object') {
        args = Object.entries(tc.input).filter(([k]) => k !== 'raw').map(([, v]) => String(v))
      }
      console.log(`[API] Executing tool: /${tc.name}`, { args, input: JSON.stringify(tc.input).slice(0, 50) })
      const result = await executeLocalTool(tc.name, args)
      toolResults.push({ role: 'tool', content: result.output, tool_call_id: tc.id || '' })
    }

    const currentSignature = toolSignature(toolCalls)
    if (currentSignature && currentSignature === lastToolSignature) {
      repeatCount++
      console.log(`[API] Repeat detected (${repeatCount}/${maxRepeat}): ${currentSignature.slice(0, 80)}`)
      if (repeatCount >= maxRepeat) {
        callbacks.onDone(`(检测到工具调用重复循环，已停止。重复次数: ${repeatCount})`, [])
        return
      }
    } else {
      repeatCount = 0
    }
    lastToolSignature = currentSignature

    apiMessages.push({ role: 'assistant', content: fullText || null, tool_calls: toolCalls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name || '', arguments: JSON.stringify(tc.input || {}) },
    })) })
    for (const tr of toolResults) {
      apiMessages.push({ role: 'tool', content: tr.content, tool_call_id: tr.tool_call_id })
    }
  }

  callbacks.onDone('(工具调用达到最大轮数限制)', [])
}
