/**
 * Team 多角色协作系统单元测试
 * 验证 MetaGPT 风格的 Team/Role/Message 编排
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { Team } from '../../src/main/agent/team/team.ts'
import type { AgentRole, TeamConfig } from '../../src/main/agent/team/types.ts'

test('Team - constructor 初始化角色', () => {
  const team = createTestTeam()
  assert.strictEqual(team.getAllRoles().length, 2)
  assert.strictEqual(team.getLeadRole()?.id, 'lead')
})

test('Team - getRole 按 ID 查找', () => {
  const team = createTestTeam()
  const engineer = team.getRole('engineer')
  assert.ok(engineer)
  assert.strictEqual(engineer!.name, 'Engineer')
})

test('Team - getRole 不存在的 ID', () => {
  const team = createTestTeam()
  assert.strictEqual(team.getRole('nonexistent'), undefined)
})

test('Team - getLeadRole 返回 Lead 角色', () => {
  const team = createTestTeam()
  const lead = team.getLeadRole()
  assert.ok(lead)
  assert.strictEqual(lead!.id, 'lead')
})

test('Team - canContinue 检查轮次限制', () => {
  const team = createTestTeam({ maxRounds: 2 })
  assert.ok(team.canContinue())
  team.nextRound()
  assert.ok(team.canContinue())
  team.nextRound()
  assert.ok(!team.canContinue())
})

test('Team - publishMessage 发布消息', () => {
  const team = createTestTeam()
  const msg = team.publishMessage({
    sender: 'lead',
    recipient: 'engineer',
    content: 'Do this task',
  })
  assert.ok(msg.id, '消息应有 ID')
  assert.strictEqual(msg.sender, 'lead')
  assert.strictEqual(msg.recipient, 'engineer')
  assert.ok(typeof msg.timestamp === 'number')
})

test('Team - getInbox 筛选收件人', () => {
  const team = createTestTeam()
  team.publishMessage({ sender: 'lead', recipient: 'all', content: 'broadcast' })
  team.publishMessage({ sender: 'lead', recipient: 'engineer', content: 'private' })
  team.publishMessage({ sender: 'engineer', recipient: 'lead', content: 'reply' })

  const engineerInbox = team.getInbox('engineer')
  assert.ok(engineerInbox.length >= 2, '工程师应收到 all + engineer 的消息')
})

test('Team - buildRolePrompt 生成中文角色 prompt', () => {
  const role: AgentRole = {
    id: 'test',
    name: '测试员',
    profile: 'QA工程师',
    goal: '发现并报告缺陷',
    constraints: ['清晰报告', '及时反馈'],
  }
  const prompt = Team.buildRolePrompt(role, ['之前的上下文'])
  assert.ok(prompt.includes('QA工程师'), '应包含角色身份')
  assert.ok(prompt.includes('发现并报告缺陷'), '应包含角色目标')
  assert.ok(prompt.includes('清晰报告'), '应包含约束条件')
  assert.ok(prompt.includes('对话历史'), '应包含对话历史标题')
  assert.ok(prompt.includes('之前的上下文'), '应包含历史内容')
})

test('Team - process 协调 Lead 和 Engineer 角色（中文输出）', async () => {
  const team = new Team({
    mode: 'team',
    roles: [
      { id: 'lead', name: '组长', profile: '团队领导', goal: '协调团队成员', constraints: ['分配任务'] },
      { id: 'engineer', name: '工程师', profile: '软件工程师', goal: '实现解决方案', constraints: ['编写整洁代码'] },
    ],
    leadRole: 'lead',
    maxRounds: 2,
  })

  const mockExecuteLocalTool = async (_name: string, _args: string[]) => {
    return { output: '/mock/pwd' }
  }

  const result = await team.process('实现一个登录功能', mockExecuteLocalTool)
  assert.ok(typeof result === 'string', 'process 应返回字符串')
  assert.ok(result.length > 0, '结果不应为空')
  assert.ok(result.includes('组长'), '结果应包含组长角色')
  assert.ok(result.includes('工程师'), '结果应包含工程师角色')
  assert.ok(result.includes('思考') || result.includes('观察'), '结果应包含思考/观察关键词')
})

function createTestTeam(overrides: Partial<TeamConfig> = {}): Team {
  const config: TeamConfig = {
    mode: 'team',
    roles: [
      { id: 'lead', name: 'Team Leader', profile: 'Team Leader', goal: 'Coordinate', constraints: [] },
      { id: 'engineer', name: 'Engineer', profile: 'Software Engineer', goal: 'Implement', constraints: [] },
    ],
    leadRole: 'lead',
    maxRounds: 5,
    ...overrides,
  }
  return new Team(config)
}
