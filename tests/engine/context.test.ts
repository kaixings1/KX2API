/**
 * engine/context 模块测试
 *
 * 覆盖 claudeMd 工具链、systemContext 平台信息、userContext 缓存语义。
 * 含真实缺陷回归：
 *   1. isEnvTruthy 未 trim —— `' false '` 会被判为真
 *   2. getUserContext 返回缓存对象引用 —— 调用方改动会污染后续 5 分钟的所有调用
 *
 * 运行：node --import tsx --test tests/engine/context.test.ts
 */
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  isBareMode,
  getAdditionalDirectoriesForClaudeMd,
  isEnvTruthy,
  filterInjectedMemoryFiles,
  setCachedClaudeMdContent,
  getCachedClaudeMdContent,
  getCachedClaudeMdPath,
} from '../../src/engine/context/claudeMd.ts'
import { getPlatformShellInfo, getSessionEpoch, getSystemContext } from '../../src/engine/context/systemContext.ts'
import { getUserContext, clearUserContextCache } from '../../src/engine/context/userContext.ts'

describe('claudeMd — 环境判定', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ['CLAUDE_CODE_DISABLE_CLAUDE_MDS', 'CLAUDE_CODE_BARE_MODE', 'CLAUDE_CODE_ADDITIONAL_CLAUDE_MD_DIRS', 'TEST_TRUTHY']) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  test('无环境变量时非 bare 模式', () => {
    assert.equal(isBareMode(), false)
  })

  test('CLAUDE_CODE_DISABLE_CLAUDE_MDS 触发 bare 模式', () => {
    process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1'
    assert.equal(isBareMode(), true)
  })

  test('CLAUDE_CODE_BARE_MODE=1 触发 bare 模式', () => {
    process.env.CLAUDE_CODE_BARE_MODE = '1'
    assert.equal(isBareMode(), true)
  })

  test('getAdditionalDirectoriesForClaudeMd 未设置返回空数组', () => {
    assert.deepEqual(getAdditionalDirectoriesForClaudeMd(), [])
  })

  test('getAdditionalDirectoriesForClaudeMd 逗号分隔并去空', () => {
    process.env.CLAUDE_CODE_ADDITIONAL_CLAUDE_MD_DIRS = '/a, /b ,, /c'
    assert.deepEqual(getAdditionalDirectoriesForClaudeMd(), ['/a', '/b', '/c'])
  })
})

describe('isEnvTruthy — 真值判定', () => {
  afterEach(() => delete process.env.TEST_TRUTHY)

  test('未设置返回 false', () => {
    assert.equal(isEnvTruthy('TEST_TRUTHY'), false)
  })

  test('常见真值', () => {
    for (const v of ['1', 'true', 'yes', 'on', 'TRUE', 'Yes']) {
      process.env.TEST_TRUTHY = v
      assert.equal(isEnvTruthy('TEST_TRUTHY'), true, `${v} 应为真`)
    }
  })

  test('常见假值', () => {
    for (const v of ['0', 'false', 'no', 'off', 'FALSE', 'Off']) {
      process.env.TEST_TRUTHY = v
      assert.equal(isEnvTruthy('TEST_TRUTHY'), false, `${v} 应为假`)
    }
  })

  test('带空白的假值也应判为假（回归：未 trim）', () => {
    for (const v of [' false ', '\t0', ' off']) {
      process.env.TEST_TRUTHY = v
      assert.equal(isEnvTruthy('TEST_TRUTHY'), false, `${JSON.stringify(v)} 应判为假`)
    }
  })

  test('带空白的真值仍为真', () => {
    process.env.TEST_TRUTHY = ' true '
    assert.equal(isEnvTruthy('TEST_TRUTHY'), true)
  })
})

describe('filterInjectedMemoryFiles', () => {
  test('过滤掉 scope 含 injected 的文件', () => {
    const files = [
      { path: 'a', content: 'A', scope: 'injected:system' },
      { path: 'b', content: 'B', scope: 'user' },
      { path: 'c', content: 'C' },
    ] as never[]
    const out = filterInjectedMemoryFiles(files)
    assert.equal(out.length, 2)
    assert.deepEqual(out.map((f) => f.path), ['b', 'c'])
  })
})

describe('CLAUDE.md 内容缓存', () => {
  test('setCachedClaudeMdContent 与读取一致', () => {
    setCachedClaudeMdContent('# 项目说明', '/repo/CLAUDE.md')
    assert.equal(getCachedClaudeMdContent(), '# 项目说明')
    assert.equal(getCachedClaudeMdPath(), '/repo/CLAUDE.md')
  })

  test('不传 path 时 path 为 null', () => {
    setCachedClaudeMdContent('content')
    assert.equal(getCachedClaudeMdPath(), null)
  })

  test('可清空缓存', () => {
    setCachedClaudeMdContent('x')
    setCachedClaudeMdContent(null)
    assert.equal(getCachedClaudeMdContent(), null)
  })
})

describe('systemContext — 平台信息', () => {
  test('getPlatformShellInfo 返回非空字符串', () => {
    const info = getPlatformShellInfo()
    assert.ok(typeof info === 'string' && info.length > 0)
    // 当前测试环境为 win32
    assert.ok(/win32|darwin|linux/.test(info), `实际：${info}`)
  })

  test('getSessionEpoch 默认 0', () => {
    const saved = (globalThis as { sessionEpoch?: number }).sessionEpoch
    delete (globalThis as { sessionEpoch?: number }).sessionEpoch
    assert.equal(getSessionEpoch(), 0)
    if (saved !== undefined) (globalThis as { sessionEpoch?: number }).sessionEpoch = saved
  })

  test('getSessionEpoch 读取全局值', () => {
    ;(globalThis as { sessionEpoch?: number }).sessionEpoch = 5
    assert.equal(getSessionEpoch(), 5)
    ;(globalThis as { sessionEpoch?: number }).sessionEpoch = 0
  })

  test('getSystemContext 组装完整结构', async () => {
    const ctx = await getSystemContext()
    assert.ok('gitStatus' in ctx)
    assert.ok('platformShell' in ctx)
    assert.equal(typeof ctx.sessionEpoch, 'number')
    assert.ok('injection' in ctx)
  })
})

describe('userContext — 缓存语义', () => {
  beforeEach(() => {
    clearUserContextCache()
    setCachedClaudeMdContent(null)
  })

  test('返回结构含 claudeMd 与 currentDate', async () => {
    const ctx = await getUserContext()
    assert.ok('claudeMd' in ctx)
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(ctx.currentDate), `日期格式：${ctx.currentDate}`)
  })

  test('缓存命中返回相同内容', async () => {
    setCachedClaudeMdContent('# 内容')
    const a = await getUserContext()
    const b = await getUserContext()
    assert.equal(a.claudeMd, '# 内容')
    assert.equal(b.claudeMd, '# 内容')
  })

  test('调用方修改返回值不得污染缓存（回归：返回同一引用）', async () => {
    setCachedClaudeMdContent('# 原始')
    const a = await getUserContext()
    a.claudeMd = '# 被篡改'
    const b = await getUserContext()
    assert.equal(b.claudeMd, '# 原始', '缓存结果不应被调用方改动污染')
  })

  test('clearUserContextCache 后重新计算', async () => {
    setCachedClaudeMdContent('# 第一版')
    assert.equal((await getUserContext()).claudeMd, '# 第一版')
    setCachedClaudeMdContent('# 第二版')
    // 未清缓存时仍是第一版
    assert.equal((await getUserContext()).claudeMd, '# 第一版')
    clearUserContextCache()
    assert.equal((await getUserContext()).claudeMd, '# 第二版')
  })

  test('缓存未命中时应真正读到项目 CLAUDE.md（回归：原链路双重失效）', async () => {
    // 原实现有双重失效：includes 闸门恒假 + getMemoryFiles 是空壳，
    // 导致「用户上下文」永远拿不到 CLAUDE.md。现在改用 claudeMdLoader，
    // 在本仓库（存在 CLAUDE.md）下应当能读到内容。
    clearUserContextCache()
    setCachedClaudeMdContent(null)
    const ctx = await getUserContext()
    assert.ok(
      ctx.claudeMd && ctx.claudeMd.length > 0,
      '应通过 claudeMdLoader 读到项目 CLAUDE.md，实际为空',
    )
  })

  test('bare 模式下不读取 CLAUDE.md', async () => {
    const saved = process.env.CLAUDE_CODE_BARE_MODE
    process.env.CLAUDE_CODE_BARE_MODE = '1'
    clearUserContextCache()
    setCachedClaudeMdContent(null)
    const ctx = await getUserContext()
    assert.equal(ctx.claudeMd, null, 'bare 模式应跳过指令加载')
    if (saved === undefined) delete process.env.CLAUDE_CODE_BARE_MODE
    else process.env.CLAUDE_CODE_BARE_MODE = saved
  })
})
