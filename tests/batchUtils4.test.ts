import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createAbortController, createChildAbortController } from '../src/utils/abortController.ts'
import { createCombinedAbortSignal } from '../src/utils/combinedAbortSignal.ts'
import { withResolvers } from '../src/utils/withResolvers.ts'
import { sequential } from '../src/utils/sequential.ts'
import { sleep, withTimeout } from '../src/utils/sleep.ts'
import { Stream } from '../src/utils/stream.ts'
import { createSignal } from '../src/utils/signal.ts'
import { lastX, returnValue, all, toArray, fromArray } from '../src/utils/generators.ts'
import { generateTempFilePath } from '../src/utils/tempfile.ts'

test('abortController: createAbortController 设置监听上限', () => {
  const c = createAbortController(10)
  assert.ok(c.signal instanceof AbortSignal)
  c.abort()
  assert.equal(c.signal.aborted, true)
})

test('abortController: createChildAbortController 父中止传播到子', async () => {
  const parent = createAbortController()
  const child = createChildAbortController(parent)
  assert.equal(child.signal.aborted, false)
  parent.abort(new Error('parent abort'))
  await Promise.resolve()
  assert.equal(child.signal.aborted, true)
})

test('abortController: 父未中止时中止子不影响父', () => {
  const parent = createAbortController()
  const child = createChildAbortController(parent)
  child.abort()
  assert.equal(parent.signal.aborted, false)
})

test('abortController: 父已中止则子立即中止', () => {
  const parent = createAbortController()
  parent.abort()
  const child = createChildAbortController(parent)
  assert.equal(child.signal.aborted, true)
})

test('combinedAbortSignal: 任一输入信号中止即合并信号中止', async () => {
  const a = createAbortController()
  const b = createAbortController()
  const { signal, cleanup } = createCombinedAbortSignal(a.signal, { signalB: b.signal })
  b.abort()
  assert.equal(signal.aborted, true)
  cleanup()
})

test('combinedAbortSignal: 超时中止', async () => {
  const { signal, cleanup } = createCombinedAbortSignal(undefined, { timeoutMs: 20 })
  await sleep(40)
  assert.equal(signal.aborted, true)
  cleanup()
})

test('combinedAbortSignal: 输入已中止立即合并中止', () => {
  const a = createAbortController()
  a.abort()
  const { signal, cleanup } = createCombinedAbortSignal(a.signal)
  assert.equal(signal.aborted, true)
  cleanup()
})

test('withResolvers: 可从外部 resolve', async () => {
  const { promise, resolve, reject } = withResolvers<number>()
  resolve(42)
  assert.equal(await promise, 42)
  const p2 = withResolvers<number>()
  p2.reject(new Error('boom'))
  await assert.rejects(p2.promise, /boom/)
})

test('sequential: 并发调用按顺序执行且返回值正确', async () => {
  const order: number[] = []
  const fn = sequential(async (n: number) => {
    order.push(n)
    await sleep(10 - n) // 反序延迟，验证排队
    return n * 2
  })
  const results = await Promise.all([fn(1), fn(2), fn(3)])
  assert.deepEqual(order, [1, 2, 3])
  assert.deepEqual(results, [2, 4, 6])
})

test('sequential: 错误拒绝不阻塞后续', async () => {
  const fn = sequential(async (n: number) => {
    if (n === 1) throw new Error('fail-1')
    return n
  })
  await assert.rejects(fn(1), /fail-1/)
  assert.equal(await fn(2), 2)
})

test('sleep: 正常等待后 resolve', async () => {
  const t0 = Date.now()
  await sleep(30)
  assert.ok(Date.now() - t0 >= 25)
})

test('sleep: 信号中止时立即 resolve（静默）', async () => {
  const c = createAbortController()
  const p = sleep(1000, c.signal)
  c.abort()
  await p // 不抛错
  assert.equal(c.signal.aborted, true)
})

test('sleep: throwOnAbort 时中止会 reject', async () => {
  const c = createAbortController()
  const p = sleep(1000, c.signal, { throwOnAbort: true })
  c.abort()
  await assert.rejects(p, /aborted/)
})

test('sleep: 已中止信号立即 reject/静默', async () => {
  const c = createAbortController()
  c.abort()
  await sleep(10, c.signal) // 静默
  await assert.rejects(sleep(10, c.signal, { throwOnAbort: true }))
})

test('withTimeout: 超时 reject', async () => {
  await assert.rejects(
    withTimeout(sleep(500), 30, 'timed out'),
    /timed out/,
  )
})

test('withTimeout: 正常完成 resolve', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 100, 'x'), 'ok')
})

test('stream: 可推送并逐个消费', async () => {
  const s = new Stream<number>()
  s.enqueue(1)
  s.enqueue(2)
  s.done()
  assert.deepEqual(await toArray(s), [1, 2])
})

test('stream: 等待中的读取被 enqueue 唤醒', async () => {
  const s = new Stream<number>()
  const read = s.next()
  s.enqueue(7)
  const r = await read
  assert.equal(r.done, false)
  assert.equal(r.value, 7)
  s.done()
})

test('stream: 只能迭代一次', async () => {
  const s = new Stream<number>()
  s.done()
  await toArray(s)
  await assert.rejects(toArray(s), /只能被迭代一次/)
})

test('stream: error 拒绝等待中的读取', async () => {
  const s = new Stream<number>()
  const read = s.next()
  s.error(new Error('stream err'))
  await assert.rejects(read, /stream err/)
})

test('signal: 订阅/取消/emit', () => {
  const sig = createSignal<[string]>()
  const seen: string[] = []
  const unsub1 = sig.subscribe((v) => seen.push('a:' + v))
  const unsub2 = sig.subscribe((v) => seen.push('b:' + v))
  sig.emit('x')
  unsub1()
  sig.emit('y')
  unsub2()
  sig.emit('z')
  assert.deepEqual(seen, ['a:x', 'b:x', 'b:y'])
})

test('signal: clear 移除全部', () => {
  const sig = createSignal<[]>()
  let n = 0
  sig.subscribe(() => n++)
  sig.subscribe(() => n++)
  sig.clear()
  sig.emit()
  assert.equal(n, 0)
})

test('generators: lastX / returnValue / toArray / fromArray', async () => {
  async function* nums() {
    yield 1
    yield 2
    yield 3
  }
  assert.equal(await lastX(nums()), 3)
  assert.equal(await returnValue(nums()), undefined)
  assert.deepEqual(await toArray(nums()), [1, 2, 3])
  assert.deepEqual(await toArray(fromArray([9, 8])), [9, 8])
})

test('generators: lastX 空生成器抛错', async () => {
  async function* empty() {}
  await assert.rejects(lastX(empty()), /No items/)
})

test('generators: all 并发上限执行', async () => {
  let active = 0
  let maxActive = 0
  async function* gen(n: number) {
    active++
    maxActive = Math.max(maxActive, active)
    await sleep(20)
    active--
    yield n
  }
  const out: number[] = []
  for await (const v of all([gen(1), gen(2), gen(3), gen(4)], 2)) {
    out.push(v)
  }
  assert.equal(out.length, 4)
  assert.equal(maxActive, 2) // 并发上限 2
})

test('tempfile: 默认前缀与扩展名', () => {
  const p = generateTempFilePath()
  assert.ok(p.includes('claude-prompt-'))
  assert.ok(p.endsWith('.md'))
})

test('tempfile: contentHash 跨进程稳定', () => {
  const p1 = generateTempFilePath('sandbox', '.json', { contentHash: 'same-content' })
  const p2 = generateTempFilePath('sandbox', '.json', { contentHash: 'same-content' })
  const p3 = generateTempFilePath('sandbox', '.json', { contentHash: 'other-content' })
  assert.equal(p1, p2)
  assert.notEqual(p1, p3)
})
