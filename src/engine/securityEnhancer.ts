/**
 * engine/securityEnhancer.ts — 安全增强层
 *
 * 将 src/security/ 的工具类集成到工具执行流程中：
 * - OutputSanitizer: 净化工具输出（脱敏密钥、路径、IP 等）
 * - CommandFilter:   额外检查危险命令（绕过沙箱时提供第二层防护）
 * - PathGuard:       验证文件操作路径
 *
 * 集成方式：包装 ToolExecutor，在 sandbox executor 之上添加安全增强。
 */

import type { ToolExecutor } from './toolScheduler.ts'
import { OutputSanitizer } from '../security/OutputSanitizer.ts'
import { CommandFilter } from '../security/CommandFilter.ts'
import { PathGuard } from '../security/PathGuard.ts'

export interface SecurityEnhancerConfig {
  /** 是否启用输出净化 */
  sanitizeOutput?: boolean
  /** 是否启用命令过滤（Bash 工具） */
  filterCommands?: boolean
  /** 是否启用路径保护（文件工具） */
  guardPaths?: boolean
  /** 输出最大长度（默认 100KB） */
  maxOutputLength?: number
  /** 要脱敏的选项 */
  sanitizeOptions?: {
    redactSecrets?: boolean
    redactPaths?: boolean
    redactIPs?: boolean
    redactEmails?: boolean
    redactPhoneNumbers?: boolean
    redactCreditCards?: boolean
  }
  /** 路径守卫配置 */
  pathGuardConfig?: {
    rootDir?: string
    allowedDirs?: string[]
    blockedDirs?: string[]
  }
}

const DEFAULT_CONFIG: Required<SecurityEnhancerConfig> = {
  sanitizeOutput: true,
  filterCommands: true,
  guardPaths: true,
  maxOutputLength: 100_000,
  sanitizeOptions: {
    redactSecrets: true,
    redactPaths: false,
    redactIPs: false,
    redactEmails: false,
    redactPhoneNumbers: false,
    redactCreditCards: true,
  },
  pathGuardConfig: {},
}

export function createSecurityEnhancer(
  inner: ToolExecutor,
  config: SecurityEnhancerConfig = {},
): ToolExecutor {
  const cfg: Required<SecurityEnhancerConfig> = { ...DEFAULT_CONFIG, ...config }

  const sanitizer = new OutputSanitizer()
  const cmdFilter = new CommandFilter()
  const pathGuard = new PathGuard(cfg.pathGuardConfig)

  return {
    async execute(tool, input, opts) {
      // 1. 命令过滤（Bash 工具）
      if (cfg.filterCommands && tool.name === 'Bash') {
        const command = typeof input.command === 'string' ? input.command : ''
        if (command) {
          const result = cmdFilter.check(command)
          if (!result.allowed) {
            const msgs = result.violations.map(v => `[${v.severity}] ${v.message}`).join('; ')
            return `[安全拦截] 命令被 CommandFilter 拒绝: ${msgs}`
          }
        }
      }

      // 2. 路径保护（文件工具）
      if (cfg.guardPaths) {
        const fileTools = new Set(['Read', 'Edit', 'Write', 'MultiFileEdit', 'Glob', 'Grep'])
        if (fileTools.has(tool.name)) {
          const filePath = typeof input.path === 'string' ? input.path
            : typeof input.file_path === 'string' ? input.file_path
            : typeof input.file === 'string' ? input.file
            : null
          if (filePath) {
            const guardResult = pathGuard.validate(filePath)
            if (!guardResult.allowed) {
              return `[安全拦截] 路径被 PathGuard 拒绝: ${guardResult.reason}`
            }
          }
        }
      }

      // 3. 执行工具
      let output: string
      try {
        const result = await inner.execute(tool, input, opts)
        output = typeof result === 'string' ? result : String(result)
      } catch (e) {
        // 错误信息也做净化
        const errMsg = e instanceof Error ? e.message : String(e)
        if (cfg.sanitizeOutput) {
          return sanitizer.sanitize(errMsg, {
            maxOutputLength: cfg.maxOutputLength,
            ...cfg.sanitizeOptions,
          })
        }
        throw e
      }

      // 4. 输出净化
      if (cfg.sanitizeOutput && output) {
        output = sanitizer.sanitize(output, {
          maxOutputLength: cfg.maxOutputLength,
          ...cfg.sanitizeOptions,
        })
      }

      return output
    },
  }
}
