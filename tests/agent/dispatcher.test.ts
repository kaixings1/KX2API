/**
 * AgentDispatcher 单元测试
 * 验证命令分发逻辑：每个命令都有具体实现（local/llm/team）
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { AgentDispatcher, type AgentDispatchResult } from '../../src/engine/agent/dispatcher.ts'

const mockConfig = {
  provider: 'openai' as const,
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
  maxTokens: 1024,
}

test('AgentDispatcher - getRunnerType 识别 team 类命令', () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  assert.strictEqual(dispatcher.getRunnerType('agents-platform'), 'team')
  assert.strictEqual(dispatcher.getRunnerType('add-dir'), 'team')
})

test('AgentDispatcher - getRunnerType 识别 local 类命令', () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  assert.strictEqual(dispatcher.getRunnerType('commit'), 'local')
  assert.strictEqual(dispatcher.getRunnerType('search'), 'local')
  assert.strictEqual(dispatcher.getRunnerType('docker'), 'local')
  assert.strictEqual(dispatcher.getRunnerType('build'), 'local')
  assert.strictEqual(dispatcher.getRunnerType('test'), 'local')
})

test('AgentDispatcher - getRunnerType 识别 llm 类命令', () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  assert.strictEqual(dispatcher.getRunnerType('review'), 'llm')
  assert.strictEqual(dispatcher.getRunnerType('refactor'), 'llm')
  assert.strictEqual(dispatcher.getRunnerType('fix'), 'llm')
  assert.strictEqual(dispatcher.getRunnerType('explain'), 'llm')
  assert.strictEqual(dispatcher.getRunnerType('analyze'), 'llm')
})

test('AgentDispatcher - getRunnerType 未知命令返回 undefined', () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  assert.strictEqual(dispatcher.getRunnerType('nonexistent-cmd-xyz'), undefined)
})

test('AgentDispatcher - getRegisteredCommands 返回所有已注册命令', () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const commands = dispatcher.getRegisteredCommands()
  assert.ok(Array.isArray(commands), '应返回数组')
  assert.ok(commands.length > 20, `应包含多个命令，实际: ${commands.length}`)
  assert.ok(commands.includes('commit'), '应包含 commit')
  assert.ok(commands.includes('review'), '应包含 review')
  assert.ok(commands.includes('agents-platform'), '应包含 agents-platform')
  assert.ok(commands.includes('add-dir'), '应包含 add-dir')
})

test('AgentDispatcher - dispatch 未知命令返回错误', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('nonexistent-cmd-xyz', [])
  assert.strictEqual(result.success, false, '未知命令应返回失败')
  assert.ok(result.error?.includes('未知命令'), `错误应包含"未知命令": ${result.error}`)
  assert.strictEqual(result.agentUsed, 'unknown')
})

test('AgentDispatcher - dispatch local 命令直接执行（commit）', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('commit', ['-m', 'test commit'])
  // local 命令直接执行，不依赖 API key
  assert.ok(result.success, 'local 命令应成功')
  assert.ok(result.agentUsed.includes('local'), `应标记为 local: ${result.agentUsed}`)
  // 输出可能包含成功或失败信息，但不应包含 pending
  assert.ok(!result.output.includes('待执行'), 'local 命令不应返回待执行状态')
})

test('AgentDispatcher - dispatch local 命令（search）', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('search', ['AgentDispatcher'])
  assert.ok(result.success, 'search 命令应成功')
  assert.ok(result.agentUsed.includes('local'), `应标记为 local: ${result.agentUsed}`)
})

test('AgentDispatcher - dispatch llm 命令无 API key 时返回待执行', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('review', [])
  assert.ok(result.success, '无 API key 时应返回待执行状态')
  assert.ok(result.output.includes('待执行'), '应标记为待执行')
  assert.ok(result.agentUsed.includes('llm'), `应标记为 llm: ${result.agentUsed}`)
})

test('AgentDispatcher - dispatch team 命令直接执行（add-dir）', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('add-dir', ['.'])
  assert.ok(result.success, 'team 命令应成功')
  assert.ok(result.agentUsed.includes('Team') || result.agentUsed.includes('team'), `应标记为 Team: ${result.agentUsed}`)
})

test('AgentDispatcher - dispatch agents-platform team 命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('agents-platform', ['test task'])
  assert.ok(result.success, 'team 命令应成功')
  assert.ok(result.agentUsed.includes('Team'), `应标记为 Team: ${result.agentUsed}`)
})

test('AgentDispatcher - dispatch background local 命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)
  const result: AgentDispatchResult = await dispatcher.dispatch('background', ['list'])
  assert.ok(result.success, 'background 命令应成功')
  assert.ok(result.agentUsed.includes('local'), `应标记为 local: ${result.agentUsed}`)
  assert.ok(result.output.includes('后台任务') || result.output.includes('任务'), '应包含后台任务相关内容')
})

test('AgentDispatcher - dispatch git 类命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)

  // git-status
  const statusResult = await dispatcher.dispatch('git-status', [])
  assert.ok(statusResult.success, 'git-status 应成功')
  assert.ok(statusResult.agentUsed.includes('local'))

  // git-log
  const logResult = await dispatcher.dispatch('git-log', ['5'])
  assert.ok(logResult.success, 'git-log 应成功')
  assert.ok(logResult.agentUsed.includes('local'))

  // git-diff
  const diffResult = await dispatcher.dispatch('git-diff', [])
  assert.ok(diffResult.success, 'git-diff 应成功')
})

test('AgentDispatcher - dispatch 文件操作命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)

  // search
  const searchResult = await dispatcher.dispatch('search', ['TODO'])
  assert.ok(searchResult.success, 'search 应成功')

  // tree
  const treeResult = await dispatcher.dispatch('tree', ['2'])
  assert.ok(treeResult.success, 'tree 应成功')

  // find
  const findResult = await dispatcher.dispatch('find', ['*.ts'])
  assert.ok(findResult.success, 'find 应成功')
})

test('AgentDispatcher - dispatch 构建类命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)

  // build
  const buildResult = await dispatcher.dispatch('build', [])
  assert.ok(buildResult.success, 'build 应成功')
  assert.ok(buildResult.agentUsed.includes('local'))

  // test
  const testResult = await dispatcher.dispatch('test', [])
  assert.ok(testResult.success, 'test 应成功')
  assert.ok(testResult.agentUsed.includes('local'))

  // lint
  const lintResult = await dispatcher.dispatch('lint', [])
  assert.ok(lintResult.success, 'lint 应成功')
})

test('AgentDispatcher - dispatch 管理类命令', async () => {
  const dispatcher = new AgentDispatcher(mockConfig)

  // config
  const configResult = await dispatcher.dispatch('config', ['list'])
  assert.ok(configResult.success, 'config 应成功')

  // context
  const contextResult = await dispatcher.dispatch('context', ['show'])
  assert.ok(contextResult.success, 'context 应成功')

  // history
  const historyResult = await dispatcher.dispatch('history', ['5'])
  assert.ok(historyResult.success, 'history 应成功')

  // status
  const statusResult = await dispatcher.dispatch('status', [])
  assert.ok(statusResult.success, 'status 应成功')
  assert.ok(statusResult.output.includes('Node'), 'status 应包含系统信息')
})

test('AgentDispatcher - 所有策略类型覆盖', () => {
  const dispatcher = new AgentDispatcher(mockConfig)

  const teamCmds = ['add-dir', 'agents-platform']
  const localCmds = ['commit', 'test', 'search', 'docker', 'build', 'lint', 'format', 'git-status', 'git-log', 'git-branch', 'background', 'backfill-sessions', 'exec', 'tree', 'find']
  const llmCmds = ['review', 'refactor', 'fix', 'explain', 'analyze', 'docs', 'generate-docs', 'generate-test']

  for (const cmd of teamCmds) {
    const t = dispatcher.getRunnerType(cmd)
    assert.strictEqual(t, 'team', `/${cmd} 应为 team 类型`)
  }
  for (const cmd of localCmds) {
    const t = dispatcher.getRunnerType(cmd)
    assert.strictEqual(t, 'local', `/${cmd} 应为 local 类型`)
  }
  for (const cmd of llmCmds) {
    const t = dispatcher.getRunnerType(cmd)
    assert.strictEqual(t, 'llm', `/${cmd} 应为 llm 类型`)
  }
})
