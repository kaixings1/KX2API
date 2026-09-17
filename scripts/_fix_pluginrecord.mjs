import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/plugins/pluginsService.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// updatePlugin() 会写 all[idx].lastActiveAt，但 PluginRecord 没声明该字段（TS2339）。
const re = /  enabled: boolean\r?\n  installed: boolean\r?\n  icon\?: string\r?\n\}/
if (!re.test(s)) {
  console.log('未命中 PluginRecord')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  enabled: boolean',
    '  installed: boolean',
    '  icon?: string',
    '  /** 最近一次活跃时间（ms），由 updatePlugin 写入 */',
    '  lastActiveAt?: number',
    '}',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
