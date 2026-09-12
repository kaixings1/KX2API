/**
 * ActionSampler 单元测试
 * 验证 think → action → observation 循环
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { ActionSampler } from '../../src/main/agent/action/sampler.ts'

test('ActionSampler - executeStep 返回完整 StepOutput', async () => {
  const sampler = new ActionSampler({ maxSteps: 5, maxExecutionTime: 10000 })
  const output = await sampler.executeStep({
    thought: 'Need to check the current directory',
    action: 'pwd',
    executeAction: async () => 'test-output',
  })
  assert.strictEqual(output.thought, 'Need to check the current directory')
  assert.strictEqual(output.action, 'pwd')
  assert.strictEqual(output.observation, 'test-output')
  assert.strictEqual(output.output, 'test-output')
  assert.strictEqual(output.done, false)
  assert.ok(output.executionTime >= 0, 'executionTime 应为非负数')
})

test('ActionSampler - executeStep 执行错误返回错误信息', async () => {
  const sampler = new ActionSampler()
  const output = await sampler.executeStep({
    thought: 'Will fail',
    action: 'fail',
    executeAction: async () => {
      throw new Error('intentional')
    },
  })
  assert.ok(output.observation.includes('Error: intentional'))
  assert.strictEqual(output.output, output.observation)
})

test('ActionSampler - executeStep 超时返回错误', async () => {
  const sampler = new ActionSampler({ maxExecutionTime: 100 })
  const output = await sampler.executeStep({
    thought: 'Timeout test',
    action: 'slow',
    executeAction: async () => {
      await new Promise(r => setTimeout(r, 500))
      return 'never'
    },
  })
  assert.ok(output.observation.includes('timeout'), '应包含 timeout 错误信息')
})

test('ActionSampler - run 执行多步并检查轨迹', async () => {
  const sampler = new ActionSampler({ maxSteps: 10, maxExecutionTime: 5000 })
  const results: string[] = []
  const { trajectory, finalStep } = await sampler.run({
    steps: [
      { thought: 'Step 1', action: 'a1', executeAction: async () => 'r1' },
      { thought: 'Step 2', action: 'a2', executeAction: async () => 'r2' },
      { thought: 'Step 3', action: 'a3', executeAction: async () => 'r3' },
    ],
    shouldStop: (_, step) => step.observation === 'r2',
  })
  assert.ok(trajectory.length >= 6, `轨迹至少应有 6 条记录，实际: ${trajectory.length}`)
  assert.strictEqual(finalStep.observation, 'r2')
  assert.strictEqual(finalStep.done, true)
  // 验证轨迹顺序
  assert.strictEqual(trajectory[0].type, 'thought')
  assert.strictEqual(trajectory[1].type, 'action')
  assert.strictEqual(trajectory[2].type, 'observation')
})

test('ActionSampler - run 超过 maxSteps 时停止', async () => {
  const sampler = new ActionSampler({ maxSteps: 2, maxExecutionTime: 5000 })
  const { trajectory, finalStep } = await sampler.run({
    steps: [
      { thought: 's1', action: 'a1', executeAction: async () => 'r1' },
      { thought: 's2', action: 'a2', executeAction: async () => 'r2' },
      { thought: 's3', action: 'a3', executeAction: async () => 'r3' },
    ],
  })
  // maxSteps=2，只执行 2 步
  assert.ok(trajectory.length <= 6, `轨迹不应超过 6 条，实际: ${trajectory.length}`)
  assert.strictEqual(finalStep.done, false) // 未通过 shouldStop 停止
})

test('ActionSampler - clear 清空轨迹', async () => {
  const sampler = new ActionSampler()
  await sampler.executeStep({
    thought: 'x', action: 'x', executeAction: async () => 'x',
  })
  assert.ok(sampler.getTrajectory().length > 0)
  sampler.clear()
  assert.strictEqual(sampler.getTrajectory().length, 0)
})

test('ActionSampler - getTrajectory 返回副本', async () => {
  const sampler = new ActionSampler()
  await sampler.executeStep({
    thought: 'x', action: 'x', executeAction: async () => 'x',
  })
  const t1 = sampler.getTrajectory()
  const t2 = sampler.getTrajectory()
  assert.notStrictEqual(t1, t2, '应返回不同的数组实例')
  assert.deepStrictEqual(t1, t2, '但内容应相同')
})
