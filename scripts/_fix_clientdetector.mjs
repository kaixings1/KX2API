import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/utils/clientDetector.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// DetectionResult 上没有 promptSectionMarkers（它属于 CLIENT_SIGNATURES 的配置项）。
// 本文件已提供 getPromptSectionMarkers(clientType)，改用之：
// 「该 client 没配置 section markers 就原样返回」，与原意一致且类型正确。
const re =
  /  if \(!clientResult\.promptSectionMarkers\) \{\r?\n    return messages\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中判断')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  // markers 是 client 配置项（CLIENT_SIGNATURES），不在 DetectionResult 上。',
    '  // 该 client 未配置 markers 时，无需清理，原样返回。',
    '  if (!getPromptSectionMarkers(clientResult.clientType)) {',
    '    return messages',
    '  }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
