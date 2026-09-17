/**
 * 路径安全控制器
 * 纯逻辑模块，无外部依赖（path 用于路径规范化）
 */
import { resolve, normalize, isAbsolute, join } from 'path'

export interface PathGuardConfig {
  rootDir: string
  allowedDirs: string[]
  blockedDirs: string[]
  allowedExtensions: string[]
  blockedExtensions: string[]
  maxSymlinkDepth: number
}

export class PathGuard {
  private config: PathGuardConfig

  constructor(config: Partial<PathGuardConfig> = {}) {
    this.config = {
      rootDir: process.cwd(),
      allowedDirs: [],
      blockedDirs: [
        '.git',
        'node_modules',
        '.env',
        '.ssh',
        '.aws',
      ],
      allowedExtensions: [],
      blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.ps1'],
      maxSymlinkDepth: 5,
      ...config,
    }
  }

  /**
   * 验证路径
   */
  validate(path: string): {
    allowed: boolean
    reason?: string
    normalizedPath?: string
  } {
    if (!path || path.trim().length === 0) {
      return { allowed: false, reason: '路径为空' }
    }

    const normalizedPath = this.normalizePath(path)

    if (path.includes('..')) {
      const resolved = resolve(this.config.rootDir, path)
      if (!resolved.startsWith(this.config.rootDir)) {
        return {
          allowed: false,
          reason: '检测到路径穿越：超出根目录',
        }
      }
    }

    for (const blocked of this.config.blockedDirs) {
      if (normalizedPath.includes(blocked)) {
        return {
          allowed: false,
          reason: `禁止访问的目录：${blocked}`,
          normalizedPath,
        }
      }
    }

    if (this.config.allowedDirs.length > 0) {
      const inAllowedDir = this.config.allowedDirs.some((dir) =>
        normalizedPath.startsWith(this.normalizePath(dir))
      )
      if (!inAllowedDir) {
        return {
          allowed: false,
          reason: '路径不在允许的目录内',
          normalizedPath,
        }
      }
    }

    const ext = this.getExtension(normalizedPath)
    if (ext) {
      if (this.config.blockedExtensions.includes(ext)) {
        return {
          allowed: false,
          reason: `禁止的文件扩展名：${ext}`,
          normalizedPath,
        }
      }

      if (
        this.config.allowedExtensions.length > 0 &&
        !this.config.allowedExtensions.includes(ext)
      ) {
        return {
          allowed: false,
          reason: `File extension not allowed: ${ext}`,
          normalizedPath,
        }
      }
    }

    return { allowed: true, normalizedPath }
  }

  private normalizePath(path: string): string {
    let normalized = path.replace(/\\/g, '/')

    if (!isAbsolute(normalized)) {
      normalized = join(this.config.rootDir, normalized)
    }

    normalized = normalize(normalized)

    return normalized.replace(/\\/g, '/')
  }

  private getExtension(path: string): string {
    const parts = path.split('.')
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : ''
  }

  addAllowedDir(dir: string): void {
    this.config.allowedDirs.push(dir)
  }

  addBlockedDir(dir: string): void {
    this.config.blockedDirs.push(dir)
  }

  updateConfig(updates: Partial<PathGuardConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}
