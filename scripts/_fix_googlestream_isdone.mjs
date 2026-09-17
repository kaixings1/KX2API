import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/google-stream.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// finishReason && ... 的求值结果是 finishReason 本身（string）或 boolean，
// 而函数声明返回 boolean（TS2322）。调用方按布尔用，必须显式布尔化。
const re =
  /  static isDone\(chunk: GeminiStreamChunk\): boolean \{\r?\n    const finishReason = chunk\.candidates\?\.\[0\]\?\.finishReason\r?\n    return finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS'\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中 isDone')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  static isDone(chunk: GeminiStreamChunk): boolean {',
    '    const finishReason = chunk.candidates?.[0]?.finishReason',
    '    // 显式布尔化：`a && b` 会返回 a 本身（string），与声明的 boolean 不符',
    "    return !!finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS'",
    '  }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
