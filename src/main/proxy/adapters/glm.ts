/**
 * GLM Adapter
 * Implements GLM (Zhipu Qingyan) web API protocol
 */

import axios, { AxiosResponse } from 'axios'
import crypto from 'crypto'
import { Account, Provider } from '../../store/types'
import { storeManager } from '../../store/store'
import { PassThrough } from 'stream'
import { createParser } from 'eventsource-parser'
import FormData from 'form-data'
import mime from 'mime-types'
import path from 'path'
import { toolsToSystemPrompt, TOOL_WRAP_HINT, hasToolPromptInjected } from '../utils/tools'
import { parseToolCallsFromText } from '../utils/toolParser'
import { 
  createBaseChunk,
} from '../utils/streamToolHandler'
import { getProviderToolProfile } from '../toolCalling/providerProfiles'
import { ToolStreamParser } from '../toolCalling/ToolStreamParser'
import type { ToolCallingPlan } from '../toolCalling/types'

const GLM_API_BASE = 'https://chatglm.cn/chatglm'
const DEFAULT_ASSISTANT_ID = '65940acff94777010aa6b796'
const SIGN_SECRET = '8a1317a7468aa3ad86e997d08f3f31cb'
const ACCESS_TOKEN_EXPIRES = 3600
const FILE_MAX_SIZE = 100 * 1024 * 1024 // 100MB

const FAKE_HEADERS = {
  Accept: 'text/event-stream',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'App-Name': 'chatglm',
  'Cache-Control': 'no-cache',
  'Content-Type': 'application/json',
  Origin: 'https://chatglm.cn',
  Pragma: 'no-cache',
  Priority: 'u=1, i',
  'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-App-Fr': 'browser_extension',
  'X-App-Platform': 'pc',
  'X-App-Version': '0.0.1',
  'X-Device-Brand': '',
  'X-Device-Model': '',
  'X-Lang': 'zh',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
}

interface TokenInfo {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface GLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | any[] | null
  tool_call_id?: string
  tool_calls?: any[]
}

interface ChatCompletionRequest {
  model: string
  originalModel?: string
  messages: GLMMessage[]
  stream?: boolean
  temperature?: number
  web_search?: boolean
  reasoning_effort?: 'low' | 'medium' | 'high'
  deep_research?: boolean
  tools?: any[]
  tool_choice?: any
}

const tokenCache = new Map<string, TokenInfo>()

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex')
}

function generateSign(): { timestamp: string; nonce: string; sign: string } {
  const e = Date.now()
  const A = e.toString()
  const t = A.length
  const o = A.split('').map((c) => Number(c))
  const i = o.reduce((acc, val) => acc + val, 0) - o[t - 2]
  const a = i % 10
  const timestamp = A.substring(0, t - 2) + a + A.substring(t - 1, t)
  const nonce = uuid()
  const sign = md5(`${timestamp}-${nonce}-${SIGN_SECRET}`)
  return { timestamp, nonce, sign }
}

// 会话级文件名缓存：GLM 网页端把上传文件存在私有 source_id 里，后续轮次
// request.messages 不再携带任何字面路径。但首次上传时 glm.ts 已经拿到了
// 本地/URL 的 basename（真实文件名）。把它按 conversationId 缓存，供后续
// 轮次 buildInjectedToolCall 兜底注入 Read 时使用（文件名"已缓存"的来源）。
const glmUploadedFileNames = new Map<string, string>()

export class GLMAdapter {
  private provider: Provider
  private account: Account

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
  }

  private getRefreshToken(): string {
    const credentials = this.account.credentials
    return credentials.refresh_token || credentials.token || ''
  }

  private async acquireToken(): Promise<string> {
    const refreshToken = this.getRefreshToken()
    const cached = tokenCache.get(refreshToken)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.accessToken
    }

    console.log('[GLM] Refreshing Token...')
    const sign = generateSign()
    const response = await axios.post(
      `${GLM_API_BASE}/user-api/user/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          ...FAKE_HEADERS,
          'X-Device-Id': uuid(),
          'X-Nonce': sign.nonce,
          'X-Request-Id': uuid(),
          'X-Sign': sign.sign,
          'X-Timestamp': sign.timestamp,
        },
        timeout: 15000,
        validateStatus: () => true,
      }
    )

    console.log('[GLM] Token response:', JSON.stringify(response.data, null, 2))
    const { code, status, message } = response.data || {}
    const isSuccess = code === 0 || status === 0
    if (response.status !== 200 || !isSuccess) {
      const errorMsg = message || `HTTP ${response.status}`
      throw new Error(`Token 刷新失败：${errorMsg}`)
    }

    const { access_token, refresh_token } = response.data.result
    const tokenInfo: TokenInfo = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRES * 1000,
    }
    tokenCache.set(refreshToken, tokenInfo)

    if (refresh_token !== refreshToken) {
      console.log('[GLM] Token updated, saving new token')
      const decryptedCredentials = {
        refresh_token,
      }
      await storeManager.updateAccount(this.account.id, {
        credentials: decryptedCredentials,
      })
    }

    console.log('[GLM] Token refresh successful')
    return access_token
  }

  /**
   * Check if URL is base64 data
   */
  private isBase64Data(url: string): boolean {
    return url.startsWith('data:')
  }

  /**
   * Extract MIME type from base64 data URL
   */
  private extractBase64Format(url: string): string {
    const match = url.match(/^data:([^;]+);/)
    return match ? match[1] : 'application/octet-stream'
  }

  /**
   * Remove base64 data header
   */
  private removeBase64Header(url: string): string {
    return url.replace(/^data:[^;]+;base64,/, '')
  }

  /**
   * Upload file to GLM
   */
  private async uploadFile(fileUrl: string): Promise<{ source_id: string; file_url?: string }> {
    console.log('[GLM] Uploading file:', fileUrl.substring(0, 50) + '...')
    
    let filename: string
    let fileData: Buffer
    let mimeType: string

    if (this.isBase64Data(fileUrl)) {
      mimeType = this.extractBase64Format(fileUrl)
      const ext = mime.extension(mimeType) || 'bin'
      filename = `${uuid()}.${ext}`
      fileData = Buffer.from(this.removeBase64Header(fileUrl), 'base64')
    } else {
      filename = path.basename(fileUrl.split('?')[0])
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        maxContentLength: FILE_MAX_SIZE,
        timeout: 60000,
      })
      fileData = Buffer.from(response.data)
      mimeType = response.headers['content-type'] || mime.lookup(filename) || 'application/octet-stream'
    }

    const formData = new FormData()
    formData.append('file', fileData, {
      filename,
      contentType: mimeType,
    })

    const token = await this.acquireToken()
    const response = await axios.post(
      `${GLM_API_BASE}/backend-api/assistant/file_upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Referer: 'https://chatglm.cn/',
          ...FAKE_HEADERS,
          ...formData.getHeaders(),
        },
        maxBodyLength: FILE_MAX_SIZE,
        timeout: 60000,
        validateStatus: () => true,
      }
    )

    if (response.status !== 200 || !response.data?.result) {
      throw new Error(`文件上传失败：HTTP ${response.status}`)
    }

    console.log('[GLM] File uploaded successfully:', response.data.result.source_id)
    return response.data.result
  }

  /**
   * Extract file URLs from message content
   */
  private extractFileUrls(messages: GLMMessage[]): { fileUrls: string[]; imageUrls: string[] } {
    const fileUrls: string[] = []
    const imageUrls: string[] = []

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            imageUrls.push(part.image_url.url)
          } else if (part.type === 'file' && part.file_url?.url) {
            fileUrls.push(part.file_url.url)
          }
        }
      }
    }

    return { fileUrls, imageUrls }
  }

  private messagesToPrompt(messages: GLMMessage[], refs: any[] = [], toolsPrompt?: string, isMultiTurn: boolean = false): { role: string; content: any[] }[] {
    const toolProfile = getProviderToolProfile('glm')
    // Separate image refs and file refs
    const imageRefs = refs.filter((ref) => ref.width !== undefined || ref.height !== undefined || ref.image_url)
    const fileRefs = refs.filter((ref) => !ref.width && !ref.height && !ref.image_url)

    // Build content array
    const content: any[] = []

    // Add file references first
    if (fileRefs.length > 0) {
      content.push({
        type: 'file',
        file: fileRefs.map((ref) => ({
          source_id: ref.source_id,
          file_url: ref.file_url,
        })),
      })
    }

    // Add image references
    for (const imageRef of imageRefs) {
      content.push({
        type: 'image_url',
        image_url: {
          url: imageRef.image_url || imageRef.source_id,
        },
      })
    }

    // Process messages including tool calls and tool responses
    const processedMessages = messages.map(msg => {
      // Handle tool calls in assistant message
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          ...msg,
          content: toolProfile.formatAssistantToolCalls(msg.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }))),
        }
      }
      // Handle tool response message
      if (msg.role === 'tool' && msg.tool_call_id) {
        return { 
          ...msg, 
          role: 'user' as const,
          content: toolProfile.formatToolResult({
            toolCallId: msg.tool_call_id,
            content: String(msg.content || ''),
          }),
        }
      }
      return msg
    })

    // For multi-turn mode, only send the last user message
    if (isMultiTurn) {
      let lastUserIdx = -1
      for (let i = processedMessages.length - 1; i >= 0; i--) {
        if (processedMessages[i].role === 'user') {
          lastUserIdx = i
          break
        }
      }
      
      if (lastUserIdx !== -1) {
        const lastUserMsg = processedMessages[lastUserIdx]
        let textContent = ''
        if (typeof lastUserMsg.content === 'string') {
          textContent = lastUserMsg.content
        } else if (Array.isArray(lastUserMsg.content)) {
          textContent = lastUserMsg.content.filter((c) => c.type === 'text').map((c) => c.text).join('')
        }
        
        // Include any tool results after the last user message
        for (let i = lastUserIdx + 1; i < processedMessages.length; i++) {
          if (processedMessages[i].role === 'user') {
            const toolText = typeof processedMessages[i].content === 'string' 
              ? processedMessages[i].content 
              : ''
            textContent += '\n' + toolText
          }
        }
        
        if (toolsPrompt) {
          textContent = textContent.trim() + "\n\n" + toolsPrompt
        }
        
        content.push({ type: 'text', text: textContent })
        return [{ role: 'user', content }]
      }
    }

    // Extract text from messages
    if (processedMessages.length < 2) {
      let textContent = processedMessages.reduce((acc, msg) => {
        if (typeof msg.content === 'string') {
          return acc + msg.content + '\n'
        } else if (Array.isArray(msg.content)) {
          const textParts = msg.content.filter((c) => c.type === 'text').map((c) => c.text)
          return acc + textParts.join('') + '\n'
        }
        return acc
      }, '')

      // Inject tools prompt at the VERY END
      if (toolsPrompt) {
        textContent = textContent.trim() + "\n\n" + toolsPrompt
      }

      content.push({ type: 'text', text: textContent })
      return [{ role: 'user', content }]
    }

    let textContent = processedMessages.reduce((acc, msg) => {
      const role = msg.role
        .replace('system', 'System')
        .replace('assistant', 'Assistant')
        .replace('user', 'User')
        .replace('tool', 'User')
      if (typeof msg.content === 'string') {
        return acc + `${role}: ${msg.content}\n\n`
      } else if (Array.isArray(msg.content)) {
        const text = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('')
        return acc + `${role}: ${text}\n\n`
      }
      return acc
    }, '')

    // Inject tools prompt at the VERY END
    if (toolsPrompt) {
      textContent = textContent.trim() + "\n\n" + toolsPrompt
    }

    content.push({ type: 'text', text: textContent + 'Assistant: ' })
    return [{ role: 'user', content }]
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<{ response: AxiosResponse; conversationId: string }> {
    const token = await this.acquireToken()
    const sign = generateSign()

    // Clone messages to avoid modifying original request
    const messages = [...request.messages]

    // Check if tool prompt has already been injected by client
    const toolPromptExists = hasToolPromptInjected(messages)

    // Inject tools definition into prompt if tools are provided and not already injected
    let toolsPrompt = ''
    if (request.tools && request.tools.length > 0 && !toolPromptExists) {
      const glmStrictHint = `

GLM STRICT RULES:
- If user asks to create/modify code or files, you MUST call tools instead of replying with plain text.
- You MUST output ONLY one [function_calls] block when calling tools.
- Use exact tool names from list, case-sensitive, do not rename.`
      toolsPrompt = toolsToSystemPrompt(request.tools) + glmStrictHint

      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          const currentContent = messages[i].content
          if (typeof currentContent === 'string') {
            messages[i] = { ...messages[i], content: currentContent + TOOL_WRAP_HINT }
          } else if (Array.isArray(currentContent)) {
            messages[i] = {
              ...messages[i],
              content: [...currentContent, { type: 'text', text: TOOL_WRAP_HINT }],
            }
          }
          break
        }
      }
    }

    // Extract and upload files
    const { fileUrls, imageUrls } = this.extractFileUrls(messages)
    const refs: any[] = []

    // Upload files
    for (const fileUrl of fileUrls) {
      try {
        const result = await this.uploadFile(fileUrl)
        // 记录上传文件的真实文件名（basename），供后续轮次 buildInjectedToolCall
        // 兜底注入 Read 使用：GLM 网页端把文件存在私有 source_id，后续轮次的
        // request.messages 不再携带字面路径，但文件名已在首次上传时拿到。
        const baseName = path.basename(String(fileUrl).split('?')[0])
        if (baseName) glmUploadedFileNames.set('__last__', baseName)
        refs.push({
          source_id: result.source_id,
          file_url: result.file_url || fileUrl,
        })
      } catch (error) {
        console.error('[GLM] Failed to upload file:', error)
      }
    }

    // Upload images
    for (const imageUrl of imageUrls) {
      try {
        const result = await this.uploadFile(imageUrl)
        refs.push({
          source_id: result.source_id,
          image_url: result.file_url || imageUrl,
          width: 0,
          height: 0,
        })
      } catch (error) {
        console.error('[GLM] Failed to upload image:', error)
      }
    }

    const preparedMessages = this.messagesToPrompt(messages, refs, toolsPrompt, false)

    let assistantId = DEFAULT_ASSISTANT_ID
    let chatMode = ''
    let isNetworking = false

    // Use request parameters for mode control (OpenAI compatible)
    if (request.reasoning_effort) {
      chatMode = 'zero'
      console.log('[GLM] Using reasoning mode, effort:', request.reasoning_effort)
    }
    
    if (request.web_search) {
      isNetworking = true
      console.log('[GLM] Web search enabled')
    }
    
    if (request.deep_research) {
      chatMode = 'deep_research'
      console.log('[GLM] Using deep research mode')
    }

    // Fallback: check model name for backward compatibility
    // Use originalModel for feature detection (preserves user's intent before mapping)
    const modelForDetection = request.originalModel || request.model
    const modelLower = modelForDetection.toLowerCase()
    if (!chatMode && (modelLower.includes('think') || modelLower.includes('zero'))) {
      chatMode = 'zero'
      console.log('[GLM] Using reasoning mode (from model name)')
    }
    if (!chatMode && modelLower.includes('deepresearch')) {
      chatMode = 'deep_research'
      console.log('[GLM] Using deep research mode (from model name)')
    }
    
    // Check if model is an assistant ID (24+ alphanumeric characters)
    if (/^[a-z0-9]{24,}$/.test(request.model)) {
      assistantId = request.model
    }

    console.log('[GLM] Sending chat request...')
    
    const response = await axios.post(
      `${GLM_API_BASE}/backend-api/assistant/stream`,
      {
        assistant_id: assistantId,
        conversation_id: '',
        project_id: '',
        chat_type: 'user_chat',
        messages: preparedMessages,
        meta_data: {
          channel: '',
          chat_mode: chatMode || undefined,
          draft_id: '',
          if_plus_model: true,
          input_question_type: 'xxxx',
          is_networking: isNetworking,
          is_test: false,
          platform: 'pc',
          quote_log_id: '',
          cogview: {
            rm_label_watermark: false,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...FAKE_HEADERS,
          'X-Device-Id': uuid(),
          'X-Request-Id': uuid(),
          'X-Sign': sign.sign,
          'X-Timestamp': sign.timestamp,
          'X-Nonce': sign.nonce,
        },
        timeout: 120000,
        validateStatus: () => true,
        responseType: 'stream',
      }
    )

    return { response, conversationId: '' }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const token = await this.acquireToken()
      const sign = generateSign()
      await axios.post(
        `${GLM_API_BASE}/backend-api/assistant/conversation/delete`,
        {
          assistant_id: DEFAULT_ASSISTANT_ID,
          conversation_id: conversationId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Referer: 'https://chatglm.cn/main/alltoolsdetail',
            'X-Device-Id': uuid(),
            'X-Request-Id': uuid(),
            'X-Sign': sign.sign,
            'X-Timestamp': sign.timestamp,
            'X-Nonce': sign.nonce,
            ...FAKE_HEADERS,
          },
          timeout: 15000,
          validateStatus: () => true,
        }
      )
      console.log('[GLM] Conversation deleted:', conversationId)
      return true
    } catch (error) {
      console.error('[GLM] Failed to delete conversation:', error)
      return false
    }
  }

  async deleteAllChats(): Promise<boolean> {
    try {
      const token = await this.acquireToken()

      // Step 1: Get all conversations (handle pagination)
      const allConversationIds: string[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const sign = generateSign()
        const listResponse = await axios.post(
          `${GLM_API_BASE}/mainchat-api/conversation/recent_list`,
          { page, page_size: 100 },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Referer: 'https://chatglm.cn/main/alltoolsdetail',
              'X-Device-Id': uuid(),
              'X-Request-Id': uuid(),
              'X-Sign': sign.sign,
              'X-Timestamp': sign.timestamp,
              'X-Nonce': sign.nonce,
              ...FAKE_HEADERS,
            },
            timeout: 30000,
            validateStatus: () => true,
          }
        )

        console.log('[GLM] Get conversation list page', page, 'response:', JSON.stringify(listResponse.data, null, 2))

        const { status, result } = listResponse.data || {}
        if (listResponse.status !== 200 || status !== 0) {
          console.error('[GLM] Failed to get conversation list')
          return false
        }

        const conversationList = result?.conversation_list || []
        for (const c of conversationList) {
          allConversationIds.push(c.conversation_id)
        }

        hasMore = result?.has_more || false
        page++

        if (conversationList.length === 0) {
          break
        }
      }

      if (allConversationIds.length === 0) {
        console.log('[GLM] No conversations to delete')
        return true
      }

      console.log('[GLM] Found', allConversationIds.length, 'conversations to delete')

      // Step 2: Bulk delete conversations
      const sign = generateSign()
      const deleteResponse = await axios.post(
        `${GLM_API_BASE}/mainchat-api/conversation/bulk_delete`,
        { conversation_ids: allConversationIds },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Referer: 'https://chatglm.cn/main/alltoolsdetail',
            'X-Device-Id': uuid(),
            'X-Request-Id': uuid(),
            'X-Sign': sign.sign,
            'X-Timestamp': sign.timestamp,
            'X-Nonce': sign.nonce,
            ...FAKE_HEADERS,
          },
          timeout: 60000,
          validateStatus: () => true,
        }
      )

      console.log('[GLM] Bulk delete response:', JSON.stringify(deleteResponse.data, null, 2))

      const deleteResult = deleteResponse.data || {}
      const success = deleteResponse.status === 200 && deleteResult.status === 0
      if (success) {
        console.log('[GLM] All chats deleted')
      }
      return success
    } catch (error) {
      console.error('[GLM] Failed to delete all chats:', error)
      return false
    }
  }

  static isGLMProvider(provider: Provider): boolean {
    return provider.id === 'glm' || provider.apiEndpoint.includes('chatglm.cn')
  }
}

export class GLMStreamHandler {
  private conversationId: string = ''
  private model: string
  private created: number
  private onEnd?: any
  private toolStreamParser?: ToolStreamParser | null
  private toolCallingPlan?: ToolCallingPlan
  private userPrompt: string = ''
  // 用户消息里附带/上传的文件名（从 request.messages 提取，与 chatCompletion
  // 的 extractFileUrls 同源）。当 buildInjectedToolCall 的三条正则（动词/路径兜底）
  // 都因"用户只说'分析这个文件'而无字面路径"而落空时，作为最后兜底，注入一个
  // Read 该文件的工具调用，保证客户端至少拿到工具而非空 stop。
  private lastFileName: string = ''
  private injectedTool: boolean = false
  // GLM 网页版"想调用工具但没真调出来"的标志：原始 part 里出现 "tool_calls":{}
  // 空对象（而非正常的 tool_calls 数组）。forwarder 据此无条件重发，不依赖 10 秒窗口。
  public emptyToolCallsDetected: boolean = false
  // 真正重发回调：由 forwarder 注入。当 emptyToolCallsDetected 且未产出工具时，
  // 在 close 阶段调用它执行"把最后一条用户消息重发给网页版"（forwarder 持有
  // adapter/request，能真正发起新请求）。glm.ts 自身只负责检测与兜底注入，
  // 重发能力下沉到 forwarder，避免循环依赖。已在构造时通过 retryCount 防死循环。
  private retryCallback?: (clientStream: any) => void
  public alreadyRetried: boolean = false

  // 相同命令行在短时间窗口内只注入发送一次，避免重复打爆后端服务器。
  // 存于内存（进程级），重启代理即清空，不持久化。
  private static readonly TOOL_DEDUP_WINDOW_MS = 3 * 60 * 1000
  private static injectedToolFingerprints = new Map<string, number>()

  private static toolFingerprint(name: string, args: Record<string, unknown>): string {
    return name + ':' + JSON.stringify(args)
  }

  private static isToolRecentlyInjected(fp: string): boolean {
    const last = GLMStreamHandler.injectedToolFingerprints.get(fp) ?? 0
    const now = Date.now()
    if (last !== 0 && now - last < GLMStreamHandler.TOOL_DEDUP_WINDOW_MS) {
      return true
    }
    if (GLMStreamHandler.injectedToolFingerprints.size > 200) {
      for (const [k, v] of GLMStreamHandler.injectedToolFingerprints) {
        if (now - v >= GLMStreamHandler.TOOL_DEDUP_WINDOW_MS) {
          GLMStreamHandler.injectedToolFingerprints.delete(k)
        }
      }
    }
    return false
  }

  private static markToolInjected(fp: string): void {
    GLMStreamHandler.injectedToolFingerprints.set(fp, Date.now())
  }

  constructor(
    model: string,
    onEnd?: any,
    initialConversationId?: string,
    toolCallingPlan?: ToolCallingPlan,
    userPrompt?: string,
    retryCallback?: (clientStream: any) => void,
    lastFileName?: string,
  ) {
    this.model = model
    this.created = Math.floor(Date.now() / 1000)
    this.onEnd = onEnd
    this.toolCallingPlan = toolCallingPlan
    this.toolStreamParser = toolCallingPlan?.shouldParseResponse ? new ToolStreamParser(toolCallingPlan) : null
    this.userPrompt = userPrompt || ''
    this.lastFileName = lastFileName || ''
    this.retryCallback = retryCallback
    if (initialConversationId) {
      this.conversationId = initialConversationId
    }
  }

  private buildInjectedToolCall(): any {
    const prompt = this.userPrompt.toLowerCase()
    if (!prompt) return null
    // 仅在"动作动词出现在句首/句界"（前一个回车或标点之后）才触发注入，
    // 排除正文中提及关键词（如"分析 src/ 里的代码"）的误触发。
    // 锚定：(字符串开头 | 换行 | 中文/英文标点) 后紧跟动词。
    const actionBoundary = /(?:^|[\n。；;!?！？，,、\s])/

    // 列目录/查看目录：动词需在句界后
    if (new RegExp(actionBoundary.source + '(列出|列目录|查看目录|目录结构|list\\s+(dir|directory)|\\bls\\b)', 'i').test(prompt)) {
      const dirMatch = prompt.match(/(?:^|[\n。；;!?！？，,、\s])(?:列出|查看|list)\s+([^\s，。、；,.:!?]+)/)
      let target = '.'
      if (dirMatch) {
        target = dirMatch[1].replace(/[，。、；,.:!?].*$/, '').trim()
      }
      const bashArgs = { command: 'ls -la ' + target }
      const bashFp = GLMStreamHandler.toolFingerprint('bash', bashArgs)
      if (GLMStreamHandler.isToolRecentlyInjected(bashFp)) return null
      GLMStreamHandler.markToolInjected(bashFp)
      console.log(`[INJECT-TOOL] 代理自行生成工具(去重通过): name=bash args=${JSON.stringify(bashArgs)}`)
      return { name: 'bash', arguments: bashArgs }
    }
    // 读取文件：动词需在句界后（放宽白名单：分析/打开/检查/找/搜索 也视为读文件意图）
    const readMatch = prompt.match(/(?:^|[\n。；;!?！？，,、\s])(?:读取|查看|读|分析|打开|检查|找|搜索|读取并分析)\s+([^\s，。、；,.:!?]+\.[a-z0-9]+)/)
    if (readMatch) {
      const readArgs = { path: readMatch[1] }
      const readFp = GLMStreamHandler.toolFingerprint('cat', readArgs)
      if (GLMStreamHandler.isToolRecentlyInjected(readFp)) return null
      GLMStreamHandler.markToolInjected(readFp)
      console.log(`[INJECT-TOOL] 代理自行生成工具(去重通过): name=cat args=${JSON.stringify(readArgs)}`)
      return { name: 'cat', arguments: readArgs }
    }
    // 路径兜底：用户消息里直接含"盘符路径/文件名.后缀"（如 D:\xxx\a.ts、./src/x.js、/tmp/y.py），
    // 无论动词为何，都注入 cat 读取该文件。覆盖"分析这个文件""看下 a.ts"等未命中动词的场景。
    const pathMatch = prompt.match(/(?:[A-Za-z]:[\\/]|[.\\/])[^\s，。、；,.:!?|<>"']+\.[a-z0-9]{1,12}/)
    if (pathMatch) {
      const readArgs = { path: pathMatch[0] }
      const readFp = GLMStreamHandler.toolFingerprint('cat', readArgs)
      if (GLMStreamHandler.isToolRecentlyInjected(readFp)) return null
      GLMStreamHandler.markToolInjected(readFp)
      console.log(`[INJECT-TOOL] 代理兜底生成工具(路径命中): name=cat args=${JSON.stringify(readArgs)}`)
      return { name: 'cat', arguments: readArgs }
    }
    // 解析"本对话应读取的文件名"：优先用 forwarder 从 request.messages 提取的
    // 字面路径（lastFileName）；若为空，则回退到 GLM 上传文件时按会话缓存的
    // 真实文件名（glmUploadedFileNames）。GLM 网页端把文件存在私有 source_id，
    // 后续轮次 request.messages 不再携带字面路径，但文件名已在首次上传时缓存。
    const cachedFileName =
      this.lastFileName || (glmUploadedFileNames.get('__last__') as string) || ''
    // 意图短语兜底：用户明确表达"分析/读/看这个文件"的意图，且本对话确实带了文件
    // （cachedFileName 非空），则无条件注入 cat 该文件——不再要求动词后紧跟 xxx.后缀，
    // 也不再依赖 request.messages 里的字面路径。覆盖 GLM 网页版 "tool_calls":{} 空工具
    // 信号（emptyToolCallsDetected）下"我想读文件但没产出工具"的场景，保证客户端
    // 至少拿到工具而非空 stop。
    if (cachedFileName && /(?:分析|读取|读|打开|查看|检查|看|处理|修改|修复)\s*(?:这|该|上传的|这个)?\s*文件/.test(prompt)) {
      const readArgs = { path: cachedFileName }
      const readFp = GLMStreamHandler.toolFingerprint('cat', readArgs)
      if (GLMStreamHandler.isToolRecentlyInjected(readFp)) return null
      GLMStreamHandler.markToolInjected(readFp)
      console.log(`[INJECT-TOOL] 代理兜底生成工具(意图短语命中 fileName=${cachedFileName}): name=cat args=${JSON.stringify(readArgs)}`)
      return { name: 'cat', arguments: readArgs }
    }
    // 文件名兜底：本对话确实带了文件（cachedFileName 非空），且 GLM 已明确"应当调用
    // 工具但未产出"（emptyToolCallsDetected），则强制注入一个 Read 该文件的工具调用，
    // 保证客户端至少拿到工具而非空 stop。仅在已声明要读文件但未产出时触发，避免对
    // 普通闲聊误注入。
    if (cachedFileName && this.emptyToolCallsDetected) {
      const readArgs = { path: cachedFileName }
      const readFp = GLMStreamHandler.toolFingerprint('cat', readArgs)
      if (GLMStreamHandler.isToolRecentlyInjected(readFp)) return null
      GLMStreamHandler.markToolInjected(readFp)
      console.log(`[INJECT-TOOL] 代理兜底生成工具(空工具+文件名命中 fileName=${cachedFileName}): name=cat args=${JSON.stringify(readArgs)}`)
      return { name: 'cat', arguments: readArgs }
    }
    return null
  }

  async handleStream(stream: any): Promise<PassThrough> {
    const transStream = new PassThrough()
    const cachedParts: any[] = []
    let sentContent = ''
    let sentReasoning = ''
    let sentRole = false

    transStream.write(
      `data: ${JSON.stringify({
        id: '',
        model: this.model,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
        created: this.created,
      })}\n\n`
    )

    const parser = createParser({
      onEvent: (event: any) => {
        try {
          const result = JSON.parse(event.data)

          if (!this.conversationId && result.conversation_id) {
            this.conversationId = result.conversation_id
          }

          // 检测 GLM 网页版"空工具对象"信号：原始 part 里出现 "tool_calls":{}
          // （空对象，而非正常的 tool_calls 数组）。这是"应当调用工具但未产出"
          // 的明确标志，forwarder 据此无条件重发，不受 10 秒窗口限制。
          if (result.parts && Array.isArray(result.parts)) {
            for (const part of result.parts) {
              const content = part?.content
              if (!Array.isArray(content)) continue
              for (const item of content) {
                const tc = item?.tool_calls
                // 空对象 {}（且不是数组、不是非空对象）即视为"空工具"
                if (tc && typeof tc === 'object' && !Array.isArray(tc) && Object.keys(tc).length === 0) {
                  this.emptyToolCallsDetected = true
                  break
                }
              }
              if (this.emptyToolCallsDetected) break
            }
          }

          if (result.status !== 'finish' && result.status !== 'intervene') {
            if (result.parts) {
              result.parts.forEach((part: any) => {
                const index = cachedParts.findIndex((p) => p.logic_id === part.logic_id)
                if (index !== -1) {
                  cachedParts[index] = part
                } else {
                  cachedParts.push(part)
                }
              })
            }

            const searchMap = new Map<string, any>()
            cachedParts.forEach((part) => {
              if (!part.content || !Array.isArray(part.content)) return
              const { meta_data } = part
              part.content.forEach((item: any) => {
                if (item.type === 'tool_result' && meta_data?.tool_result_extra?.search_results) {
                  meta_data.tool_result_extra.search_results.forEach((res: any) => {
                    if (res.match_key) {
                      searchMap.set(res.match_key, res)
                    }
                  })
                }
              })
            })

            const keyToIdMap = new Map<string, number>()
            let counter = 1
            let fullText = ''
            let fullReasoning = ''

            cachedParts.forEach((part) => {
              const { content, meta_data } = part
              if (!Array.isArray(content)) return

              let partText = ''
              let partReasoning = ''

              content.forEach((value: any) => {
                const { type, text, think, image, code, content: innerContent } = value

                if (type === 'text') {
                  let txt = text
                  if (searchMap.size > 0) {
                    txt = txt.replace(/【?(turn\d+[a-zA-Z]+\d+)】?/g, (match: string, key: string) => {
                      const searchInfo = searchMap.get(key)
                      if (!searchInfo) return match
                      if (!keyToIdMap.has(key)) {
                        keyToIdMap.set(key, counter++)
                      }
                      return ` [${keyToIdMap.get(key)}](${searchInfo.url})`
                    })
                  }
                  partText += txt
                } else if (type === 'think') {
                  partReasoning += think
                } else if (type === 'image' && Array.isArray(image) && part.status === 'finish') {
                  const imageText =
                    image.reduce((imgs: string, v: any) => {
                      return imgs + (/^(http|https):\/\//.test(v.image_url) ? `![image](${v.image_url})` : '')
                    }, '') + '\n'
                  partText += imageText
                } else if (type === 'code') {
                  partText += '```python\n' + code + (part.status === 'finish' ? '\n```\n' : '')
                } else if (type === 'execution_output' && typeof innerContent === 'string' && part.status === 'finish') {
                  partText += innerContent + '\n'
                }
              })

              if (partText) fullText += (fullText.length > 0 ? '\n' : '') + partText
              if (partReasoning) fullReasoning += (fullReasoning.length > 0 ? '\n' : '') + partReasoning
            })

            const reasoningChunk = fullReasoning.substring(sentReasoning.length)
            if (reasoningChunk) {
              sentReasoning += reasoningChunk
              transStream.write(
                `data: ${JSON.stringify({
                  id: this.conversationId,
                  model: this.model,
                  object: 'chat.completion.chunk',
                  choices: [{ index: 0, delta: { reasoning_content: reasoningChunk }, finish_reason: null }],
                  created: this.created,
                })}\n\n`
              )
            }

            const chunk = fullText.substring(sentContent.length)
            if (chunk) {
              sentContent += chunk
            }
            
            // Process tool call interception with shared parser buffering.
            const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)
            const outputChunks = this.toolStreamParser?.push(chunk, baseChunk, !sentRole) ?? (
              chunk ? [{
                ...baseChunk,
                choices: [{ index: 0, delta: { ...(!sentRole ? { role: 'assistant' } : {}), content: chunk }, finish_reason: null }],
              }] : []
            )

            for (const outChunk of outputChunks) {
              transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
            }

            if (outputChunks.length > 0) sentRole = true
          } else {
            // [status === 'finish' / 'intervene']
            // 注意：GLM 网页版在 'finish' 之后仍可能继续推送内容（例如工具调用的
            // <tool_call> 正文），因此此处【绝不能】结束转换流或发送 [DONE]。
            // 只能 flush 工具调用缓冲，把已经解析出的 tool_calls delta 正常写出。
            // 真正的流结束与 [DONE] 只在 stream 'close' 事件中统一处理一次。

            // BUG 修复：finish 事件本身也可能直接携带完整 parts（如 GLM 一次性返回
            // "我来分析这个文件..." 文本 + 空 tool_calls），而上方 `result.status !== 'finish'`
            // 的 if 分支不会 push 这类 parts，导致正文被静默丢弃。下游 forwarder 依赖
            // 缓冲流中是否出现 `"content":"..."` 来判定"快速空响应"并重发，正文丢失会让
            // hasContent=false → 不触发重发 → 客户端看到"毛都没有"。
            // 此处补做 parts 累积 + 最新正文增量写出（与上方非 finish 分支对称）。
            if (result.parts && Array.isArray(result.parts)) {
              result.parts.forEach((part: any) => {
                const index = cachedParts.findIndex((p: any) => p.logic_id === part.logic_id)
                if (index !== -1) {
                  cachedParts[index] = part
                } else {
                  cachedParts.push(part)
                }
              })
            }
            // 重算累积正文并写出增量（仅在尚未输出过该部分时）
            let fullText = ''
            cachedParts.forEach((part: any) => {
              const { content } = part
              if (!Array.isArray(content)) return
              content.forEach((value: any) => {
                if (value.type === 'text') fullText += value.text || ''
              })
            })
            const chunk = fullText.substring(sentContent.length)
            if (chunk) {
              sentContent += chunk
              sentRole = true
              transStream.write(
                `data: ${JSON.stringify({
                  id: this.conversationId,
                  model: this.model,
                  object: 'chat.completion.chunk',
                  choices: [{
                    index: 0,
                    delta: { ...(!sentRole ? { role: 'assistant' } : {}), content: chunk },
                    finish_reason: null,
                  }],
                  created: this.created,
                })}\n\n`
              )
            }

            const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)
            const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []
            for (const outChunk of flushChunks) {
              transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
            }
            // 'intervene' 可能携带提示文本，照常透传给客户端（不结束流）。
            if (result.status === 'intervene' && result.last_error?.intervene_text) {
              transStream.write(
                `data: ${JSON.stringify({
                  id: this.conversationId,
                  model: this.model,
                  object: 'chat.completion.chunk',
                  choices: [
                    {
                      index: 0,
                      delta: { content: '\n\n' + result.last_error.intervene_text },
                      finish_reason: null,
                    },
                  ],
                  created: this.created,
                })}\n\n`
              )
            }
          }
        } catch (err) {
          console.error('[GLM] Stream parse error:', err)
        }
      },
    })

    const decoder = new TextDecoder('utf-8')
    stream.on('data', (buffer: Buffer) => parser.feed(decoder.decode(buffer, { stream: true })))

    // Handle stream errors - ensure proper cleanup
    stream.once('error', (err: Error) => {
      console.error(`[GLM] 流异常停止(error): ${err.message}`)
      // 若 close 已处理过收口则跳过，避免重复 [DONE]（error 后通常还会触发 close）
      if (transStream.closed) {
        console.log(`[GLM] 异常但已由 close 收口，忽略 error 收口`)
        return
      }
      // Flush any remaining tool call buffer
      const flushChunks =
        this.toolStreamParser?.flush(createBaseChunk(this.conversationId, this.model, this.created)) ?? []
      for (const outChunk of flushChunks) {
        transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
      }
      const emittedErr = this.toolStreamParser?.hasEmittedToolCall() ?? false
      const injectedErr = !emittedErr && !this.injectedTool ? this.buildInjectedToolCall() : null
      if (injectedErr) {
        this.injectedTool = true
        const callId = 'call_' + this.conversationId + '_inject_err'
        transStream.write(
          `data: ${JSON.stringify({
            id: this.conversationId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: {
                role: 'assistant',
                content: '',
                tool_calls: [{
                  index: 0,
                  id: callId,
                  type: 'function',
                  function: { name: injectedErr.name, arguments: JSON.stringify(injectedErr.arguments) },
                }],
              },
              finish_reason: null,
            }],
            created: this.created,
          })}\n\n`
        )
        transStream.write(
          `data: ${JSON.stringify({
            id: this.conversationId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { finish_reason: 'tool_calls' }, finish_reason: 'tool_calls' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            created: this.created,
          })}\n\n`
        )
        transStream.end('data: [DONE]\n\n')
        this.onEnd?.()
        return
      }
      const finishReason = emittedErr ? 'tool_calls' : 'stop'
      transStream.write(
        `data: ${JSON.stringify({
          id: this.conversationId,
          model: this.model,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
          created: this.created,
        })}\n\n`
      )
      transStream.end('data: [DONE]\n\n')
      this.onEnd?.()
    })

    // Handle stream close - 源流真正结束后统一收口，此处只触发一次。
    // 所有 [DONE] / tool_calls 注入都只能在这里发，绝不在 'finish' 事件中发，
    // 否则 GLM 在 'finish' 之后补推的工具内容会被提前关闭的流丢弃。
    stream.once('close', () => {
      const emittedClose = this.toolStreamParser?.hasEmittedToolCall() ?? false
      // GLM 网页版已用 "tool_calls":{} 明确告知"本应调用工具但未产出"时，
      // 即使首次 buildInjectedToolCall 因动词/路径未命中而返回 null，也必须
      // 再强制尝试一次注入（buildInjectedToolCall 已放宽动词+路径兜底），
      // 保证客户端至少拿到一个工具调用，而非空 stop。这与 forwarder 的重发
      // 判定互补：forwarder 负责"真正重发请求"，此处负责"兜底模拟工具包"。
      // GLM 明确 "tool_calls":{}（emptyToolCallsDetected）时，无条件尝试兜底注入，
      // 不再要求"首次 buildInjectedToolCall 因动词/路径未命中而返回 null"这一前置
      // （实际 buildInjectedToolCall 已内置"空工具+文件名"强制兜底分支，此处直接调即可）。
      let injectedClose = (!emittedClose && !this.injectedTool) || (this.emptyToolCallsDetected && !this.injectedTool)
        ? this.buildInjectedToolCall()
        : null
      if (transStream.closed) {
        console.log(`[GLM] 流已收口(重复close，忽略) emittedTool=${emittedClose} injectedTool=${this.injectedTool}`)
        return
      }
      // baseChunk / flushChunks 需在下方日志分支里读取，故先解析；
      // 原实现把声明放在日志之后，会命中块级作用域 TDZ（TS2448/TS2454）。
      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)
      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []
      // 小结本次流：网页原生工具 / 代理注入工具 / 无工具
      if (injectedClose) {
        console.log(`[GLM] 流正常结束(close) → 代理注入工具: name=${injectedClose.name} args=${JSON.stringify(injectedClose.arguments)}`)
      } else if (emittedClose) {
        const names = flushChunks
          .map((c: any) => c?.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name)
          .filter(Boolean)
        console.log(`[GLM] 流正常结束(close) → 网页原生工具已提取并转发，工具名=[${names.join(', ')}]`)
      } else {
        console.log(`[GLM] 流正常结束(close) → 无工具(stop) emptyToolCallsDetected=${this.emptyToolCallsDetected}`)
        // GLM 已明确"本应调用工具但未产出"（tool_calls:{}），且既无网页原生工具、
        // 也无代理注入工具 → 触发真正重发（由 forwarder 提供的 retryCallback 执行，
        // 把最后一条用户消息重发给网页版）。仅在未重发过、且 forwarder 确实注入了
        // 回调时触发，retryCount 在 forwarder 侧控制防死循环。
        if (this.emptyToolCallsDetected && !this.alreadyRetried && this.retryCallback) {
          this.alreadyRetried = true
          console.log(`[GLM] 检测到空工具对象，触发重发回调`)
          // 注：retryCallback 内部会接管 transStream（写入重发流并关闭），
          // 故此处直接 return，不再走下方默认 stop 收口。
          this.retryCallback(transStream)
          this.onEnd?.()
          return
        }
      }
      for (const outChunk of flushChunks) {
        transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
      }
      if (injectedClose) {
        this.injectedTool = true
        const callId = 'call_' + this.conversationId + '_inject_close'
        const injectChunk = `data: ${JSON.stringify({
          id: this.conversationId,
          model: this.model,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                index: 0,
                id: callId,
                type: 'function',
                function: { name: injectedClose.name, arguments: JSON.stringify(injectedClose.arguments) },
              }],
            },
            finish_reason: null,
          }],
          created: this.created,
        })}\n\n`
        // 调试日志：把代理自行注入、发给客户端的工具调用数据包原样打印，
        // 便于确认"自己插入的工具包"是否正确（与 managedXml 的 TOOL_CALLS_PACKET 对应）。
        console.log(`[GLM][UP→CLIENT-INJECT] ${injectChunk.trim()}`)
        transStream.write(injectChunk)
        transStream.write(
          `data: ${JSON.stringify({
            id: this.conversationId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { finish_reason: 'tool_calls' }, finish_reason: 'tool_calls' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            created: this.created,
          })}\n\n`
        )
        transStream.end('data: [DONE]\n\n')
        this.onEnd?.()
        return
      }
      const finishReason = emittedClose ? 'tool_calls' : 'stop'
      transStream.write(
        `data: ${JSON.stringify({
          id: this.conversationId,
          model: this.model,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
          created: this.created,
        })}\n\n`
      )
      transStream.end('data: [DONE]\n\n')
      this.onEnd?.()
    })

    return transStream
  }

  async handleNonStream(stream: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const cachedParts: any[] = []

      const parser = createParser({
        onEvent: (event: any) => {
          try {
            const result = JSON.parse(event.data)

            if (!this.conversationId && result.conversation_id) {
              this.conversationId = result.conversation_id
            }

            if (result.status !== 'finish') {
              if (result.parts) {
                // Accumulate parts (same as handleStream), don't replace
                // GLM sends incremental parts, each event only contains new content
                result.parts.forEach((part: any) => {
                  const index = cachedParts.findIndex((p) => p.logic_id === part.logic_id)
                  if (index !== -1) {
                    cachedParts[index] = part
                  } else {
                    cachedParts.push(part)
                  }
                })
              }
            } else {
              const searchMap = new Map<string, any>()
              cachedParts.forEach((part) => {
                if (!part.content || !Array.isArray(part.content)) return
                const { meta_data } = part
                part.content.forEach((item: any) => {
                  if (item.type === 'tool_result' && meta_data?.tool_result_extra?.search_results) {
                    meta_data.tool_result_extra.search_results.forEach((res: any) => {
                      if (res.match_key) {
                        searchMap.set(res.match_key, res)
                      }
                    })
                  }
                })
              })

              const keyToIdMap = new Map<string, number>()
              let counter = 1
              let fullText = ''
              let fullReasoning = ''

              cachedParts.forEach((part) => {
                const { content, meta_data } = part
                if (!Array.isArray(content)) return

                let partText = ''
                let partReasoning = ''

                content.forEach((value: any) => {
                  const { type, text, think, image, code, content: innerContent } = value

                  if (type === 'text') {
                    let txt = text
                    if (searchMap.size > 0) {
                      txt = txt.replace(/【?(turn\d+[a-zA-Z]+\d+)】?/g, (match: string, key: string) => {
                        const searchInfo = searchMap.get(key)
                        if (!searchInfo) return match
                        if (!keyToIdMap.has(key)) {
                          keyToIdMap.set(key, counter++)
                        }
                        return ` [${keyToIdMap.get(key)}](${searchInfo.url})`
                      })
                    }
                    partText += txt
                  } else if (type === 'think') {
                    partReasoning += think
                  } else if (type === 'image' && Array.isArray(image) && part.status === 'finish') {
                    const imageText =
                      image.reduce((imgs: string, v: any) => {
                        return imgs + (/^(http|https):\/\//.test(v.image_url) ? `![image](${v.image_url})` : '')
                      }, '') + '\n'
                    partText += imageText
                  } else if (type === 'code') {
                    partText += '```python\n' + code + '\n```\n'
                  } else if (type === 'execution_output' && typeof innerContent === 'string' && part.status === 'finish') {
                    partText += innerContent + '\n'
                  }
                })

                if (partText) fullText += (fullText.length > 0 ? '\n' : '') + partText
                if (partReasoning) fullReasoning += (fullReasoning.length > 0 ? '\n' : '') + partReasoning
              })

              const { content: cleanContent, toolCalls } = this.toolCallingPlan?.shouldParseResponse
                ? { content: fullText, toolCalls: [] }
                : parseToolCallsFromText(fullText, 'glm')

              resolve({
                id: this.conversationId,
                model: this.model,
                object: 'chat.completion',
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: toolCalls.length > 0 ? null : cleanContent.trim(),
                      reasoning_content: fullReasoning || null,
                      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
                    },
                    finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
                  },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                created: Math.floor(Date.now() / 1000),
              })
            }
          } catch (err) {
            reject(err)
          }
        },
      })

      stream.on('data', (buffer: Buffer) => parser.feed(buffer.toString()))
      stream.once('error', reject)
      stream.once('close', () => {
        resolve({
          id: this.conversationId,
          model: this.model,
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '', reasoning_content: null },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          created: Math.floor(Date.now() / 1000),
        })
      })
    })
  }

  getConversationId(): string {
    return this.conversationId
  }
}

export const glmAdapter = {
  GLMAdapter,
  GLMStreamHandler,
}
