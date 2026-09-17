/**
 * engine/memory/memoryToolRecall.test.ts — memoryTool 与记忆系统目录统一后的闭环验证
 *
 * 背景：memoryTool 原先写死到 `./memory_storage/memories`，与记忆召回系统
 * （resolveMemoryDir() → `<homedir>/.doge/projects/<编码>/memory`）完全脱节，
 * 模型用 memory_create 写入的记忆召回系统永远读不到。
 *
 * 本测试断言：
 * 1. 默认构造的落盘根 === resolveMemoryDir()（目录统一）
 * 2. memory_create 写入带 frontmatter 的记忆后，recallMemories 在同一目录能召回
 * 3. 逃逸防护仍有效（../ 无法逃出 memory 根）
 */
import { describe, it, expect } from 'vitest'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { MemoryToolHandler } from '../../memory/memoryTool.ts'
import { resolveMemoryDir, recallMemories } from '../../engine/memory/memoryRecall.ts'

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `memorytool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('memoryTool 目录统一（与记忆系统闭环）', () => {
  it('默认构造的落盘根等于 resolveMemoryDir()', () => {
    const handler = new MemoryToolHandler()
    expect(handler.root).toBe(resolveMemoryDir())
  })

  it('memory_create 写入的记忆能被 recallMemories 召回（同一目录）', async () => {
    const tmp = makeTmpDir()
    const handler = new MemoryToolHandler(tmp)
    const memoryDir = path.join(tmp, 'memories')

    try {
      const created = handler.execute({
        command: 'create',
        path: '/memories/user-preference.md',
        file_text:
          '---\nname: 用户偏好\ndescription: 用户报告时习惯 cc 全部相关方\ntype: feedback\n---\n用户要求所有工作报告同时抄送技术负责人。',
      })
      expect(created).toEqual({ success: expect.stringContaining('已创建') })
      expect(existsSync(path.join(memoryDir, 'user-preference.md'))).toBe(true)

      // 同一 memoryDir 召回，应命中「报告偏好」相关记忆
      const recalled = await recallMemories('报告偏好', { memoryDir })
      expect(recalled.length).toBeGreaterThan(0)
      expect(recalled[0].name).toBe('用户偏好')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('逃逸路径被拦截（../ 不能写出 memory 根）', () => {
    const tmp = makeTmpDir()
    const handler = new MemoryToolHandler(tmp)
    try {
      const res = handler.execute({
        command: 'create',
        path: '/memories/../../etc/evil.md',
        file_text: 'x',
      })
      expect(res).toHaveProperty('error')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})