/**
 * src/engine/agent/subagent/worktree.ts
 *
 * 代理 git worktree 隔离（从 D:\src 移植概念）
 *
 * K 适配：
 * - 使用 Node.js child_process.spawn 调用 git
 * - 不依赖 D:\src 的 git 封装库
 * - 简化生命周期：create / hasChanges / remove
 */

import { spawn } from 'node:child_process'
import * as path from 'node:path'
import * as os from 'node:os'
import type { McpServerConfig } from './types.ts'

export interface WorktreeInfo {
  worktreePath: string
  worktreeBranch?: string
  headCommit?: string
  gitRoot: string
  hookBased: boolean
}

/** 创建代理隔离 worktree */
export async function createAgentWorktree(slug: string): Promise<WorktreeInfo | null> {
  const cwd = process.cwd()

  // 找到 git 根目录
  const gitRoot = await findGitRoot(cwd)
  if (!gitRoot) {
    return null
  }

  const branchName = `agent-${slug}`
  const worktreePath = path.join(os.tmpdir(), 'kx2code-worktrees', branchName)

  // 创建 worktree
  const result = await runGit(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], gitRoot)
  if (result.error) {
    return null
  }

  // 获取 HEAD commit
  const headCommit = await getHeadCommit(gitRoot)

  return {
    worktreePath,
    worktreeBranch: branchName,
    headCommit,
    gitRoot,
    hookBased: false,
  }
}

/** 检测 worktree 是否有未提交的更改 */
export async function hasWorktreeChanges(worktreePath: string, baseCommit: string): Promise<boolean> {
  const result = await runGit(['diff', '--quiet', baseCommit, '--', worktreePath], worktreePath)
  // diff --quiet: exit 0 = 无差异, exit 1 = 有差异
  if (result.exitCode === 0) return false
  if (result.exitCode === 1) return true
  return false
}

/** 删除 worktree */
export async function removeAgentWorktree(
  worktreePath: string,
  branchName: string | undefined,
  gitRoot: string,
): Promise<void> {
  // 先移除 worktree
  await runGit(['worktree', 'remove', worktreePath], gitRoot)

  // 删除分支（如果存在）
  if (branchName) {
    await runGit(['branch', '-D', branchName], gitRoot).catch(() => {
      // 分支可能已被删除，忽略
    })
  }
}

// ==================== 内部工具方法 ====================

async function findGitRoot(cwd: string): Promise<string | null> {
  const result = await runGit(['rev-parse', '--show-toplevel'], cwd)
  if (result.exitCode === 0 && result.stdout) {
    return result.stdout.trim()
  }
  return null
}

async function getHeadCommit(gitRoot: string): Promise<string | undefined> {
  const result = await runGit(['rev-parse', 'HEAD'], gitRoot)
  if (result.exitCode === 0 && result.stdout) {
    return result.stdout.trim()
  }
  return undefined
}

async function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        error: err.message,
      })
    })

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      })
    })
  })
}
