/**
 * engine/context/systemContext.ts - 系统上下文
 *
 * 统一组装系统级上下文：git 状态、平台信息、注入、Glossary 等。
 */

import { getSystemPromptInjection } from './promptInjection.js'

/** Git 状态获取 */
export async function getGitStatus(): Promise<string | null> {
  // TODO: 集成 gitContext
  return null
}

/** 系统上下文数据 */
export interface SystemContextData {
  gitStatus: string | null
  platformShell: string
  sessionEpoch: number
  injection: string | null
}

/** 获取系统上下文 */
export async function getSystemContext(): Promise<SystemContextData> {
  const gitStatus = await getGitStatus()
  const injection = getSystemPromptInjection()

  return {
    gitStatus,
    platformShell: getPlatformShellInfo(),
    sessionEpoch: getSessionEpoch(),
    injection,
  }
}

/** 获取平台 Shell 信息 */
export function getPlatformShellInfo(): string {
  const platform = process.platform
  const shell = process.env.CLAUDE_CODE_SHELL || process.env.SHELL || ''

  if (platform === 'win32') {
    if (shell.includes('git-bash') || shell.includes('msys')) {
      return 'win32 (Git Bash, 请返回 Windows cmd 格式命令)'
    }
    if (shell.includes('pwsh') || shell.includes('powershell')) {
      return 'win32 (PowerShell)'
    }
    return 'win32 (cmd)'
  }
  if (platform === 'darwin') return 'darwin (bash/zsh)'
  return 'linux (bash)'
}

/** 获取会话 epoch */
export function getSessionEpoch(): number {
  const globalWithEpoch = globalThis as typeof globalThis & { sessionEpoch?: number }
  return typeof globalWithEpoch.sessionEpoch === 'number' ? globalWithEpoch.sessionEpoch : 0
}
