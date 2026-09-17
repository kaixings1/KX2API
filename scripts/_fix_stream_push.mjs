import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/stream.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// emitToolCalls 是箭头函数，定义在 createTransformStream 内、Transform 之外：
// 里面的 `this` 指向 StreamHandler，而 StreamHandler 没有 push 方法（TS2339）。
// 运行时这条推送因此完全不会发生 —— 工具调用 chunk 根本没被写进流。
// 修法：显式传入 push 回调，调用点补上。
s = s.replace(
  '    const emitToolCalls = (toolCalls: any[], transformedData: any) => {',
  '    // pushFn 由 Transform 实例提供；箭头函数里的 this 是 StreamHandler，不能直接 this.push\n' +
    '    const emitToolCalls = (toolCalls: any[], transformedData: any, pushFn: (data: string) => void) => {',
)

s = s.replace('        this.push(formatter.formatJSON(toolCallData))', '        pushFn(formatter.formatJSON(toolCallData))')

// 调用点：把 Transform 的 push 传进去。三处调用形如：
//   emitToolCalls(r.toolCalls, {})            在 transform(chunk...) 内
//   emitToolCalls(r.toolCalls, transformedData) 同上
// 这些上下文里的 this 就是 Transform 实例，直接传 this.push.bind(this) 即可。
const n = (s.match(/emitToolCalls\(r\.toolCalls, \{\}\)/g) || []).length
s = s.replace(/emitToolCalls\(r\.toolCalls, \{\}\)/g, 'emitToolCalls(r.toolCalls, {}, d => this.push(d))')

const n2 = (s.match(/emitToolCalls\(r\.toolCalls, transformedData\)/g) || []).length
s = s.replace(
  /emitToolCalls\(r\.toolCalls, transformedData\)/g,
  'emitToolCalls(r.toolCalls, transformedData, d => this.push(d))',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（{}, 调用 ${n} 处；transformedData 调用 ${n2} 处）`)
} else {
  console.log('无改动')
}
