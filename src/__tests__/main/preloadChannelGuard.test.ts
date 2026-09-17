import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * preload 通用通道白名单的静态校验。
 *
 * 背景：preload 曾暴露通用 `on/send/invoke(channel, ...)`，**绕过整个白名单** ——
 * 渲染层一旦被注入脚本（XSS / 恶意 markdown / 被污染的模型输出），
 * 就能触达主进程全部 269 个 channel，包括文件读写、命令执行等高权限接口。
 *
 * 现改为白名单校验。这些用例锁定该约束，防止有人为了方便又改回「任意通道」。
 *
 * 说明：这里做的是**源码静态断言**而非运行时测试 ——
 * preload 依赖 electron 的 contextBridge，在 vitest 环境无法直接 import。
 */
const preloadSrc = readFileSync(
  join(process.cwd(), 'src/preload/index.ts'),
  'utf-8',
)

describe('preload 通用通道白名单', () => {
  it('存在白名单校验函数', () => {
    expect(preloadSrc).toContain('function assertAllowedChannel')
  })

  it('on / send / invoke 三个入口都走校验', () => {
    // 去掉注释与字符串，避免注释里的示例代码造成误判
    const code = preloadSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const via of ['on', 'send', 'invoke'] as const) {
      expect(code).toContain(`assertAllowedChannel(channel, '${via}')`)
    }
  })

  it('校验失败时抛错而非静默忽略', () => {
    // 静默忽略会让调用方以为订阅成功、实际收不到事件，排查成本更高
    expect(preloadSrc).toContain('throw err')
  })

  it('白名单默认为空（渲染层已全部改用专用 API）', () => {
    const exact = /GENERIC_ALLOWED_EXACT = new Set<string>\(\[([\s\S]*?)\]\)/.exec(preloadSrc)
    expect(exact).not.toBeNull()
    // 集合里不含任何 'xxx' 形式的字符串字面量
    expect(exact![1]).not.toMatch(/'[^']+'/)

    const prefixes = /GENERIC_ALLOWED_PREFIXES: readonly string\[\] = \[([\s\S]*?)\]/.exec(preloadSrc)
    expect(prefixes).not.toBeNull()
    expect(prefixes![1]).not.toMatch(/'[^']+'/)
  })
})

describe('渲染层不使用通用逃逸口', () => {
  /** 递归收集 renderer 下的 ts/tsx 源码 */
  function collect(dir: string, out: string[] = []): string[] {
    // 用 fs 直接读目录，避免引入额外依赖
    const fs = require('node:fs') as typeof import('node:fs')
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) collect(full, out)
      else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
    return out
  }

  it('没有 electronAPI.invoke / send / on 的直接调用', () => {
    const files = collect(join(process.cwd(), 'src/renderer'))
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      // 去掉注释后检查
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      if (/electronAPI\.(invoke|send|on)\s*\(/.test(code)) {
        offenders.push(f.replace(process.cwd(), ''))
      }
    }
    expect(offenders, `以下文件仍在使用通用逃逸口：\n${offenders.join('\n')}`).toEqual([])
  })
})
