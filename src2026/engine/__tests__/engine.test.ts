/**
 * src/engine/__tests__/engine.test.ts — 引擎测试套件
 *
 * 运行: npx tsx src/engine/__tests__/engine.test.ts
 *
 * 测试覆盖:
 * 1. 命令注册表
 * 2. 本地命令执行
 * 3. AI 代理命令标记
 * 4. 引擎配置
 * 5. 历史管理
 * 6. 命令导入器
 */

import { createEngine, getEngine } from '../core.ts'
import { commandRegistry } from '../commands/registry.ts'
import { importCommands } from '../commands/importer.ts'

// ---- helpers ----

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

function section(title: string) {
  console.log(`\n--- ${title} ---`)
}

// ---- tests ----

async function testRegistry() {
  section('Command Registry')

  const count = commandRegistry.getNames().length
  assert(count > 200, `Total commands >= 200 (got ${count})`)

  const core = ['help', 'ls', 'cat', 'pwd', 'whoami', 'date', 'git-status', 'echo']
  for (const name of core) {
    assert(commandRegistry.has(name), `Core command /${name} registered`)
    const cmd = commandRegistry.get(name)
    assert(cmd !== undefined && typeof cmd.execute === 'function', `/${name} has execute`)
  }

  const names = commandRegistry.getNames()
  const unique = new Set(names)
  assert(unique.size === names.length, 'No duplicate command names')
}

async function testLocalCommands() {
  section('Local Commands')

  const engine = getEngine()

  const help = await engine.executeCommand('help', [])
  assert(help.success === true, '/help succeeds')
  assert(help.output?.includes('可用命令'), '/help output contains header')

  const pwd = await engine.executeCommand('pwd', [])
  assert(pwd.success === true, '/pwd succeeds')
  assert(typeof pwd.output === 'string' && pwd.output.length > 0, '/pwd returns path')

  const whoami = await engine.executeCommand('whoami', [])
  assert(whoami.success === true, '/whoami succeeds')

  const date = await engine.executeCommand('date', [])
  assert(date.success === true, '/date succeeds')

  const echo = await engine.executeCommand('echo', ['hello', 'world'])
  assert(echo.success === true, '/echo succeeds')
  assert(echo.output === 'hello world', '/echo output correct')

  const ls = await engine.executeCommand('ls', [])
  assert(ls.success === true, '/ls succeeds')

  const gitStatus = await engine.executeCommand('git-status', [])
  assert(typeof gitStatus.success === 'boolean', '/git-status returns boolean')
}

async function testAIAgentCommands() {
  section('AI Agent Commands')

  const engine = getEngine()

  const agentCmds = ['explain', 'refactor', 'review', 'docs', 'fix']
  for (const cmd of agentCmds) {
    const result = await engine.executeCommand(cmd, ['test'])
    assert(result.success === true, `/${cmd} returns success`)
    assert(result.needsAgent === true, `/${cmd} marked as needsAgent`)
  }
}

async function testEngineConfig() {
  section('Engine Config')

  const engine = getEngine()
  const config = engine.getConfig()

  assert(config.provider === 'openai', `Default provider is openai (got ${config.provider})`)
  assert(config.model === 'gpt-4o', `Default model is gpt-4o (got ${config.model})`)
  assert(typeof config.apiKey === 'string', 'apiKey is string')

  engine.updateConfig({ model: 'gpt-3.5-turbo' })
  assert(engine.getConfig().model === 'gpt-3.5-turbo', 'updateConfig works')

  engine.updateConfig({ model: 'gpt-4o' })
  assert(engine.getConfig().model === 'gpt-4o', 'Config restored')
}

async function testHistory() {
  section('History Management')

  const engine = getEngine()
  engine.clearHistory()

  const history = engine.getHistory()
  assert(Array.isArray(history.messages), 'getHistory returns messages array')
}

async function testImporter() {
  section('Command Importer')

  const count = await importCommands()
  assert(count === commandRegistry.getNames().length,
    `Importer count matches registry (${count} vs ${commandRegistry.getNames().length})`)
}

// ---- main ----

async function main() {
  console.log('KX2Code Engine Test Suite')
  console.log('='.repeat(40))

  try {
    console.log('\n[Init] Creating engine...')
    createEngine({
      apiKey: '',
      provider: 'openai',
      model: 'gpt-4o',
      maxTokens: 4096,
    })
    assert(getEngine() !== null, 'Engine created')

    await testRegistry()
    await testLocalCommands()
    await testAIAgentCommands()
    await testEngineConfig()
    await testHistory()
    await testImporter()

    console.log('\n' + '='.repeat(40))
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Total:  ${passed + failed}`)

    if (failed > 0) {
      console.log('\nSome tests failed!')
      process.exit(1)
    } else {
      console.log('\nAll tests passed!')
      process.exit(0)
    }
  } catch (e) {
    console.error('\n[Fatal]', e)
    process.exit(1)
  }
}

main()
