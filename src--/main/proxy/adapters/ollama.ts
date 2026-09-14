/**
 * Ollama Adapter
 * Supports local/remote Ollama API
 */

import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface OllamaRequest {
  model: string
  messages: OllamaMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    num_ctx?: number
    max_tokens?: number
    stop?: string[]
    seed?: number
  }
  format?: string
  keep_alive?: string
}

export interface OllamaResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export class OllamaAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || ''
  }

  static isOllamaProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'ollama' ||
      endpoint.includes('localhost') ||
      endpoint.includes('127.0.0.1') ||
      endpoint.includes(':11434')
    )
  }

  getApiUrl(): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    const chatPath = this.provider.chatPath || '/api/chat'
    return `${baseUrl}${chatPath}`
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    Object.entries(this.provider.headers || {}).forEach(([key, value]) => {
      headers[key] = value
    })

    if (this.account.customHeaders) {
      Object.entries(this.account.customHeaders).forEach(([key, value]) => {
        headers[key] = value
      })
    }

    return headers
  }

  transformRequest(request: OllamaRequest): OllamaRequest {
    return {
      ...request,
      model: this.resolveModel(request.model),
      stream: request.stream ?? true,
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

  async chat(request: OllamaRequest): Promise<OllamaResponse> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[Ollama]', `Request to ${url}, model=${transformed.model}`)

    const response: AxiosResponse<OllamaResponse> = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 300000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: OllamaRequest): AsyncGenerator<string, void, unknown> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()
    const transformed = this.transformRequest(request)

    logManager.info('[Ollama]', `Stream request to ${url}, model=${transformed.model}`)

    const response = await axios.post(url, transformed, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 300000,
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
        if (!trimmed) continue
        try {
          yield trimmed
        } catch {
          // skip
        }
      }
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
      const response = await axios.get(`${baseUrl}/api/tags`, {
        headers: this.getHeaders(),
        timeout: 10000,
      })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export const ollamaAdapter = new OllamaAdapter(
  { id: 'ollama', name: 'Ollama', type: 'builtin', authType: 'token', apiEndpoint: 'http://localhost:11434', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'ollama-default', providerId: 'ollama', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default OllamaAdapter
