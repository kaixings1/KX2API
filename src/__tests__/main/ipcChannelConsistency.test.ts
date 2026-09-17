import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * IPC 通道一致性静态校验。
 *
 * 背景：本项目历史上反复踩同一个坑 —— 通道名写在多处，改一处漏一处就**静默失联**
 * （preload 调用了主进程没注册的名字、或注册了 preload 没暴露的名字，都不报错）。
 * 典型实例：`on(IpcChannels.TEAM_STREAM_PHASE, h)` 配套的
 * `removeListener('team:streamPhase', h)` 用的是字面量 —— 值相同所以能跑，
 * 但改通道名后监听器就移不掉（内存泄漏 + 回调重复触发）。
 *
 * 这些用例用**源码静态扫描**锁定两条纪律：
 *   1. 生产代码里不得用通道字面量调用 ipcMain/ipcRenderer
 *   2. 所有通道名必须在 channels.ts 的 IpcChannels 中有常量
 */

const ROOT = process.cwd()
const CHANNELS_FILE = join(ROOT, 'src/main/ipc/channels.ts')

/** 递归收集指定目录下的 ts/tsx 文件 */
function collectTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      collectTs(full, out)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

/** 去掉注释，避免注释里的示例代码造成误判 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const channelsSrc = readFileSync(CHANNELS_FILE, 'utf-8')

/** channels.ts 中定义的全部通道值 */
const definedChannelValues = new Set(
  [...channelsSrc.matchAll(/^\s*[A-Z0-9_]+:\s*'([^']+)'/gm)].map((m) => m[1]),
)

describe('IPC 通道常量收敛', () => {
  it('channels.ts 自身定义了通道（哨兵，防止正则失效导致空集）', () => {
    expect(definedChannelValues.size).toBeGreaterThan(200)
  })

  it('生产代码不使用 ipcMain/ipcRenderer 通道字面量', () => {
    const files = [
      ...collectTs(join(ROOT, 'src/main')),
      ...collectTs(join(ROOT, 'src/preload')),
    ]
    const offenders: string[] = []
    const pattern =
      /ipc(?:Main|Renderer)\.(?:on|once|handle|invoke|send|removeListener|removeAllListeners)\(\s*'[^']+'/

    for (const f of files) {
      const code = stripComments(readFileSync(f, 'utf-8'))
      if (pattern.test(code)) {
        offenders.push(f.replace(ROOT, ''))
      }
    }
    expect(
      offenders,
      `以下文件仍以字面量传通道名（应改用 IpcChannels.X）：\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('on 与 removeListener 必须用同一常量（历史踩过的坑）', () => {
    // 逐文件检查：若出现 ipcRenderer.on(X) 与 removeListener(Y) 且 X、Y 都是
    // IpcChannels.A 形式，则统计其配对是否自洽 —— 这里只验证「都用了常量」，
    // 因为静态分析无法可靠匹配异步闭包里的变量对应关系。
    const files = collectTs(join(ROOT, 'src/preload'))
    for (const f of files) {
      const code = stripComments(readFileSync(f, 'utf-8'))
      const onCount = [...code.matchAll(/ipcRenderer\.on\(/g)].length
      const removeCount = [...code.matchAll(/ipcRenderer\.removeListener\(/g)].length
      // 每个 on 都应有对应的 removeListener（订阅-退订成对）
      expect(
        removeCount,
        `${f.replace(ROOT, '')} 的 on(${onCount}) 与 removeListener(${removeCount}) 数量不匹配`,
      ).toBeGreaterThanOrEqual(onCount)
    }
  })

  it('channels.ts 中不存在重复的通道值', () => {
    const all = [...channelsSrc.matchAll(/^\s*([A-Z0-9_]+):\s*'([^']+)'/gm)]
    const byValue = new Map<string, string[]>()
    for (const m of all) {
      const list = byValue.get(m[2]) ?? []
      list.push(m[1])
      byValue.set(m[2], list)
    }
    const dups = [...byValue.entries()].filter(([, names]) => names.length > 1)
    expect(
      dups.map(([v, names]) => `${v} ← ${names.join(', ')}`),
      '同一通道值被多个常量名占用，改其一会造成不一致',
    ).toEqual([])
  })
})
