/**
 * OpenAI Adapter
 * Supports direct API Key authentication to OpenAI API
 * Also serves as base for compatible APIs (Groq, Together AI, etc.)
 */

import axios, { AxiosResponse } from 'axios'
import { PassThrough } from 'stream'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: any[]
}

export interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  n?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  logit_bias?: Record<string, number>
  user?: string
  tools?: any[]
  tool_choice?: any
  response_format?: any
  seed?: number
  logprobs?: boolean
  top_logprobs?: number
}

export interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: any[]
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class OpenAIAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || account.credentials.key || ''
  }

  static isOpenAIProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'openai' ||
      endpoint.includes('openai.com') ||
      endpoint.includes('api.openai.com')
    )
  }

  getApiUrl(): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    const chatPath = this.provider.chatPath || '/v1/chat/completions'
    return `${baseUrl}${chatPath}`
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }

    // Merge provider-level custom headers
    Object.entries(this.provider.headers || {}).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'authorization') {
        headers[key] = value
      }
    })

    // Merge account-level custom headers
    if (this.account.customHeaders) {
      Object.entries(this.account.customHeaders).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'authorization') {
          headers[key] = value
        }
      })
    }

    return headers
  }

  transformRequest(request: OpenAIRequest): OpenAIRequest {
    const actualModel = this.resolveModel(request.model)
    return {
      ...request,
      model: actualModel,
    }
  }

  resolveModel(requestedModel: string): string {
    if (this.account.modelMappings && this.account.overrideModelMappings) {
      const mapping = this.account.modelMappings[requestedModel]
      if (mapping) return mapping
    }

    const providerMappings = this.provider.modelMappings || {}
    const mapping = providerMappings[requestedModel]
    if (mapping) return mapping

    return requestedModel
  }

  async chat(request: OpenAIRequest): Promise<OpenAIResponse> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[OpenAI]', `Request to ${url}, model=${transformed.model}`)

    const response: AxiosResponse<OpenAIResponse> = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: OpenAIRequest): AsyncGenerator<string, void, unknown> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[OpenAI]', `Stream request to ${url}, model=${transformed.model}`)

    const response = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      responseType: 'stream',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const stream = response.data
    const buffer: string[] = []

    for await (const chunk of stream) {
      const text = chunk.toString()
      buffer.push(text)

      while (buffer.length > 0) {
        const line = buffer.shift()
        if (!line) continue

        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        const jsonStr = trimmed.slice(6)
        try {
          yield jsonStr
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
      const response = await axios.get(`${baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        timeout: 10000,
      })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export const openaiAdapter = new OpenAIAdapter(
  { id: 'openai', name: 'OpenAI', type: 'builtin', authType: 'token', apiEndpoint: 'https://api.openai.com', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'openai-default', providerId: 'openai', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default OpenAIAdapter
