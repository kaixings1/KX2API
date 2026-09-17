import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/agents/agentsService.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// create() 的入参把 status 标成可选，但 AgentRecord.status 是必填
// （'idle' | 'running' | 'error'）。展开后仍是 string | undefined，故补默认值。
const re = /    const agent: AgentRecord = \{\r?\n      \.\.\.data,\r?\n      id,\r?\n      createdAt: now,\r?\n      updatedAt: now,\r?\n    \}/

if (!re.test(s)) {
  console.log('未命中 create 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    const agent: AgentRecord = {',
    '      ...data,',
    '      // status 在入参里可选，但 AgentRecord 要求必填，新建默认 idle',
    "      status: data.status ?? 'idle',",
    '      id,',
    '      createdAt: now,',
    '      updatedAt: now,',
    '    }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
