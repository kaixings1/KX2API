import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/management/config-groups.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// PUT 分支：同样是 HTTP 边界，把 presets 收窄为 ConfigGroupData 的真实形状。
const re =
  /      data\?: \{\r?\n        presets\?: Record<string, unknown>\r?\n        activePreset\?: string\r?\n      \}/

if (!re.test(s)) {
  console.log('未命中 PUT 的 data 形状')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '      data?: {',
    '        // HTTP 边界的不可信输入：在此收窄为 ConfigGroupData 期望的形状',
    '        presets?: Record<',
    '          string,',
    '          {',
    '            provider: string',
    '            baseURL: string',
    '            apiKey: string',
    '            model: string',
    '            savedModels?: string[]',
    '            savedApiKeys?: string[]',
    '            tokens?: Record<string, number>',
    '          }',
    '        >',
    '        activePreset?: string',
    '      }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
