/**
 * engine/skills sourceManager 测试
 *
 * 覆盖技能源的增删查、技能注册、冲突检测、状态快照。
 * 含真实缺陷回归：
 *   1. addSource 不校验重复 id —— 同 id 静默产生重复源（removeSource 只能删到第一个）
 *   2. getAllSources/getState 返回浅拷贝 —— 外部改 source.enabled 会污染内部状态
 *
 * 运行：node --import tsx --test tests/engine/skill-source-manager.test.ts
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { skillSourceManager, type SkillItem } from '../../src/engine/skills/sourceManager.ts'

function reset() {
  skillSourceManager.restore({ sources: [], installedSkills: [] })
}

function skill(name: string, sourceId: string): SkillItem {
  return { name, sourceId, description: '', version: '1.0.0' }
}

describe('技能源 — 增删查', () => {
  beforeEach(reset)

  test('addSource 自动生成 id', () => {
    const s = skillSourceManager.addSource({ name: 'a', type: 'npm', url: 'u', enabled: true })
    assert.ok(s.id)
    assert.equal(skillSourceManager.getAllSources().length, 1)
  })

  test('addSource 显式 id 生效', () => {
    const s = skillSourceManager.addSource({ id: 'my-id', name: 'a', type: 'git', url: 'u', enabled: true })
    assert.equal(s.id, 'my-id')
  })

  test('addSource 重复 id 应被拒绝（回归：原实现静默产生重复）', () => {
    skillSourceManager.addSource({ id: 'dup', name: 'first', type: 'local', url: 'u1', enabled: true })
    let threw = false
    try {
      skillSourceManager.addSource({ id: 'dup', name: 'second', type: 'local', url: 'u2', enabled: true })
    } catch {
      threw = true
    }
    const all = skillSourceManager.getAllSources()
    const dups = all.filter((s) => s.id === 'dup')
    assert.ok(
      threw || dups.length === 1,
      `重复 id 不应产生两个同名源（当前 ${dups.length} 个）`,
    )
  })

  test('removeSource 成功与失败', () => {
    const s = skillSourceManager.addSource({ id: 'x', name: 'a', type: 'npm', url: 'u', enabled: true })
    assert.equal(skillSourceManager.removeSource(s.id), true)
    assert.equal(skillSourceManager.removeSource('不存在'), false)
    assert.equal(skillSourceManager.getAllSources().length, 0)
  })

  test('removeSource 连带清理该源的技能', () => {
    const s = skillSourceManager.addSource({ id: 'x', name: 'a', type: 'npm', url: 'u', enabled: true })
    skillSourceManager.registerInstalledSkill(skill('s1', 'x'))
    skillSourceManager.registerInstalledSkill(skill('s2', 'other'))
    skillSourceManager.removeSource('x')
    assert.equal(skillSourceManager.getSourceSkills('x').length, 0)
    assert.equal(skillSourceManager.getState().installedSkills.length, 1, '其它源的技能应保留')
  })

  test('getAllSources 返回的元素是副本（回归：浅拷贝会污染内部）', () => {
    skillSourceManager.addSource({ id: 'x', name: 'a', type: 'npm', url: 'u', enabled: true })
    const list = skillSourceManager.getAllSources()
    list[0].enabled = false
    list[0].name = 'tampered'
    const fresh = skillSourceManager.getAllSources()[0]
    assert.equal(fresh.enabled, true, '外部修改不应影响内部状态')
    assert.equal(fresh.name, 'a')
  })
})

describe('技能 — 注册与查询', () => {
  beforeEach(reset)

  test('registerInstalledSkill 与 getSourceSkills', () => {
    skillSourceManager.registerInstalledSkill(skill('a', 'src1'))
    skillSourceManager.registerInstalledSkill(skill('b', 'src1'))
    skillSourceManager.registerInstalledSkill(skill('c', 'src2'))
    assert.equal(skillSourceManager.getSourceSkills('src1').length, 2)
    assert.equal(skillSourceManager.getSourceSkills('src2').length, 1)
  })

  test('installSourceSkills 对未知源返回空数组', async () => {
    const items = await skillSourceManager.installSourceSkills('不存在')
    assert.deepEqual(items, [])
  })

  test('installAllSources 只处理启用的源', async () => {
    skillSourceManager.addSource({ id: 'on', name: 'a', type: 'npm', url: 'u', enabled: true })
    skillSourceManager.addSource({ id: 'off', name: 'b', type: 'npm', url: 'u', enabled: false })
    skillSourceManager.registerInstalledSkill(skill('s-on', 'on'))
    skillSourceManager.registerInstalledSkill(skill('s-off', 'off'))
    const got = await skillSourceManager.installAllSources()
    assert.equal(got.length, 1)
    assert.equal(got[0].sourceId, 'on')
  })
})

describe('冲突检测', () => {
  beforeEach(reset)

  test('同名跨源报冲突', () => {
    const conflicts = skillSourceManager.getConflicts([
      skill('dup', 'srcA'),
      skill('dup', 'srcB'),
      skill('unique', 'srcA'),
    ])
    assert.equal(conflicts.length, 1)
    assert.equal(conflicts[0].skillName, 'dup')
    assert.equal(conflicts[0].type, 'name_collision')
    assert.deepEqual(conflicts[0].sources, ['srcA', 'srcB'])
  })

  test('无冲突时返回空数组', () => {
    const conflicts = skillSourceManager.getConflicts([skill('a', 's1'), skill('b', 's2')])
    assert.deepEqual(conflicts, [])
  })

  test('不传参数时使用已注册技能', () => {
    skillSourceManager.registerInstalledSkill(skill('dup', 's1'))
    skillSourceManager.registerInstalledSkill(skill('dup', 's2'))
    assert.equal(skillSourceManager.getConflicts().length, 1)
  })
})

describe('状态快照', () => {
  beforeEach(reset)

  test('getState → restore 往返一致', () => {
    skillSourceManager.addSource({ id: 'x', name: 'a', type: 'npm', url: 'u', enabled: true })
    skillSourceManager.registerInstalledSkill(skill('s', 'x'))
    const snap = skillSourceManager.getState()

    reset()
    assert.equal(skillSourceManager.getAllSources().length, 0)

    skillSourceManager.restore(snap)
    assert.equal(skillSourceManager.getAllSources().length, 1)
    assert.equal(skillSourceManager.getSourceSkills('x').length, 1)
  })

  test('restore 后外部修改快照不影响内部（深拷贝）', () => {
    const snap = { sources: [{ id: 'x', name: 'a', type: 'npm' as const, url: 'u', enabled: true }], installedSkills: [] }
    skillSourceManager.restore(snap)
    snap.sources[0].enabled = false
    snap.sources.push({ id: 'y', name: 'b', type: 'npm' as const, url: 'u', enabled: true })
    assert.equal(skillSourceManager.getAllSources().length, 1)
    assert.equal(skillSourceManager.getAllSources()[0].enabled, true)
  })
})
