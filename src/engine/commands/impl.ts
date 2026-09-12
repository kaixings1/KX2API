/**
 * Agent 命令具体实现
 * 每个命令都有真实的执行逻辑，而非空桩
 *
 * 分类：
 * - local: 本地直接执行（git、文件系统、进程等）
 * - llm: 通过 LLM 执行（代码生成、分析等）
 * - team: 多角色协作（复杂任务）
 */

import { execaCommand } from '../utils/exec.ts'

export type CommandImplType = 'local' | 'llm' | 'team'

export interface CommandImpl {
  type: CommandImplType
  execute: (args: string[], cwd?: string) => Promise<string>
}

// ==================== Git 相关 ====================

export const gitCommitImpl: CommandImpl = {
  type: 'local',
  execute: async (args, cwd) => {
    const msg = args.join(' ') || 'chore: auto commit'
    const { stdout, stderr } = await execaCommand(`git add -A && git commit -m "${msg.replace(/"/g, '\\"')}"`, cwd || process.cwd())
    return stdout || stderr || 'Git 提交完成'
  },
}

export const gitBlameImpl: CommandImpl = {
  type: 'local',
  execute: async (args, cwd) => {
    const file = args[0] || '.'
    const { stdout } = await execaCommand(`git blame ${file}`, cwd || process.cwd())
    return stdout || 'Git Blame 完成'
  },
}

// ==================== 文件操作 ====================

export const searchImpl: CommandImpl = {
  type: 'local',
  execute: async (args, cwd) => {
    const query = args.join(' ')
    if (!query) return '用法: /search <关键词>'

    const target = cwd || process.cwd()
    try {
      const { stdout } = await execaCommand(
        `grep -r -n --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.rs" --include="*.go" "${query}" "${target}" 2>/dev/null || echo "未找到匹配"`,
        target
      )
      return stdout || '未找到匹配'
    } catch {
      return '搜索完成，未找到匹配结果'
    }
  },
}

// ==================== Docker 相关 ====================

export const dockerImpl: CommandImpl = {
  type: 'local',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /docker <build|run|ps|logs|stop|rm> [参数...]'
    const sub = args[0]
    const rest = args.slice(1).join(' ')
    const { stdout, stderr } = await execaCommand(`docker ${sub} ${rest}`, cwd || process.cwd())
    return stdout || stderr || `Docker ${sub} 完成`
  },
}

// ==================== 系统命令 ====================

export const execImpl: CommandImpl = {
  type: 'local',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /exec <命令> [参数...]'
    const cmd = args.join(' ')
    try {
      const { stdout, stderr } = await execaCommand(cmd, cwd || process.cwd())
      const output = [stdout, stderr].filter(Boolean).join('\n')
      return output || '(命令执行成功，无输出)'
    } catch (e) {
      return `执行失败: ${(e as Error).message}`
    }
  },
}

// ==================== 命令描述映射 ====================

export const commandImpls = new Map<string, CommandImpl>([
  // Git
  ['commit', gitCommitImpl],
  ['blame', gitBlameImpl],
  // 搜索
  ['search', searchImpl],
  // Docker
  ['docker', dockerImpl],
  // 通用执行
  ['exec', execImpl],
])
