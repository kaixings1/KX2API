import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/agents/types.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const oldBlock = [
  'export interface AgentExecutionEvent {',
  "  type: 'chunk' | 'done' | 'error'",
  '  content?: string',
  '  output?: string',
  '  error?: string',
  '}',
].join('\r\n')

const oldBlockLF = oldBlock.replace(/\r\n/g, '\n')

// 使用方（AgentExecutor / ExecutorRunner）实际会产出的形状：
//   { type: 'start' | 'chunk' | 'done' | 'error', agentId, timestamp, ... }
// 原声明漏了 'start' / agentId / timestamp，导致 4 处 TS2322 + 3 处 TS2339。
const newBlock = [
  'export interface AgentExecutionEvent {',
  "  type: 'start' | 'chunk' | 'done' | 'error'",
  '  /** 事件所属 agent；AgentExecutor 产出时会带上，ExecutorRunner 据此路由到对应窗口 */',
  '  agentId?: string',
  '  /** 事件产生的时间戳（ms） */',
  '  timestamp?: number',
  '  content?: string',
  '  output?: string',
  '  error?: string',
  '}',
].join('\r\n')

let used = null
if (s.includes(oldBlock)) used = oldBlock
else if (s.includes(oldBlockLF)) used = oldBlockLF

if (!used) {
  console.log('未命中 AgentExecutionEvent')
  process.exit(1)
}

s = s.replace(used, s.includes(oldBlock) ? newBlock : newBlock.replace(/\r\n/g, '\n'))

// AgentExecuteResult 需要 durationMs（agentsService.ts:130 在传）
const reRes = /export interface AgentExecuteResult \{\r?\n  success: boolean\r?\n  output\?: string\r?\n  error\?: string\r?\n\}/
if (reRes.test(s)) {
  s = s.replace(
    reRes,
    [
      'export interface AgentExecuteResult {',
      '  success: boolean',
      '  output?: string',
      '  error?: string',
      '  /** 本次执行耗时（ms），由调用方统计 */',
      '  durationMs?: number',
      '}',
    ].join('\n'),
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
