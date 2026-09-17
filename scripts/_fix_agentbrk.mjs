import { readFileSync, writeFileSync } from 'node:fs'

const edits = [
  {
    p: 'src/main/agents/ExecutorRunner.ts',
    from: "import { agentsStore, type AgentRecord } from './registerHandlers'\n",
    to: "import { agentsStore } from './registerHandlers'\n",
  },
  {
    p: 'src/main/agents/ExecutorRunner.ts',
    from: "import type { AgentExecutionEvent } from './types'\n",
    to: "// AgentRecord 的单一真源是 ./types（registerHandlers 只是本地重声明，并未导出）\nimport type { AgentExecutionEvent, AgentRecord } from './types'\n",
  },
]

const editsCRLF = edits.map(e => ({
  ...e,
  from: e.from.replace(/\n/g, '\r\n'),
  to: e.to.replace(/\n/g, '\r\n'),
}))

for (const e of edits) {
  let s = readFileSync(e.p, 'utf-8')
  const before = s
  let from = e.from
  let to = e.to
  if (!s.includes(from)) {
    from = from.replace(/\n/g, '\r\n')
    to = to.replace(/\n/g, '\r\n')
  }
  if (!s.includes(from)) {
    console.log('未命中: ' + JSON.stringify(e.from))
    continue
  }
  s = s.replace(from, to)
  if (s !== before) {
    writeFileSync(e.p, s)
    console.log('已改: ' + e.p)
  }
}
