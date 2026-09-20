// 快速验证 batchUtils4 各模块基本行为（探针）
import { createAbortController } from '../src/utils/abortController.ts'
import { createCombinedAbortSignal } from '../src/utils/combinedAbortSignal.ts'
import { withResolvers } from '../src/utils/withResolvers.ts'
import { sequential } from '../src/utils/sequential.ts'
import { sleep, withTimeout } from '../src/utils/sleep.ts'
import { Stream } from '../src/utils/stream.ts'
import { createSignal } from '../src/utils/signal.ts'
import { lastX, all, toArray, fromArray } from '../src/utils/generators.ts'
import { generateTempFilePath } from '../src/utils/tempfile.ts'

async function main() {
  // abortController
  const c = createAbortController()
  c.abort()
  console.log('1 abortController ok:', c.signal.aborted)

  // combinedAbortSignal
  const { signal, cleanup } = createCombinedAbortSignal(undefined, { timeoutMs: 10 })
  await sleep(30)
  console.log('2 combinedAbortSignal ok:', signal.aborted)
  cleanup()

  // withResolvers
  const { promise, resolve } = withResolvers()
  resolve('wr')
  console.log('3 withResolvers ok:', await promise)

  // sequential
  const seq = sequential(async (n: number) => { await sleep(5); return n * 2 })
  const r = await Promise.all([seq(1), seq(2)])
  console.log('4 sequential ok:', JSON.stringify(r))

  // sleep / withTimeout
  await sleep(5)
  try { await withTimeout(sleep(500), 20, 'to'); } catch (e) { console.log('5 withTimeout ok:', (e as Error).message) }

  // stream
  const s = new Stream<number>()
  s.enqueue(1)
  s.done()
  console.log('6 stream ok:', JSON.stringify(await toArray(s)))

  // signal
  const sig = createSignal<[number]>()
  let n = 0
  sig.subscribe(() => n++)
  sig.emit(1)
  console.log('7 signal ok:', n)

  // generators
  async function* nums() { yield 1; yield 2 }
  console.log('8 lastX ok:', await lastX(nums()))
  console.log('9 toArray/fromArray ok:', JSON.stringify(await toArray(fromArray([5, 6]))))
  const out: number[] = []
  for await (const v of all([nums(), nums()], 2)) out.push(v)
  console.log('10 all ok:', JSON.stringify(out))

  // tempfile
  console.log('11 tempfile ok:', generateTempFilePath('x', '.md', { contentHash: 'h' }))
  console.log('ALL DONE')
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1) })
