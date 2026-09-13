/**
 * Coze (ByteDance) Adapter
 * Supports Coze Bot API
 */

import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface CozeMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type?: 'text'
}

export interface CozeRequest {
  bot_id: string
  user_id: string
  stream?: boolean
  auto_save_history?: boolean
  additional_messages?: CozeMessage[]
}

export interface CozeResponse {
  code: number
  msg: string
  data: {
    id: string
    conversation_id: string
    bot_id: string
    status: string
    content: string
    content_type: string
    created_at: number
    updated_at: number
    messages?: any[]
  }
}

export class CozeAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || account.credentials.token || ''
  }

  static isCozeProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'coze' ||
      endpoint.includes('coze.com') ||
      endpoint.includes('api.coze.com')
    )
  }

  getApiUrl(): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    return `${baseUrl}/open_api/v2/chat`
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

  async chat(request: CozeRequest): Promise<CozeResponse> {
    const url = this.getApiUrl()
    const headers = this.getHeaders()

    logManager.info('[Coze]', `Request to ${url}, bot=${request.bot_id}`)

    const response: AxiosResponse<CozeResponse> = await axios.post(url, request, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 300000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: CozeRequest): AsyncGenerator<string, void, unknown> {
    const url = `${this.getApiUrl()}?stream=true`
    const headers = this.getHeaders()

    logManager.info('[Coze]', `Stream request to ${url}, bot=${request.bot_id}`)

    const response = await axios.post(url, request, {
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
      const response = await axios.get(`${baseUrl}/open_api/v1/me`, {
        headers: this.getHeaders(),
        timeout: 10000,
      })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export const cozeAdapter = new CozeAdapter(
  { id: 'coze', name: 'Coze', type: 'builtin', authType: 'token', apiEndpoint: 'https://api.coze.com', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'coze-default', providerId: 'coze', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default CozeAdapter
