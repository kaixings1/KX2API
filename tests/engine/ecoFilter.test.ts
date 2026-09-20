/**
 * tests/engine/ecoFilter.test.ts — ecoFilter Bash 输出压缩测试
 *
 * 运行：node --import tsx --test tests/engine/ecoFilter.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  ecoCompress,
  setEcoEnabled,
  isEcoEnabled,
  resetEcoStats,
  getEcoStats,
} from '../../src/engine/ecoFilter.ts'

describe('ecoFilter 开关与状态', () => {
  test('默认关闭时不压缩', () => {
    assert.equal(isEcoEnabled(), false)
    const r = ecoCompress('hello world', false)
    assert.equal(r.compressed, 'hello world')
    assert.equal(r.stats.saved, 0)
  })

  test('开启后生效，关闭后失效', () => {
    setEcoEnabled('s1', true)
    assert.equal(isEcoEnabled(), true)
    setEcoEnabled('s1', false)
    assert.equal(isEcoEnabled(), false)
  })
})

describe('ecoFilter 压缩管道', () => {
  test('日志去重：合并连续重复行', () => {
    setEcoEnabled('s', true)
    resetEcoStats()
    const input = ['a', 'a', 'a', 'a', 'a', 'a', 'b'].join('\n')
    const r = ecoCompress(input, false)
    // MAX_REPEAT=3 → 保留 "初始1个+3个重复"=4 个相同的 a，第 5 个起被合并
    const aCount = r.compressed.split('\n').filter(l => l === 'a').length
    assert.equal(aCount, 4, `6 个 a 应压缩到 4 个，实际 ${aCount}`)
    assert.ok(r.stats.saved > 0, '应有 token 节省')
  })

  test('ceremony-strip：去 npm/pip 噪音行', () => {
    setEcoEnabled('s', true, '')
    resetEcoStats()
    const input = [
      'npm WARN deprecated old-pkg@1.0.0 legacy',
      'This is a real build output line',
      'Successfully installed requests-2.0',
    ].join('\n')
    const r = ecoCompress(input, false)
    assert.ok(!r.compressed.includes('npm WARN'), 'npm WARN deprecated 应被移除')
    assert.ok(r.compressed.includes('This is a real build output line'))
  })

  test('head-cap：超长输出截断保留头尾', () => {
    setEcoEnabled('s', true, '')
    resetEcoStats()
    const input = Array.from({ length: 300 }, (_, i) => `line-${i}`).join('\n')
    const r = ecoCompress(input, false)
    assert.equal(r.truncated, true, '超过 200 行应截断')
    assert.ok(r.compressed.includes('line-0'))
    assert.ok(r.compressed.includes('line-299'), '尾部应保留')
    assert.ok(r.compressed.includes('[... 截断'))
  })

  test('isError 时优先保留失败信息', () => {
    setEcoEnabled('s', true, '')
    resetEcoStats()
    const input = ['ok line', 'FAILED test_foo', 'more'].join('\n')
    const r = ecoCompress(input, true)
    assert.ok(r.compressed.includes('FAILED test_foo'), '失败行应被保留')
  })

  test('stats 统计节省', () => {
    setEcoEnabled('s', true, '')
    resetEcoStats()
    const input = Array.from({ length: 400 }, (_, i) => `line-${i}`).join('\n')
    const r = ecoCompress(input, false)
    assert.ok(r.stats.saved > 0)
    assert.equal(r.stats.baseline, r.stats.eco + r.stats.saved)
  })

  test('teePath 写入 session 文件（临时目录）', async () => {
    const os = await import('node:os')
    const pr = await import('node:path')
    const fs = await import('node:fs')
    const tmp = fs.mkdtempSync(pr.join(os.tmpdir(), 'eco-'))
    try {
      const tee = pr.join(tmp, 'session/raw.txt')
      setEcoEnabled('s', true, tmp)
      ecoCompress('raw content for tee', false, tee)
      assert.ok(fs.existsSync(tee), 'tee 文件应被创建')
      const raw = fs.readFileSync(tee, 'utf-8')
      assert.ok(raw.includes('raw content for tee'), 'tee 应包含原始内容')
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
      setEcoEnabled('s', false)
    }
  })

  test('getEcoStats 反映累计统计', () => {
    setEcoEnabled('s', true, '')
    resetEcoStats()
    ecoCompress('a\nb\nc', false)
    const stats = getEcoStats()
    assert.ok(stats.commands >= 0)
  })
})