/**
 * Google Gemini Adapter
 * Supports Google AI Gemini API format
 */

import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'
import { logManager } from '../../logger/manager'

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiRequest {
  contents: GeminiContent[]
  systemInstruction?: { parts: GeminiPart[] }
  generationConfig?: {
    temperature?: number
    topP?: number
    maxOutputTokens?: number
    stopSequences?: string[]
    responseMimeType?: string
  }
  tools?: any[]
  toolConfig?: any
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: GeminiPart[]
      role: string
    }
    finishReason: string
    safetyRatings?: any[]
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export class GoogleAdapter {
  private provider: Provider
  private account: Account
  private apiKey: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.apiKey = account.credentials.apiKey || account.credentials.key || ''
  }

  static isGoogleProvider(provider: Provider): boolean {
    const endpoint = provider.apiEndpoint.toLowerCase()
    return (
      provider.id === 'google' ||
      endpoint.includes('googleapis.com') ||
      endpoint.includes('generativelanguage')
    )
  }

  getApiUrl(model: string): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    const apiKey = this.apiKey
    return `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`
  }

  getStreamUrl(model: string): string {
    const baseUrl = this.provider.apiEndpoint.replace(/\/+$/, '')
    const apiKey = this.apiKey
    return `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
  }

  transformRequest(request: GeminiRequest): GeminiRequest {
    const actualModel = this.resolveModel(request.contents?.[0]?.parts?.[0]?.text || '')
    return { ...request }
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

  async chat(request: GeminiRequest, model: string): Promise<GeminiResponse> {
    const url = this.getApiUrl(model)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    logManager.info('[Google]', `Request to ${url}`)

    const response: AxiosResponse<GeminiResponse> = await axios.post(url, request, {
      headers,
      timeout: this.account.timeout || this.provider.timeout || 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return response.data
  }

  async *chatStream(request: GeminiRequest, model: string): AsyncGenerator<string, void, unknown> {
    const url = this.getStreamUrl(model)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    logManager.info('[Google]', `Stream request to ${url}`)

    const response = await axios.post(url, request, {
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
        if (!trimmed.startsWith('data: ')) continue
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
      const response = await axios.get(`${baseUrl}/v1beta/models?key=${this.apiKey}`, {
        timeout: 10000,
      })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export const googleAdapter = new GoogleAdapter(
  { id: 'google', name: 'Google', type: 'builtin', authType: 'token', apiEndpoint: 'https://generativelanguage.googleapis.com', headers: {}, enabled: true, createdAt: Date.now(), updatedAt: Date.now() } as Provider,
  { id: 'google-default', providerId: 'google', name: 'default', credentials: {}, status: 'active', createdAt: Date.now(), updatedAt: Date.now() } as Account
)

export default GoogleAdapter
