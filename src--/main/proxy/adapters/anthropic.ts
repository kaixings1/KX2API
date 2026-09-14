/**
 * Anthropic Claude Adapter
 * Supports Anthropic Messages API format with tool use
 */

import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, any>
  tool_use_id?: string
}

export interface AnthropicRequest {
  model: string
  max_tokens: number
  messages: AnthropicMessage[]
  system?: string | AnthropicContentBlock[]
  stream?: boolean
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  tools?: any[]
  tool_choice?: any
}

export interface AnthropicResponse {
  id: string
  type: string
  role: string
  content: AnthropicContentBlock[]
  model: string
  stop_reason: string
  stop_sequence?: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class AnthropicAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || account.credentials.key || ''
  }

  static isAnthropicProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'anthropic' ||
      endpoint.includes('anthropic.com') ||
      endpoint.includes('claude.ai')
    )
  }

  getApiUrl(): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    const chatPath = this.provider.chatPath || '/v1/messages'
    return `${baseUrl}${chatPath}`
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }

    Object.entries(this.provider.headers || {}).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'x-api-key' && key.toLowerCase() !== 'anthropic-version') {
        headers[key] = value
      }
    })

    if (this.account.customHeaders) {
      Object.entries(this.account.customHeaders).forEach(([key, value]) => {
        headers[key] = value
      })
    }

    return headers
  }

  transformRequest(request: AnthropicRequest): AnthropicRequest {
    return {
      ...request,
      model: this.resolveModel(request.model),
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

  async chat(request: AnthropicRequest): Promise<AnthropicResponse> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[Anthropic]', `Request to ${url}, model=${transformed.model}`)

    const response: AxiosResponse<AnthropicResponse> = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: AnthropicRequest): AsyncGenerator<string, void, unknown> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[Anthropic]', `Stream request to ${url}, model=${transformed.model}`)

    const response = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      responseType: 'stream',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const stream = response.data
    let buffer = ''

    for await (const chunk of stream) {
      buffer += chunk.toString()

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (jsonStr === '[DONE]') continue
        try {
          yield jsonStr
        } catch {
          // skip
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

export const anthropicAdapter = new AnthropicAdapter(
  { id: 'anthropic', name: 'Anthropic', type: 'builtin', authType: 'token', apiEndpoint: 'https://api.anthropic.com', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'anthropic-default', providerId: 'anthropic', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default AnthropicAdapter
