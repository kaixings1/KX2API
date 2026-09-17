import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/chat.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// @types/koa 里 request.body 是 `{}`（koa-bodyparser 未做类型增强），
// 直接取 .model / .stream 会报 TS2339。这里先取到局部变量再按真实形状断言。
const re =
  /  console\.log\(`\[Chat\] ENTER reqId=\$\{requestId\} model=\$\{ctx\.request\.body\?\.model \|\| '\?'\} stream=\$\{ctx\.request\.body\?\.stream \|\| '\?'\}`\)/

if (!re.test(s)) {
  console.log('未命中 ENTER 日志行')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "  // koa-bodyparser 未增强 @types/koa 的 body 类型（默认 {}），先断言再取字段",
    '  const rawBody = ctx.request.body as { model?: string; stream?: boolean } | undefined',
    "  console.log(`[Chat] ENTER reqId=${requestId} model=${rawBody?.model || '?'} stream=${rawBody?.stream || '?'}`)",
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
