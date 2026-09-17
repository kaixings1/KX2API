import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/stream.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// ChatCompletionChoice 的 delta 是可选的（delta?: {...}），
// 直接取 transformedData.choices[0].delta.content 会报 TS2532（对象可能为 undefined）。
// 这里在写入前先取出并判空。
const re =
  /              \/\/ Normal text output\r?\n              transformedData\.choices\[0\]\.delta\.content = contentBuffer\r?\n              contentBuffer = ''/

if (!re.test(s)) {
  console.log('未命中 normal text output 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '              // Normal text output',
    '              const outDelta = transformedData.choices[0]?.delta',
    "              if (outDelta) outDelta.content = contentBuffer",
    "              contentBuffer = ''",
  ].join('\n'),
)

const re2 =
  /            if \(parsedData\.choices && parsedData\.choices\[0\] && parsedData\.choices\[0\]\.delta && parsedData\.choices\[0\]\.delta\.tool_calls\) \{\r?\n              transformedData\.choices\[0\]\.delta\.tool_calls = parsedData\.choices\[0\]\.delta\.tool_calls\r?\n            \}/

if (re2.test(s)) {
  s = s.replace(
    re2,
    [
      '            const inDelta = parsedData.choices?.[0]?.delta',
      '            const outDelta2 = transformedData.choices[0]?.delta',
      '            if (inDelta?.tool_calls && outDelta2) {',
      '              outDelta2.tool_calls = inDelta.tool_calls',
      '            }',
    ].join('\n'),
  )
}

writeFileSync(p, s)
console.log('已改: ' + p)
