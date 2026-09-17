/**
 * engine/transcript.test.ts — 会话转录（压缩前原文快照）
 *
 * 验证：
 * 1. writeSessionTranscriptSegment 把消息落盘到指定目录且逐行可解析为 JSON
 * 2. flushOnDateChange 落到指定日期的文件并用 flushed 标记
 * 3. 空消息不产生文件；sessionId 影响文件名
 */
import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { writeSessionTranscriptSegment, flushOnDateChange } from '../../engine/transcript.ts'

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `trx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('engine/transcript 会话转录', () => {
  it('写入的消息逐行 JSON 可解析，role/content 保留', () => {
    const dir = makeTmpDir()
    writeSessionTranscriptSegment(
      [
        { role: 'user', content: '帮我看看这个文件' },
        { role: 'assistant', content: '好的，正在查看' },
      ],
      { dir, sessionId: 'sess-a' },
    )

    const date = new Date().toISOString().slice(0, 10)
    const file = path.join(dir, `sess-a-${date}.jsonl`)
    expect(existsSync(file)).toBe(true)

    const lines = readFileSync(file, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(2)
    const first = JSON.parse(lines[0])
    expect(first.role).toBe('user')
    expect(first.content).toBe('帮我看看这个文件')
    expect(first.sessionId).toBe('sess-a')
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 清理失败不影响断言 */
    }
  })

  it('empty messages 不产生文件', () => {
    const dir = makeTmpDir()
    writeSessionTranscriptSegment([], { dir, sessionId: 'x' })
    expect(readdirSync(dir).length).toBe(0)
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* noop */
    }
  })

  it('flushOnDateChange 落到指定日期且带 flushed 标记', () => {
    const dir = makeTmpDir()
    flushOnDateChange(
      [{ role: 'user', content: '跨天补刷' }],
      '2026-01-02',
      { dir, sessionId: 'sess' },
    )
    const file = path.join(dir, 'sess-2026-01-02.jsonl')
    expect(existsSync(file)).toBe(true)
    const parsed = JSON.parse(readFileSync(file, 'utf-8').trim().split('\n')[0])
    expect(parsed.flushed).toBe(true)
    expect(parsed.content).toBe('跨天补刷')
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* noop */
    }
  })
})