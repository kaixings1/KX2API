import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  setHooksConfigPath,
  loadHooksConfig,
  getMatchingHooks,
  hasHooksFor,
  clearHooksConfigCache,
  runHooks,
  runPreToolUse,
  killProcessTree,
  resolveHookShell,
  DEFAULT_HOOK_TIMEOUT_MS,
} from '../../main/hooks'

/**
 * 钩子引擎的核心契约：
 *   1. matcher 按事件语义匹配（工具名正则）
 *   2. 多个钩子并行执行，结果按优先级合并（deny > ask > allow）
 *   3. 超时后整棵进程树被杀
 *   4. 配置损坏 / 钩子失败都不阻断主流程
 *
 * ⚠️ 测试命令一律通过「生成临时 node 脚本 + 用 node 执行」的方式构造，
 * 不用 echo / sleep —— 这两者在 cmd.exe 与 bash 下行为不同
 * （cmd 的 echo 会保留外层引号、没有 sleep），会让测试随 shell 变化而假失败。
 */

let dir: string
let cfgPath: string
let seq = 0

/** 写一个临时 node 脚本，返回可直接执行的命令 */
async function makeScript(body: string): Promise<string> {
  const file = path.join(dir, `hook-${seq++}.cjs`)
  await fs.writeFile(file, body, 'utf-8')
  // 用正斜杠，避免不同 shell 对反斜杠的转义差异
  return `node "${file.replace(/\\/g, '/')}"`
}

/** 输出一行 JSON 后退出 */
function jsonCmd(obj: Record<string, unknown>): Promise<string> {
  return makeScript(`process.stdout.write(${JSON.stringify(JSON.stringify(obj))})`)
}

/** 输出到 stderr 并以指定退出码结束 */
function failCmd(code: number, msg = 'failed'): Promise<string> {
  return makeScript(`process.stderr.write(${JSON.stringify(msg)}); process.exit(${code})`)
}

/** 睡眠指定毫秒 */
function sleepCmd(ms: number): Promise<string> {
  return makeScript(`setTimeout(() => {}, ${ms})`)
}

async function writeCfg(hooks: Record<string, unknown>): Promise<void> {
  await fs.writeFile(cfgPath, JSON.stringify({ hooks }), 'utf-8')
  clearHooksConfigCache()
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-hooks-'))
  cfgPath = path.join(dir, 'hooks.json')
  setHooksConfigPath(cfgPath)
})

afterAll(async () => {
  setHooksConfigPath(null)
  await fs.rm(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  // 每个用例前重置配置路径。
  // 有个用例会故意把路径指向不存在的文件，若不在此恢复，
  // 该状态会泄漏到后续用例 —— 并发压力下会表现为大面积随机失败。
  setHooksConfigPath(cfgPath)
  await fs.writeFile(cfgPath, JSON.stringify({ hooks: {} }), 'utf-8')
  clearHooksConfigCache()
})

describe('shell 解析', () => {
  it('返回可用的 shell 描述（字符串路径或 true 表示默认 shell）', () => {
    const s = resolveHookShell()
    expect(s === true || typeof s === 'string').toBe(true)
  })

  it('默认超时常量符合上游口径', () => {
    expect(DEFAULT_HOOK_TIMEOUT_MS).toBe(10_000)
  })
})

describe('配置加载与清洗', () => {
  it('配置文件不存在时返回空配置（不抛错）', async () => {
    setHooksConfigPath(path.join(dir, '__nope__.json'))
    expect(await loadHooksConfig()).toEqual({ hooks: {} })
    setHooksConfigPath(cfgPath)
  })

  it('JSON 损坏时降级为空配置', async () => {
    await fs.writeFile(cfgPath, '{ 这不是合法 JSON', 'utf-8')
    clearHooksConfigCache()
    expect(await loadHooksConfig()).toEqual({ hooks: {} })
  })

  it('配置路径未设置时返回空配置且形状一致', async () => {
    setHooksConfigPath(null)
    expect(await loadHooksConfig()).toEqual({ hooks: {} })
    setHooksConfigPath(cfgPath)
  })

  it('未知事件名被忽略且不影响其它事件', async () => {
    await writeCfg({
      PreToolUse: [{ hooks: [{ type: 'command', command: 'node -v' }] }],
      NoSuchEvent: [{ hooks: [{ type: 'command', command: 'node -v' }] }],
    })
    const cfg = await loadHooksConfig()
    expect(cfg.hooks?.PreToolUse).toBeDefined()
    expect((cfg.hooks as Record<string, unknown>).NoSuchEvent).toBeUndefined()
  })

  it('缺少 command 或 type 不合法时该条被剔除', async () => {
    await writeCfg({
      PreToolUse: [
        { hooks: [{ type: 'command', command: '' }] },
        { hooks: [{ type: 'command', command: 'node -v' }] },
        { hooks: [{ type: 'http', command: 'node -v' }] },
      ],
    })
    const cfg = await loadHooksConfig()
    expect(cfg.hooks?.PreToolUse).toHaveLength(1)
  })
})

describe('matcher 匹配', () => {
  it('正则匹配工具名（忽略大小写）', async () => {
    await writeCfg({
      PreToolUse: [{ matcher: 'bash|shell', hooks: [{ type: 'command', command: 'node -v' }] }],
    })
    expect(await getMatchingHooks({ event: 'PreToolUse', matchKey: 'Bash' })).toHaveLength(1)
    expect(await getMatchingHooks({ event: 'PreToolUse', matchKey: 'shell' })).toHaveLength(1)
    expect(await getMatchingHooks({ event: 'PreToolUse', matchKey: 'read_file' })).toHaveLength(0)
  })

  it('matcher 为空或 * 时匹配该事件全部触发', async () => {
    await writeCfg({
      PreToolUse: [{ hooks: [{ type: 'command', command: 'node -v' }] }],
      Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'node -v' }] }],
    })
    expect(await getMatchingHooks({ event: 'PreToolUse', matchKey: 'anything' })).toHaveLength(1)
    expect(await getMatchingHooks({ event: 'Stop' })).toHaveLength(1)
  })

  it('matcher 不是合法正则时按匹配全部处理', async () => {
    await writeCfg({
      PreToolUse: [{ matcher: '[unclosed', hooks: [{ type: 'command', command: 'node -v' }] }],
    })
    expect(await getMatchingHooks({ event: 'PreToolUse', matchKey: 'whatever' })).toHaveLength(1)
  })

  it('未配置的事件返回空', async () => {
    expect(await getMatchingHooks({ event: 'SessionStart' })).toEqual([])
  })

  it('hasHooksFor 反映配置状态', async () => {
    expect(await hasHooksFor('PreToolUse')).toBe(false)
    await writeCfg({ PreToolUse: [{ hooks: [{ type: 'command', command: 'node -v' }] }] })
    expect(await hasHooksFor('PreToolUse')).toBe(true)
  })
})

describe('执行与结果语义', () => {
  it('无匹配钩子时返回空结果', async () => {
    expect(await runHooks({ event: 'PreToolUse', matchKey: 'nope' })).toEqual({})
  })

  it('decision:deny → permissionBehavior=deny + blockingError', async () => {
    await writeCfg({
      PreToolUse: [
        { matcher: 'bash', hooks: [{ type: 'command', command: await jsonCmd({ decision: 'deny', reason: '禁止 shell' }) }] },
      ],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.permissionBehavior).toBe('deny')
    expect(r.blockingError?.blockingError).toContain('禁止 shell')
  })

  it('hookSpecificOutput.permissionDecision 被识别', async () => {
    await writeCfg({
      PreToolUse: [
        {
          matcher: 'bash',
          hooks: [
            {
              type: 'command',
              command: await jsonCmd({
                hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
              }),
            },
          ],
        },
      ],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.permissionBehavior).toBe('allow')
  })

  it('continue:false → preventContinuation + stopReason', async () => {
    await writeCfg({
      Stop: [
        { hooks: [{ type: 'command', command: await jsonCmd({ continue: false, stopReason: '检查未通过' }) }] },
      ],
    })
    const r = await runHooks({ event: 'Stop' })
    expect(r.preventContinuation).toBe(true)
    expect(r.stopReason).toBe('检查未通过')
  })

  it('additionalContext / systemMessage 被保留', async () => {
    await writeCfg({
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command: await jsonCmd({ additionalContext: '补充信息' }) }] },
      ],
    })
    const r = await runHooks({ event: 'UserPromptSubmit', payload: { prompt: 'x' } })
    expect(r.additionalContext).toBe('补充信息')
  })

  it('多个钩子结果按优先级合并：deny 压过 allow', async () => {
    await writeCfg({
      PreToolUse: [
        {
          matcher: 'bash',
          hooks: [
            {
              type: 'command',
              command: await jsonCmd({
                hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
              }),
            },
            { type: 'command', command: await jsonCmd({ decision: 'deny', reason: '另一钩子拒绝' }) },
          ],
        },
      ],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.permissionBehavior).toBe('deny')
  })

  it('多个钩子的 additionalContext 被拼接而非覆盖', async () => {
    await writeCfg({
      UserPromptSubmit: [
        {
          hooks: [
            { type: 'command', command: await jsonCmd({ additionalContext: 'A' }) },
            { type: 'command', command: await jsonCmd({ additionalContext: 'B' }) },
          ],
        },
      ],
    })
    const r = await runHooks({ event: 'UserPromptSubmit' })
    expect(r.additionalContext).toContain('A')
    expect(r.additionalContext).toContain('B')
  })

  it('退出码 2 视为阻塞性错误', async () => {
    await writeCfg({
      PreToolUse: [{ matcher: 'bash', hooks: [{ type: 'command', command: await failCmd(2, '被拦下') }] }],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.blockingError).toBeDefined()
    expect(r.blockingError?.blockingError).toContain('被拦下')
  })

  it('其它非零退出码记为非阻塞错误，不阻断', async () => {
    await writeCfg({
      PreToolUse: [{ matcher: 'bash', hooks: [{ type: 'command', command: await failCmd(1, '出错了') }] }],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.blockingError).toBeUndefined()
    expect(r.error).toBeTruthy()
  })

  it('成功但输出非 JSON 时作为 additionalContext', async () => {
    await writeCfg({
      Stop: [{ hooks: [{ type: 'command', command: await makeScript('process.stdout.write("普通文本输出")') }] }],
    })
    const r = await runHooks({ event: 'Stop' })
    expect(r.additionalContext).toContain('普通文本输出')
  })

  it('命令不存在时不抛异常，记为错误', async () => {
    await writeCfg({
      PreToolUse: [
        { matcher: 'bash', hooks: [{ type: 'command', command: 'this_command_does_not_exist_xyz' }] },
      ],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.error).toBeTruthy()
  })
})

describe('超时与进程树终止', () => {
  it('超时后返回超时错误而非永久挂起', async () => {
    await writeCfg({
      // timeout 单位为秒，取最小值 1；脚本睡 30 秒
      Stop: [{ hooks: [{ type: 'command', command: await sleepCmd(30_000), timeout: 1 }] }],
    })
    const t0 = Date.now()
    const r = await runHooks({ event: 'Stop' })
    const elapsed = Date.now() - t0
    expect(r.error).toContain('超时')
    expect(elapsed).toBeLessThan(8000)
  }, 30_000)

  it('killProcessTree 对无效 pid 安全', () => {
    expect(() => killProcessTree(undefined)).not.toThrow()
    expect(() => killProcessTree(0)).not.toThrow()
    expect(() => killProcessTree(999_999)).not.toThrow()
  })
})

describe('健壮性', () => {
  it('配置路径未设置时不崩', async () => {
    setHooksConfigPath(null)
    expect(await runHooks({ event: 'Stop' })).toEqual({})
    setHooksConfigPath(cfgPath)
  })

  it('钩子失败不影响其它钩子生效', async () => {
    await writeCfg({
      PreToolUse: [
        {
          matcher: 'bash',
          hooks: [
            { type: 'command', command: 'nonexistent_cmd_abc' },
            { type: 'command', command: await jsonCmd({ decision: 'deny', reason: '仍然生效' }) },
          ],
        },
      ],
    })
    const r = await runPreToolUse('bash', {})
    expect(r.permissionBehavior).toBe('deny')
  })

  it('并行执行：三个 500ms 钩子总耗时接近单个', async () => {
    const [a, b, c] = await Promise.all([sleepCmd(500), sleepCmd(500), sleepCmd(500)])
    await writeCfg({
      Stop: [
        {
          hooks: [
            { type: 'command', command: a, timeout: 15 },
            { type: 'command', command: b, timeout: 15 },
            { type: 'command', command: c, timeout: 15 },
          ],
        },
      ],
    })
    const t0 = Date.now()
    await runHooks({ event: 'Stop' })
    const elapsed = Date.now() - t0
    // 串行会是 1500ms+；并行（含 node 启动开销）应明显更短
    expect(elapsed).toBeLessThan(1300)
  }, 30_000)

  it('onProgress 回调被触发', async () => {
    await writeCfg({
      Stop: [{ hooks: [{ type: 'command', command: await makeScript('process.stdout.write("done")') }] }],
    })
    const seen: string[] = []
    await runHooks({ event: 'Stop' }, { onProgress: p => seen.push(p.command) })
    expect(seen.length).toBeGreaterThan(0)
  })
})
