/**
 * exec.ts — 安全执行本地命令
 * 使用 Node.js 原生 child_process，无需额外依赖
 */

import { exec } from 'child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function execaCommand(
  command: string,
  cwd: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, {
      cwd,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    })
    return {
      stdout: result.stdout?.trim() ?? '',
      stderr: result.stderr?.trim() ?? '',
    }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? err.message ?? '命令执行失败',
    }
  }
}
