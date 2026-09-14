/**
 * Git Service Module
 * Wraps git operations for the IPC handlers and internal consumers.
 * Uses simple-git when available, falls back to child_process execSync.
 */

import { execSync } from 'child_process'

export interface GitStatus {
  currentBranch: string
  ahead: number
  behind: number
  staged: string[]
  unstaged: string[]
  untracked: string[]
  isClean: boolean
}

export interface GitBranch {
  name: string
  current: boolean
  ahead: number
  behind: number
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface GitLogOptions {
  limit?: number
  skip?: number
}

export class GitService {
  private repoPath: string

  constructor(repoPath?: string) {
    this.repoPath = repoPath || process.cwd()
  }

  setRepoPath(path: string): void {
    this.repoPath = path
  }

  getRepoPath(): string {
    return this.repoPath
  }

  private run(args: string[]): string {
    return execSync(['git', ...args].join(' '), {
      cwd: this.repoPath,
      encoding: 'utf8',
      timeout: 30000,
    }).trim()
  }

  getStatus(): GitStatus {
    try {
      const status = this.run(['status', '--porcelain'])
      const branch = this.run(['branch', '--show-current'])
      const staged: string[] = []
      const unstaged: string[] = []
      const untracked: string[] = []
      for (const line of status.split('\n').filter(Boolean)) {
        if (line.startsWith('A ') || line.startsWith('M ')) {
          staged.push(line.slice(3))
        } else if (line.startsWith(' M') || line.startsWith(' D')) {
          unstaged.push(line.slice(3))
        } else if (line.startsWith('??')) {
          untracked.push(line.slice(2).trim())
        }
      }
      return {
        currentBranch: branch || 'HEAD',
        ahead: 0,
        behind: 0,
        staged,
        unstaged,
        untracked,
        isClean: !status,
      }
    } catch {
      return {
        currentBranch: 'unknown',
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        isClean: true,
      }
    }
  }

  clone(url: string, targetPath: string): void {
    execSync(`git clone "${url}" "${targetPath}"`, { encoding: 'utf8', timeout: 120000 })
  }

  pull(): string {
    return this.run(['pull'])
  }

  push(): string {
    return this.run(['push'])
  }

  getLog(options: GitLogOptions = {}): GitCommit[] {
    const limit = options.limit || 20
    const skip = options.skip || 0
    const log = this.run(['log', `--skip=${skip}`, `-n ${limit}`, '--oneline'])
    return log.split('\n').filter(Boolean).map(line => {
      const [hash, ...msgParts] = line.split(' ')
      return { hash, message: msgParts.join(' '), author: '', date: '' }
    })
  }

  getBranches(): GitBranch[] {
    const output = this.run(['branch', '-a'])
    return output.split('\n').filter(Boolean).map(line => ({
      name: line.replace(/^\* /, ''),
      current: line.startsWith('* '),
      ahead: 0,
      behind: 0,
    }))
  }

  checkout(branchName: string): void {
    this.run(['checkout', branchName])
  }
}

export const gitService = new GitService()
export default gitService
