/**
 * main/hooks/hookRunner.ts — 钩子执行器
 *
 * 移植自 D:\src\utils\hooks.ts 的执行与结果语义部分。
 *
 * 执行模型（对齐上游）：
 * - 同一事件的多个钩子**并行**执行
 * - 默认超时 10 秒，单个钩子可用 `timeout` 覆盖
 * - 超时/退出后必须**杀掉整棵进程树**
 * - 退出码 2 视为阻塞性错误；其它非零退出视为非阻塞失败
 * - stdout 若是 JSON，按上游的字段语义解析（continue / decision / permissionDecision 等）
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { HookContext, HookProgress, HookResult } from './types.ts'
import { getMatchingHooks } from './hookConfig.ts'

/**
 * 解析执行钩子用的 shell。
 *
 * 为什么不能在 Windows 上直接写 `bash.exe`：
 * `where bash` 在 Windows 上会优先返回 `C:\Windows\System32\bash.exe` ——
 * 那是 **WSL 的转发器**，未安装 WSL 发行版时执行任何命令都只会输出
 * "适用于 Linux 的 Windows 子系统没有已安装的分发" 并退出码 1。
 * 实测该路径确实会被 where 命中，因此**不能靠 PATH 探测**。
 *
 * 策略：直接检查 Git for Windows 的已知安装路径（存在性检查，零进程开销）；
 * 找不到就回落到 Node 默认 shell（Windows 下即 COMSPEC = cmd.exe），
 * 与项目其它执行入口（engine/utils/exec.ts 用默认 shell）保持一致。
 */
let resolvedShell: string | true | null = null

export function resolveHookShell(): string | true {
  if (resolvedShell !== null) return resolvedShell

  const override = process.env.KX2_HOOK_SHELL
  if (override && override.trim()) {
    resolvedShell = override.trim()
    return resolvedShell
  }

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`
        : '',
      process.env.ProgramW6432
        ? `${process.env.ProgramW6432}\\Git\\bin\\bash.exe`
        : '',
    ].filter(Boolean)
    for (const c of candidates) {
      try {
        if (existsSync(c)) {
          resolvedShell = c
          return resolvedShell
        }
      } catch {
        /* 继续找下一个 */
      }
    }
    // 没有 Git Bash：用默认 shell（cmd.exe），钩子须写成 cmd 语法
    resolvedShell = true
    return resolvedShell
  }

  resolvedShell = true
  return resolvedShell
}

/** 重置 shell 解析缓存（测试/配置变更用） */
export function resetHookShellCache(): void {
  resolvedShell = null
}

/** 默认单钩子超时（毫秒），对齐上游 TOOL_HOOK_EXECUTION_TIMEOUT_MS */
export const DEFAULT_HOOK_TIMEOUT_MS = 10_000

/** SessionEnd 在退出流程里跑，必须更短，否则会拖住应用关闭 */
export const SESSION_END_HOOK_TIMEOUT_MS = 1_500

/** 单个钩子的 stdout/stderr 采集上限（防止钩子刷爆内存） */
const MAX_OUTPUT_BYTES = 256 * 1024

/**
 * 杀掉**整棵进程树**。
 *
 * ⚠️ 这是 Windows 上最关键的一处：`child.kill()` 只终止直接子进程，
 * 钩子命令若是 `npm run x`、`bash -c "..."` 这类会派生孙进程的形式，
 * 被杀之后孙进程仍在后台运行（占用端口、锁文件），且超时控制形同虚设。
 *
 * Windows 用 `taskkill /T`（含子树）`/F`（强制）。
 * POSIX 靠 spawn 时的 `detached: true` 建立进程组，再用负 pid 整组杀。
 */
export function killProcessTree(pid: number | undefined): void {
  if (!pid) return

  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      }).unref()
    } catch {
      // taskkill 不可用时退回单进程终止
      try {
        process.kill(pid)
      } catch {
        /* 进程可能已退出 */
      }
    }
    return
  }

  // POSIX：先试进程组（需 spawn 时 detached），再退回单进程
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* 进程可能已退出 */
    }
  }
}

interface RunOutcome {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  durationMs: number
}

/** 执行单条命令，带超时与进程树终止 */
function runCommand(
  command: string,
  timeoutMs: number,
  ctx: HookContext,
  onProgress?: (p: HookProgress) => void,
): Promise<RunOutcome> {
  return new Promise(resolve => {
    const start = Date.now()
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false

    const isWin = process.platform === 'win32'

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, [], {
        cwd: ctx.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        // POSIX 下建立独立进程组，便于整组终止（killProcessTree 依赖它）
        detached: !isWin,
        shell: resolveHookShell(),
      })
    } catch (e) {
      resolve({
        exitCode: null,
        stdout: '',
        stderr: `spawn 失败: ${(e as Error).message}`,
        timedOut: false,
        durationMs: Date.now() - start,
      })
      return
    }

    const finish = (exitCode: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, timedOut, durationMs: Date.now() - start })
    }

    const timer = setTimeout(() => {
      timedOut = true
      killProcessTree(child.pid)
      // 给 taskkill 一点时间；进程若仍未退出，超时兜底直接收尾
      setTimeout(() => finish(null), 500)
    }, timeoutMs)
    // 定时器不应阻止 Node 进程退出
    timer.unref?.()

    const appendOut = (buf: Buffer, target: 'out' | 'err') => {
      const s = buf.toString('utf8')
      if (target === 'out') {
        if (stdout.length < MAX_OUTPUT_BYTES) stdout += s.slice(0, MAX_OUTPUT_BYTES - stdout.length)
      } else {
        if (stderr.length < MAX_OUTPUT_BYTES) stderr += s.slice(0, MAX_OUTPUT_BYTES - stderr.length)
      }
    }

    child.stdout?.on('data', (b: Buffer) => appendOut(b, 'out'))
    child.stderr?.on('data', (b: Buffer) => appendOut(b, 'err'))

    child.on('error', (err: Error) => {
      stderr += `\n进程错误: ${err.message}`
      finish(null)
    })

    child.on('close', (code: number | null) => {
      onProgress?.({
        event: ctx.event,
        command,
        exitCode: code ?? undefined,
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
        durationMs: Date.now() - start,
        timedOut,
      })
      finish(code)
    })

    // 把结构化上下文从 stdin 传进去（对齐上游：钩子可读 JSON 输入）
    try {
      const payload = JSON.stringify({
        hook_event_name: ctx.event,
        session_id: ctx.sessionId,
        cwd: ctx.cwd || process.cwd(),
        ...(ctx.payload || {}),
      })
      child.stdin?.end(payload)
    } catch {
      child.stdin?.end()
    }
  })
}

/**
 * 归一化 stdout，剥掉 shell 的引号包装。
 *
 * 实测：cmd.exe 的 `echo "{\"a\":1}"` 会把外层双引号**原样输出**，
 * 得到 `"{\"a\":1}"`；bash 的 `echo '{"a":1}'` 则输出 `'{"a":1}'`（单引号保留）。
 * 两种都不合法 JSON，但显然作者的意图是输出引号内的内容。
 * 这里剥掉一层成对引号，让跨 shell 的钩子都能工作。
 */
function normalizeStdout(text: string): string {
  let t = text.trim()
  for (const q of ['"', "'"]) {
    if (t.length >= 2 && t.startsWith(q) && t.endsWith(q)) {
      t = t.slice(1, -1).trim()
      break
    }
  }
  return t
}

/** stdout 是否看起来是钩子的 JSON 指令 */
function tryParseJson(text: string): Record<string, unknown> | null {
  const t = normalizeStdout(text)
  if (!t.startsWith('{') || !t.endsWith('}')) return null
  try {
    const v = JSON.parse(t)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * 把钩子的 JSON 输出翻译成结果语义。
 * 字段含义对齐上游：continue / decision / permissionDecision / systemMessage / additionalContext。
 */
function interpretJson(json: Record<string, unknown>, command: string, event: string): Partial<HookResult> {
  const result: Partial<HookResult> = {}

  if (json.continue === false) {
    result.preventContinuation = true
    if (typeof json.stopReason === 'string') result.stopReason = json.stopReason
  }

  if (typeof json.decision === 'string') {
    if (json.decision === 'approve' || json.decision === 'allow') {
      result.permissionBehavior = 'allow'
    } else if (json.decision === 'block' || json.decision === 'deny') {
      result.permissionBehavior = 'deny'
      result.blockingError = {
        blockingError: typeof json.reason === 'string' ? json.reason : '被钩子阻止',
        command,
      }
    }
  }

  if (typeof json.systemMessage === 'string') result.systemMessage = json.systemMessage
  if (typeof json.additionalContext === 'string') result.additionalContext = json.additionalContext

  // PreToolUse 专用裁决
  const specific = json.hookSpecificOutput as Record<string, unknown> | undefined
  if (specific && typeof specific === 'object') {
    const name = specific.hookEventName
    const decision = specific.permissionDecision
    if (name === event && typeof decision === 'string') {
      if (decision === 'allow') result.permissionBehavior = 'allow'
      else if (decision === 'deny') {
        result.permissionBehavior = 'deny'
        result.blockingError = {
          blockingError:
            typeof specific.permissionDecisionReason === 'string'
              ? specific.permissionDecisionReason
              : '被钩子阻止',
          command,
        }
      } else if (decision === 'ask') {
        result.permissionBehavior = 'ask'
      }
    }
  }

  return result
}

/** 合并多个钩子的结果 */
function mergeResults(results: Partial<HookResult>[]): HookResult {
  const merged: HookResult = {}
  const errors: string[] = []

  for (const r of results) {
    // 阻断优先：任何一个钩子要求阻止，整体就阻止
    if (r.preventContinuation) {
      merged.preventContinuation = true
      merged.stopReason = r.stopReason || merged.stopReason
    }
    // 裁决优先级：deny > ask > allow（拒绝不能被放行覆盖）
    if (r.permissionBehavior) {
      const rank = { deny: 3, ask: 2, allow: 1 } as const
      const cur = merged.permissionBehavior ? rank[merged.permissionBehavior] : 0
      if (rank[r.permissionBehavior] > cur) merged.permissionBehavior = r.permissionBehavior
    }
    if (r.blockingError) merged.blockingError = r.blockingError
    if (r.systemMessage) {
      merged.systemMessage = merged.systemMessage
        ? `${merged.systemMessage}\n${r.systemMessage}`
        : r.systemMessage
    }
    if (r.additionalContext) {
      merged.additionalContext = merged.additionalContext
        ? `${merged.additionalContext}\n${r.additionalContext}`
        : r.additionalContext
    }
    if (r.error) errors.push(r.error)
  }

  if (errors.length > 0) merged.error = errors.join('; ')
  return merged
}

export interface RunHooksOptions {
  onProgress?: (p: HookProgress) => void
}

/**
 * 执行某个事件下所有匹配的钩子（并行）。
 *
 * 永远不会抛异常 —— 钩子失败不该阻断主流程，失败信息通过 `result.error` 返回。
 */
export async function runHooks(ctx: HookContext, opts: RunHooksOptions = {}): Promise<HookResult> {
  let commands: Awaited<ReturnType<typeof getMatchingHooks>>
  try {
    commands = await getMatchingHooks(ctx)
  } catch (e) {
    return { error: `钩子配置读取失败: ${(e as Error).message}` }
  }
  if (commands.length === 0) return {}

  const defaultTimeout = ctx.event === 'SessionEnd' ? SESSION_END_HOOK_TIMEOUT_MS : DEFAULT_HOOK_TIMEOUT_MS

  const outcomes = await Promise.all(
    commands.map(async c => {
      const timeoutMs = c.timeout && c.timeout > 0 ? c.timeout * 1000 : defaultTimeout
      const out = await runCommand(c.command, timeoutMs, ctx, opts.onProgress)
      return { command: c.command, out }
    }),
  )

  const partials: Partial<HookResult>[] = []
  for (const { command, out } of outcomes) {
    if (out.timedOut) {
      partials.push({ error: `钩子超时（${command}）` })
      continue
    }

    const json = tryParseJson(out.stdout)
    if (json) {
      partials.push(interpretJson(json, command, ctx.event))
      continue
    }

    // 退出码语义：2 = 阻塞性错误（对齐上游）
    if (out.exitCode === 2) {
      partials.push({
        blockingError: {
          blockingError: out.stderr.trim() || out.stdout.trim() || '钩子以退出码 2 失败',
          command,
        },
      })
    } else if (out.exitCode !== 0 && out.exitCode !== null) {
      partials.push({
        error: `钩子退出码 ${out.exitCode}: ${out.stderr.trim().slice(0, 500) || command}`,
      })
    } else if (out.stdout.trim()) {
      // 无 JSON 且成功：把 stdout 当补充上下文（仅在显式需要时由调用方使用）
      partials.push({ additionalContext: out.stdout.trim() })
    }
  }

  return mergeResults(partials)
}

/**
 * 便捷入口：PreToolUse 钩子。
 * 返回的 `permissionBehavior === 'deny'` 表示应拒绝该工具调用。
 */
export function runPreToolUse(
  toolName: string,
  input: unknown,
  sessionId?: string,
  opts: RunHooksOptions = {},
): Promise<HookResult> {
  return runHooks(
    { event: 'PreToolUse', matchKey: toolName, sessionId, payload: { tool_name: toolName, tool_input: input } },
    opts,
  )
}

/** 便捷入口：PostToolUse / PostToolUseFailure */
export function runPostToolUse(
  toolName: string,
  input: unknown,
  result: unknown,
  success: boolean,
  sessionId?: string,
  opts: RunHooksOptions = {},
): Promise<HookResult> {
  return runHooks(
    {
      event: success ? 'PostToolUse' : 'PostToolUseFailure',
      matchKey: toolName,
      sessionId,
      payload: { tool_name: toolName, tool_input: input, tool_response: result },
    },
    opts,
  )
}

/** 便捷入口：UserPromptSubmit（可注入上下文或直接阻止） */
export function runUserPromptSubmit(
  prompt: string,
  sessionId?: string,
  opts: RunHooksOptions = {},
): Promise<HookResult> {
  return runHooks({ event: 'UserPromptSubmit', sessionId, payload: { prompt } }, opts)
}

/** 便捷入口：Stop（每轮结束时触发，可阻止继续） */
export function runStop(sessionId?: string, opts: RunHooksOptions = {}): Promise<HookResult> {
  return runHooks({ event: 'Stop', sessionId }, opts)
}
