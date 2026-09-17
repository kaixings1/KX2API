import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 日志页接入「应用日志」Tab 的验证。
 *
 * 背景：`components/logs/` 下有五个**应用日志**组件（LogList/LogDetail/
 * LogFilter/LogStats/LogRow）+ `logsStore`，但 `index.ts` **从未导出它们** ——
 * 页面只展示请求日志。应用日志虽有完整后端（8 个 LOGS_* 通道）与 preload 暴露，
 * 用户却看不到。
 *
 * 说明：项目未安装 `@testing-library/react`，所以这里用
 * **静态断言 + store 逻辑测试**代替 DOM 渲染测试。
 */
const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

describe('logs 组件导出完整性', () => {
  const indexSrc = read('src/renderer/src/components/logs/index.ts')

  it('应用日志组件已从 index 导出', () => {
    for (const name of ['LogList', 'LogDetail', 'LogFilter', 'LogStats', 'LogRow']) {
      expect(indexSrc, `${name} 未导出`).toContain(`export { ${name} }`)
    }
  })

  it('请求日志组件仍保留（未因改动而丢失）', () => {
    for (const name of ['RequestLogList', 'RequestLogDetail', 'RequestLogStats']) {
      expect(indexSrc).toContain(`export { ${name} }`)
    }
  })

  it('这些组件文件真实存在（避免导出指向不存在的文件）', () => {
    const files = read('src/renderer/src/components/logs/index.ts')
    const names = [...files.matchAll(/export \{ \w+ \} from '\.\/(\w+)'/g)].map(m => m[1])
    expect(names.length).toBeGreaterThanOrEqual(5)
    for (const n of names) {
      expect(
        () => read(`src/renderer/src/components/logs/${n}.tsx`),
        `导出指向的 ${n}.tsx 不存在`,
      ).not.toThrow()
    }
  })
})

describe('Logs 页面接入应用日志 Tab', () => {
  const pageSrc = read('src/renderer/src/pages/Logs.tsx')

  it('页面引用了应用日志组件', () => {
    expect(pageSrc).toContain('LogList')
    expect(pageSrc).toContain('LogFilter')
    expect(pageSrc).toContain('LogStats')
  })

  it('存在 app Tab 的触发器与内容', () => {
    expect(pageSrc).toContain('value="app"')
  })

  it('Tab 列表列数与实际 Tab 数一致（避免布局错位）', () => {
    // 三个 tab：list / stats / app
    expect(pageSrc).toContain('grid-cols-3')
  })

  it('切到 app Tab 时会主动拉数据', () => {
    // 组件自身不加载数据（LogList 只在滚动时 loadMore），
    // 不在页面里触发 refresh 界面就是空的
    expect(pageSrc).toContain('refreshLogs')
    expect(pageSrc).toMatch(/activeTab === 'app'/)
  })

  it('URL tab 参数经白名单校验（防非法值导致页面空白）', () => {
    expect(pageSrc).toContain('TAB_VALUES')
    expect(pageSrc).toContain("new Set(['list', 'stats', 'app'])")
  })
})

describe('logsStore 数据契约', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('refresh 会调用 logs.get / getStats / getTrend', async () => {
    const get = vi.fn().mockResolvedValue([])
    const getStats = vi.fn().mockResolvedValue({ total: 0, info: 0, warn: 0, error: 0, debug: 0 })
    const getTrend = vi.fn().mockResolvedValue([])
    const g = globalThis as Record<string, unknown>
    const prev = g.window
    g.window = { electronAPI: { logs: { get, getStats, getTrend } } }

    try {
      const { useLogsStore } = await import('../../renderer/src/stores/logsStore')
      await useLogsStore.getState().refresh()
      expect(get).toHaveBeenCalled()
      expect(getStats).toHaveBeenCalled()
      expect(getTrend).toHaveBeenCalled()
    } finally {
      g.window = prev
    }
  })

  it('electronAPI 缺失时不抛错', async () => {
    const g = globalThis as Record<string, unknown>
    const prev = g.window
    g.window = {}
    try {
      const { useLogsStore } = await import('../../renderer/src/stores/logsStore')
      await expect(useLogsStore.getState().refresh()).resolves.toBeUndefined()
    } finally {
      g.window = prev
    }
  })
})
