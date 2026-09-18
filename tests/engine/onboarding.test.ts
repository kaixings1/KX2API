/**
 * engine/onboarding 项目引导测试
 *
 * 运行：node --import tsx --test tests/engine/onboarding.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  getSteps,
  isProjectOnboardingComplete,
  maybeMarkProjectOnboardingComplete,
} from '../../src/engine/onboarding/projectOnboarding.ts'
import type { Step } from '../../src/engine/onboarding/types.ts'

describe('getSteps — 步骤派生', () => {
  test('空工作区 + 无 CLAUDE.md：workspace 可用，claudemd 不可用', () => {
    const steps = getSteps(false, true)
    const ws = steps.find((s) => s.key === 'workspace')!
    const md = steps.find((s) => s.key === 'claudemd')!
    assert.equal(ws.isEnabled, true)
    assert.equal(ws.isComplete, false)
    assert.equal(md.isEnabled, false, '目录为空时 claudemd 步骤不应启用')
  })

  test('非空工作区：claudemd 步骤启用', () => {
    const steps = getSteps(false, false)
    const ws = steps.find((s) => s.key === 'workspace')!
    const md = steps.find((s) => s.key === 'claudemd')!
    assert.equal(ws.isEnabled, false)
    assert.equal(md.isEnabled, true)
  })

  test('已有 CLAUDE.md 时 claudemd 步骤标记完成', () => {
    const steps = getSteps(true, false)
    assert.equal(steps.find((s) => s.key === 'claudemd')!.isComplete, true)
  })

  test('两个步骤 key 唯一且顺序稳定', () => {
    const steps = getSteps(false, false)
    assert.deepEqual(steps.map((s) => s.key), ['workspace', 'claudemd'])
  })

  test('所有步骤都标记为可完成', () => {
    for (const s of getSteps(false, false)) {
      assert.equal(s.isCompletable, true, `${s.key} 应可完成`)
      assert.ok(s.text.length > 0, `${s.key} 应有文案`)
    }
  })
})

describe('isProjectOnboardingComplete', () => {
  const step = (over: Partial<Step>): Step => ({
    key: 'k', text: 't', isComplete: false, isCompletable: true, isEnabled: true, ...over,
  })

  test('已标记完成时直接为真（不再检查步骤）', () => {
    assert.equal(isProjectOnboardingComplete(() => [step({ isComplete: false })], true), true)
  })

  test('启用的可完成步骤全部完成 → 真', () => {
    assert.equal(
      isProjectOnboardingComplete(() => [step({ isComplete: true })], false),
      true,
    )
  })

  test('任一启用步骤未完成 → 假', () => {
    assert.equal(
      isProjectOnboardingComplete(() => [step({ isComplete: true }), step({ isComplete: false })], false),
      false,
    )
  })

  test('未启用的步骤不参与判定（即使未完成）', () => {
    assert.equal(
      isProjectOnboardingComplete(
        () => [step({ isComplete: true }), step({ isComplete: false, isEnabled: false })],
        false,
      ),
      true,
      '未启用步骤不应阻塞完成判定',
    )
  })

  test('不可完成的步骤不参与判定', () => {
    assert.equal(
      isProjectOnboardingComplete(
        () => [step({ isComplete: true }), step({ isComplete: false, isCompletable: false })],
        false,
      ),
      true,
    )
  })

  test('没有任何参与判定的步骤 → 真（空集全称量词）', () => {
    assert.equal(isProjectOnboardingComplete(() => [step({ isEnabled: false })], false), true)
  })
})

describe('maybeMarkProjectOnboardingComplete', () => {
  test('未完成且检查通过时写入标记', () => {
    const writes: unknown[] = []
    maybeMarkProjectOnboardingComplete(false, () => true, (updater) => {
      writes.push(updater({}))
    })
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0], { hasCompletedProjectOnboarding: true })
  })

  test('检查未通过时不写入', () => {
    let called = false
    maybeMarkProjectOnboardingComplete(false, () => false, () => { called = true })
    assert.equal(called, false)
  })

  test('已标记完成时跳过（不再调用检查）', () => {
    let checked = false
    let saved = false
    maybeMarkProjectOnboardingComplete(true, () => { checked = true; return true }, () => { saved = true })
    assert.equal(checked, false, '已完成时不应重复检查')
    assert.equal(saved, false)
  })

  test('写入时保留其它既有字段', () => {
    let result: Record<string, unknown> = {}
    maybeMarkProjectOnboardingComplete(
      false,
      () => true,
      (updater) => { result = updater({ seenCount: 3 }) as Record<string, unknown> },
    )
    assert.equal(result.hasCompletedProjectOnboarding, true)
    assert.equal(result.seenCount, 3, '不得丢掉既有字段')
  })
})
