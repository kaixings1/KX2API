/**
 * 输入验证器
 * 纯逻辑模块，无外部依赖
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: any
}

export class InputValidator {
  /**
   * 验证字符串
   */
  validateString(
    value: any,
    options: {
      maxLength?: number
      minLength?: number
      pattern?: RegExp
      allowEmpty?: boolean
    } = {}
  ): ValidationResult {
    const errors: string[] = []

    if (typeof value !== 'string') {
      return { valid: false, errors: ['Value must be a string'] }
    }

    if (!options.allowEmpty && value.length === 0) {
      errors.push('Value cannot be empty')
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`Value must be at least ${options.minLength} characters`)
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`Value must be at most ${options.maxLength} characters`)
    }

    if (options.pattern && !options.pattern.test(value)) {
      errors.push('Value does not match required pattern')
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeString(value),
    }
  }

  /**
   * 验证文件路径
   */
  validateFilePath(path: string): ValidationResult {
    const errors: string[] = []

    if (!path || path.trim().length === 0) {
      return { valid: false, errors: ['Path cannot be empty'] }
    }

    if (path.includes('..')) {
      errors.push('Path traversal detected (.. is not allowed)')
    }

    const dangerousChars = /[<>:"|?*\x00-\x1f]/
    if (dangerousChars.test(path)) {
      errors.push('Path contains dangerous characters')
    }

    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
    const basename = path.split(/[\\/]/).pop() || ''
    if (reservedNames.test(basename.split('.')[0])) {
      errors.push('Path uses reserved Windows name')
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizePath(path),
    }
  }

  /**
   * 验证命令
   */
  validateCommand(command: string): ValidationResult {
    const errors: string[] = []

    if (!command || command.trim().length === 0) {
      return { valid: false, errors: ['Command cannot be empty'] }
    }

    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//, message: 'Recursive delete from root' },
      { pattern: /:\(\)\s*\{\s*:\|:\&\s*\}\s*;/, message: 'Fork bomb detected' },
      { pattern: /mkfs/, message: 'Filesystem format command' },
      { pattern: /dd\s+.*of=\/dev\//, message: 'Direct device write' },
      { pattern: />\s*\/dev\/sd[a-z]/, message: 'Direct device write' },
      { pattern: /chmod\s+777\s+\//, message: 'Setting world-writable on root' },
      { pattern: /curl.*\|\s*sh/, message: 'Remote code execution via curl' },
      { pattern: /wget.*\|\s*sh/, message: 'Remote code execution via wget' },
    ]

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(command)) {
        errors.push(`Dangerous command detected: ${message}`)
      }
    }

    if (/[$`]/.test(command) && !command.startsWith('echo')) {
      errors.push('Potential command injection (shell metacharacters)')
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeCommand(command),
    }
  }

  /**
   * 验证 JSON
   */
  validateJSON(value: any, schema: Record<string, any>): ValidationResult {
    const errors: string[] = []

    if (typeof value !== 'object' || value === null) {
      return { valid: false, errors: ['Value must be an object'] }
    }

    for (const [key, rule] of Object.entries(schema)) {
      const fieldRule = rule as Record<string, unknown>

      if (fieldRule.required && !(key in value)) {
        errors.push(`Missing required field: ${key}`)
        continue
      }

      if (key in value) {
        const fieldValue = value[key]

        if (fieldRule.type && typeof fieldValue !== fieldRule.type) {
          errors.push(`Field ${key} must be of type ${fieldRule.type}`)
        }

        if (fieldRule.maxLength && typeof fieldValue === 'string' && fieldValue.length > fieldRule.maxLength) {
          errors.push(`Field ${key} exceeds max length of ${fieldRule.maxLength}`)
        }

        if (fieldRule.pattern && typeof fieldValue === 'string' && !fieldRule.pattern.test(fieldValue)) {
          errors.push(`Field ${key} does not match required pattern`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: value,
    }
  }

  private sanitizeString(value: string): string {
    return value
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
  }

  private sanitizePath(path: string): string {
    return path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .replace(/\/+/g, '/')
      .trim()
  }

  private sanitizeCommand(command: string): string {
    return command
      .replace(/[\x00-\x1f]/g, ' ')
      .trim()
  }
}
