/**
 * ContextCompactor — KX2API 适配版
 *
 * 从 doge-desktop src/performance/ContextCompactor.ts 移植
 * 上下文压缩器：支持 summarize / truncate / selective 策略
 */

export interface CompactConfig {
  maxTokens: number
  threshold: number
  strategy: 'summarize' | 'truncate' | 'selective'
  preserveRecent: number
  preserveSystem: boolean
}

export interface Message {
  role: string
  content: string
  tokens?: number
  metadata?: Record<string, any>
}

export class ContextCompactor {
  private config: CompactConfig

  constructor(config: Partial<CompactConfig> = {}) {
    this.config = {
      maxTokens: 128000,
      threshold: 0.8,
      strategy: 'summarize',
      preserveRecent: 10,
      preserveSystem: true,
      ...config,
    }
  }

  estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + otherChars / 4)
  }

  getTotalTokens(messages: Message[]): number {
    return messages.reduce(
      (sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)),
      0,
    )
  }

  needsCompaction(messages: Message[]): boolean {
    const totalTokens = this.getTotalTokens(messages)
    return totalTokens >= this.config.maxTokens * this.config.threshold
  }

  compact(messages: Message[]): Message[] {
    if (!this.needsCompaction(messages)) {
      return messages
    }

    switch (this.config.strategy) {
      case 'summarize':
        return this.summarizeCompact(messages)
      case 'truncate':
        return this.truncateCompact(messages)
      case 'selective':
        return this.selectiveCompact(messages)
      default:
        return messages
    }
  }

  private summarizeCompact(messages: Message[]): Message[] {
    const recentMessages = messages.slice(-this.config.preserveRecent)
    const oldMessages = messages.slice(0, -this.config.preserveRecent)

    const systemMessages = this.config.preserveSystem
      ? oldMessages.filter(msg => msg.role === 'system')
      : []

    const summary = this.generateSummary(oldMessages)

    const summaryMessage: Message = {
      role: 'system',
      content: `[上下文摘要]\n${summary}`,
      metadata: {
        type: 'summary',
        originalMessageCount: oldMessages.length,
        compactedAt: new Date().toISOString(),
      },
    }

    return [...systemMessages, summaryMessage, ...recentMessages]
  }

  private truncateCompact(messages: Message[]): Message[] {
    const recentMessages = messages.slice(-this.config.preserveRecent)
    const systemMessages = this.config.preserveSystem
      ? messages.filter(msg => msg.role === 'system')
      : []

    const truncated = recentMessages.map(msg => ({
      ...msg,
      content:
        msg.content.length > 1000
          ? msg.content.slice(0, 1000) + '... [truncated]'
          : msg.content,
    }))

    return [...systemMessages, ...truncated]
  }

  private selectiveCompact(messages: Message[]): Message[] {
    const result: Message[] = []

    for (const msg of messages) {
      if (this.config.preserveSystem && msg.role === 'system') {
        result.push(msg)
        continue
      }

      if (messages.indexOf(msg) >= messages.length - this.config.preserveRecent) {
        result.push(msg)
        continue
      }

      const tokens = msg.tokens || this.estimateTokens(msg.content)
      if (tokens > 500) {
        continue
      }

      result.push(msg)
    }

    return result
  }

  private generateSummary(messages: Message[]): string {
    const summaries: string[] = []

    for (const msg of messages) {
      if (msg.role === 'system') continue

      const content = msg.content.slice(0, 200)
      summaries.push(`[${msg.role}] ${content}...`)
    }

    return summaries.join('\n')
  }

  updateConfig(updates: Partial<CompactConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  getConfig(): CompactConfig {
    return { ...this.config }
  }
}
