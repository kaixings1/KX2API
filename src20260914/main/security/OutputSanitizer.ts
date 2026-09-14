/**
 * 输出净化器
 * 纯逻辑模块，无外部依赖
 */

export interface SanitizeOptions {
  redactSecrets: boolean
  redactPaths: boolean
  redactIPs: boolean
  redactEmails: boolean
  redactPhoneNumbers: boolean
  redactCreditCards: boolean
  maxOutputLength: number
}

export class OutputSanitizer {
  private defaultOptions: SanitizeOptions = {
    redactSecrets: true,
    redactPaths: false,
    redactIPs: false,
    redactEmails: false,
    redactPhoneNumbers: false,
    redactCreditCards: true,
    maxOutputLength: 100000,
  }

  sanitize(output: string, options: Partial<SanitizeOptions> = {}): string {
    const opts = { ...this.defaultOptions, ...options }
    let sanitized = output

    if (sanitized.length > opts.maxOutputLength) {
      sanitized = sanitized.slice(0, opts.maxOutputLength) + '\n... [output truncated]'
    }

    if (opts.redactSecrets) {
      sanitized = this.redactSecrets(sanitized)
    }

    if (opts.redactPaths) {
      sanitized = this.redactPaths(sanitized)
    }

    if (opts.redactIPs) {
      sanitized = this.redactIPs(sanitized)
    }

    if (opts.redactEmails) {
      sanitized = this.redactEmails(sanitized)
    }

    if (opts.redactPhoneNumbers) {
      sanitized = this.redactPhoneNumbers(sanitized)
    }

    if (opts.redactCreditCards) {
      sanitized = this.redactCreditCards(sanitized)
    }

    return sanitized
  }

  private redactSecrets(text: string): string {
    const patterns: Array<{ pattern: RegExp; replacement: string }> = [
      { pattern: /(?:api[_-]?key|apikey)["\s]*[:=]\s*["']?[a-zA-Z0-9\-_]{20,}["']?/gi, replacement: '***REDACTED***' },
      { pattern: /Bearer\s+([a-zA-Z0-9\-_\.]+)/gi, replacement: 'Bearer ***REDACTED***' },
      { pattern: /(?:password|passwd|pwd)["\s]*[:=]\s*["']?([^"'\s]+)["']?/gi, replacement: '$1=***REDACTED***' },
      { pattern: /(?:secret|token)["\s]*[:=]\s*["']?([a-zA-Z0-9\-_]{16,})["']?/gi, replacement: '$1=***REDACTED***' },
      { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '***AWS_KEY_REDACTED***' },
      { pattern: /aws_secret_access_key\s*=\s*([a-zA-Z0-9/+=]{40})/gi, replacement: 'aws_secret_access_key=***REDACTED***' },
      { pattern: /-----BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g, replacement: '***PRIVATE_KEY_REDACTED***' },
    ]

    let result = text
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement)
    }

    return result
  }

  private redactPaths(text: string): string {
    return text.replace(
      /(?:[A-Za-z]:\\|\/)(?:Users|home|root)[\/\\][^\/\\\s]+/g,
      '***PATH_REDACTED***'
    )
  }

  private redactIPs(text: string): string {
    return text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***IP_REDACTED***')
  }

  private redactEmails(text: string): string {
    return text.replace(
      /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '***EMAIL_REDACTED***'
    )
  }

  private redactPhoneNumbers(text: string): string {
    return text.replace(
      /(?:\+?86)?1[3-9]\d{9}/g,
      '***PHONE_REDACTED***'
    )
  }

  private redactCreditCards(text: string): string {
    return text.replace(
      /\b(?:\d[ -]*?){13,16}\b/g,
      '***CARD_REDACTED***'
    )
  }
}
