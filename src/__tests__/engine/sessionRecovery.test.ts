/**
 * engine/sessionRecovery.test.ts — 会话恢复快照（崩溃/重启后对话不丢）
 *
 * 验证：
 * 1. save → load 往返（消息结构与 savedAt 保留）
 * 2. clear 删除快照
 * 3. 损坏/不存在的快照 load 返回 null（不抛）
 * 4. dir 覆盖下不同项目/会话不串
 */
import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  saveSessionSnapshot,
  loadSessionSnapshot,
  clearSessionSnapshot,
  sessionSnapshotPath,
} from '../../engine/sessionRecovery.ts'

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `sessrec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('engine/sessionRecovery 会话快照', () => {
  it('save 后可 load 回一致的消息与时间', async () => {
    const dir = makeTmpDir()
    try {
      const payload = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '我在' },
      ]
      await saveSessionSnapshot(payload, { dir })
      expect(existsSync(sessionSnapshotPath({ dir }))).toBe(true)

      const snap = await loadSessionSnapshot({ dir })
      expect(snap).not.toBeNull()
      expect(snap!.messages).toHaveLength(2)
      expect(snap!.messages[0]).toEqual({ role: 'user', content: '你好' })
      expect(snap!.savedAt).toBeTruthy()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('load 不存在返回 null', async () => {
    const dir = makeTmpDir()
    try {
      expect(await loadSessionSnapshot({ dir })).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('损坏的快照 load 返回 null（不抛）', async () => {
    const dir = makeTmpDir()
    try {
      const file = sessionSnapshotPath({ dir })
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, '{bad json', 'utf-8')
      expect(await loadSessionSnapshot({ dir })).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('clear 删除快照', async () => {
    const dir = makeTmpDir()
    try {
      await saveSessionSnapshot([{ role: 'user', content: 'x' }], { dir })
      expect(existsSync(sessionSnapshotPath({ dir }))).toBe(true)
      expect(await clearSessionSnapshot({ dir })).toBe(true)
      expect(existsSync(sessionSnapshotPath({ dir }))).toBe(false)
      // 再次 clear 返回 false（已不存在）
      expect(await clearSessionSnapshot({ dir })).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('不同 dir 互不影响（项目隔离）', async () => {
    const a = makeTmpDir()
    const b = makeTmpDir()
    try {
      await saveSessionSnapshot([{ role: 'user', content: 'A 项目' }], { dir: a })
      expect((await loadSessionSnapshot({ dir: b }))).toBeNull()
      expect((await loadSessionSnapshot({ dir: a }))!.messages[0].content).toBe('A 项目')
    } finally {
      rmSync(a, { recursive: true, force: true })
      rmSync(b, { recursive: true, force: true })
    }
  })
})