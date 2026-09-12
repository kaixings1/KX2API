/**
 * 工具调用测试 — 验证 10 个工具命令：pwd, ls, dir, date, grep, find, findstr, where, python, python3
 */

import { createEngine } from '../core'
import { commandRegistry } from '../commands/registry'

createEngine({
  apiKey: 'test',
  provider: 'openai',
  model: 'test',
  baseUrl: 'http://127.0.0.1:8080',
})

const toolArgs: Record<string, string[]> = {
  pwd: [],
  ls: [],
  dir: [],
  date: [],
  grep: ['TODO', 'src/engine'],
  find: ['package.json', 'src'],
  findstr: ['TODO', 'src/engine'],
  where: ['node'],
  python: ['print("hello")'],
  python3: ['print("hello")'],
}

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  OK: ${msg}`) }
  else { failed++; console.error(`  FAIL: ${msg}`) }
}

async function testTool(name: string) {
  const cmd = commandRegistry.get(name)
  if (!cmd) {
    assert(false, `${name} — 命令未注册`)
    return
  }
  const args = toolArgs[name] || []
  console.log(`\n--- /${name} ${args.join(' ')} ---`)
  const result = await cmd.execute(args)
  if (result.success) {
    assert(true, `${name} 执行成功`)
    console.log(`  Output: ${(result.output || '').slice(0, 200)}`)
  } else {
    assert(false, `${name}: ${result.error}`)
  }
}

const tools = Object.keys(toolArgs)

async function main() {
  console.log('Tool Call Test — 10 commands\n')

  for (const t of tools) {
    await testTool(t)
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`)

  if (failed === 0) {
    console.log('All tools executed successfully!')
    process.exit(0)
  } else {
    console.log(`${failed} tool(s) failed.`)
    process.exit(1)
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
