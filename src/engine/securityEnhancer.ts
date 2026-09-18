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

import { join } from 'node:path'
import type { ToolExecutor } from './toolScheduler.ts'
import { OutputSanitizer } from '../security/OutputSanitizer.ts'
import { CommandFilter } from '../security/CommandFilter.ts'
import { PathGuard } from '../security/PathGuard.ts'
import { AuditLogger } from '../security/AuditLogger.ts'
import { isFileTool, isShellTool } from './toolNameCompat.ts'

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
  /** 是否记录工具调用审计（含被拦截的） */
  enableAudit?: boolean
  /** 审计日志目录；缺省用 KX2_AUDIT_DIR 或当前目录 */
  auditDir?: string
  /** 审计缓冲条数（达到即落盘）；缺省 100 */
  auditBufferSize?: number
  /** 审计落盘间隔（毫秒）；缺省 10000 */
  auditFlushIntervalMs?: number
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
  enableAudit: true,
  auditDir: '',
  auditBufferSize: 100,
  auditFlushIntervalMs: 10000,
}

/**
 * 构造审计器。
 *
 * 审计文件写到 userData/audit 下。任何失败（无法解析路径、磁盘不可写）
 * 都降级为「不审计」—— 审计是安全增强项，绝不能因为它自身不可用
 * 而阻断工具执行。
 */
function createAuditLogger(
  cfg: Required<SecurityEnhancerConfig>,
): { logToolCall: (p: AuditParams) => void } | null {
  if (!cfg.enableAudit) return null
  try {
    // 延迟解析路径，避免在非 Electron 环境（测试）下 import 失败
    const baseDir = cfg.auditDir || process.env.KX2_AUDIT_DIR || '.'
    const logger = new AuditLogger(join(baseDir, 'audit.log'), {
      maxBufferSize: cfg.auditBufferSize,
      flushIntervalMs: cfg.auditFlushIntervalMs,
    })
    return {
      logToolCall: (p) => {
        try {
          logger.logToolCall(p)
          // 被拦截的调用属高价值安全事件，立即落盘而不是等缓冲攒满 ——
          // 否则进程异常退出时最该留下的记录反而丢失。
          if (p.result === 'denied') void logger.flush()
        } catch {
          /* 单条审计失败不影响工具执行 */
        }
      },
    }
  } catch {
    return null
  }
}

interface AuditParams {
  tool: string
  action: string
  params: Record<string, unknown>
  result: 'success' | 'failure' | 'denied'
  userId?: string
  sessionId?: string
  error?: string
}

export function createSecurityEnhancer(
  inner: ToolExecutor,
  config: SecurityEnhancerConfig = {},
): ToolExecutor {
  const cfg: Required<SecurityEnhancerConfig> = { ...DEFAULT_CONFIG, ...config }

  const sanitizer = new OutputSanitizer()
  const cmdFilter = new CommandFilter()
  const pathGuard = new PathGuard(cfg.pathGuardConfig)

  // 审计器：记录每一次工具调用的结果（含被拦截的）。
  // 这是审计最有价值的位置 —— 工具执行是唯一会真正改动外部状态的环节。
  const audit = createAuditLogger(cfg)

  return {
    async execute(tool, input, opts) {
      // 1. 命令过滤（Bash 工具）
      // 用 isShellTool 取代 `tool.name === 'Bash'`：实际工具名是注册命令 `bash`，
      // 原判断永不命中 —— 命令过滤（数据销毁/权限提升等）因此从未生效。
      if (cfg.filterCommands && isShellTool(tool.name)) {
        const command = typeof input.command === 'string' ? input.command : ''
        if (command) {
          const result = cmdFilter.check(command)
          if (!result.allowed) {
            const msgs = result.violations.map(v => `[${v.severity}] ${v.message}`).join('; ')
            // 拦截是审计重点：记录"想做什么但被阻止了"
            audit?.logToolCall({
              tool: tool.name,
              action: 'execute',
              params: input as Record<string, unknown>,
              result: 'denied',
              error: msgs,
            })
            return `[安全拦截] 命令被 CommandFilter 拒绝: ${msgs}`
          }
        }
      }

      // 2. 路径保护（文件工具）
      if (cfg.guardPaths) {
        // 概念归类取代硬编码名单：cat/ls/find/Read/Glob… 任意写法都能识别
        if (isFileTool(tool.name)) {
          const filePath = typeof input.path === 'string' ? input.path
            : typeof input.file_path === 'string' ? input.file_path
            : typeof input.file === 'string' ? input.file
            : null
          if (filePath) {
            const guardResult = pathGuard.validate(filePath)
            if (!guardResult.allowed) {
              audit?.logToolCall({
                tool: tool.name,
                action: 'execute',
                params: input as Record<string, unknown>,
                result: 'denied',
                error: guardResult.reason,
              })
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
        audit?.logToolCall({
          tool: tool.name,
          action: 'execute',
          params: input as Record<string, unknown>,
          result: 'success',
        })
      } catch (e) {
        // 错误信息也做净化
        const errMsg = e instanceof Error ? e.message : String(e)
        audit?.logToolCall({
          tool: tool.name,
          action: 'execute',
          params: input as Record<string, unknown>,
          result: 'failure',
          error: errMsg,
        })
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
