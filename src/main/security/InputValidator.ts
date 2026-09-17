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
      return { valid: false, errors: ['值必须是字符串'] }
    }

    if (!options.allowEmpty && value.length === 0) {
      errors.push('值不能为空')
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`值的长度至少为 ${options.minLength} 个字符`)
    }

    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`值的长度至多为 ${options.maxLength} 个字符`)
    }

    if (options.pattern && !options.pattern.test(value)) {
      errors.push('值不匹配要求的格式')
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
      return { valid: false, errors: ['路径不能为空'] }
    }

    if (path.includes('..')) {
      errors.push('检测到路径穿越（不允许 ..）')
    }

    const dangerousChars = /[<>:"|?*\x00-\x1f]/
    if (dangerousChars.test(path)) {
      errors.push('路径包含危险字符')
    }

    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
    const basename = path.split(/[\\/]/).pop() || ''
    if (reservedNames.test(basename.split('.')[0])) {
      errors.push('路径使用了 Windows 保留名')
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
      return { valid: false, errors: ['命令不能为空'] }
    }

    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//, message: '从根目录递归删除' },
      { pattern: /:\(\)\s*\{\s*:\|:\&\s*\}\s*;/, message: '检测到 fork 炸弹' },
      { pattern: /mkfs/, message: '文件系统格式化命令' },
      { pattern: /dd\s+.*of=\/dev\//, message: '直接写入设备' },
      { pattern: />\s*\/dev\/sd[a-z]/, message: '直接写入设备' },
      { pattern: /chmod\s+777\s+\//, message: '对根目录设置全局可写' },
      { pattern: /curl.*\|\s*sh/, message: '经由 curl 的远程代码执行' },
      { pattern: /wget.*\|\s*sh/, message: '经由 wget 的远程代码执行' },
    ]

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(command)) {
        errors.push(`检测到危险命令：${message}`)
      }
    }

    if (/[$`]/.test(command) && !command.startsWith('echo')) {
      errors.push('可能存在命令注入（shell 元字符）')
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
      return { valid: false, errors: ['值必须是对象'] }
    }

    for (const [key, rule] of Object.entries(schema)) {
      const fieldRule = rule as Record<string, unknown>

      if (fieldRule.required && !(key in value)) {
        errors.push(`缺少必填字段：${key}`)
        continue
      }

      if (key in value) {
        const fieldValue = value[key]

        if (fieldRule.type && typeof fieldValue !== fieldRule.type) {
          errors.push(`Field ${key} must be of type ${fieldRule.type}`)
        }

        if (typeof fieldRule.maxLength === 'number' && typeof fieldValue === 'string' && fieldValue.length > fieldRule.maxLength) {
          errors.push(`Field ${key} exceeds max length of ${fieldRule.maxLength}`)
        }

        if (fieldRule.pattern instanceof RegExp && typeof fieldValue === 'string' && !fieldRule.pattern.test(fieldValue)) {
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
