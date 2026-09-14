/**
 * Mistral AI Adapter
 * Supports Mistral API (OpenAI-compatible)
 */

import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: any[]
}

export interface MistralRequest {
  model: string
  messages: MistralMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string[]
  tools?: any[]
  tool_choice?: any
  response_format?: any
}

export interface MistralResponse {
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
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class MistralAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || account.credentials.key || ''
  }

  static isMistralProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'mistral' ||
      endpoint.includes('mistral.ai') ||
      endpoint.includes('api.mistral.ai')
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

    Object.entries(this.provider.headers || {}).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'authorization') {
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

  async chat(request: MistralRequest): Promise<MistralResponse> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = { ...request, model: this.resolveModel(request.model) }

    logManager.info('[Mistral]', `Request to ${url}, model=${transformed.model}`)

    const response: AxiosResponse<MistralResponse> = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: MistralRequest): AsyncGenerator<string, void, unknown> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = { ...request, model: this.resolveModel(request.model) }

    logManager.info('[Mistral]', `Stream request to ${url}, model=${transformed.model}`)

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

export const mistralAdapter = new MistralAdapter(
  { id: 'mistral', name: 'Mistral', type: 'builtin', authType: 'token', apiEndpoint: 'https://api.mistral.ai', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'mistral-default', providerId: 'mistral', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default MistralAdapter
