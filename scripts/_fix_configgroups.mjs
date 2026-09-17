import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/management/config-groups.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// HTTP 边界收到的 body 是宽泛形状，而 ConfigGroupData.presets 要求具体结构。
// 这里是唯一可信的收窄点（其余层已按强类型处理），故在断言处写出真实形状。
s = s.replace(
  /        presets\?: Record<string, unknown>\r?\n        activePreset\?: string/,
  [
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
  ].join('\n'),
)

s = s.replace(
  /        presets: Record<string, unknown>\r?\n        activePreset: string \| undefined/,
  [
    '        presets: Record<',
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
    '        activePreset: string | undefined',
  ].join('\n'),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
