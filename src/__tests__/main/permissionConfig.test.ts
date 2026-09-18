import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  setPermissionConfigPath,
  getPermissionConfigPath,
  clearPermissionConfigCache,
  loadPermissionRules,
  parsePermissionEntries,
  writePermissionRules,
  rulesToEntries,
  ensureSamplePermissionConfig,
  type PermissionRuleEntry,
} from '../../main/permissions/permissionConfig'
import { evaluatePermission } from '../../engine/permissions/permissionRules'

/**
 * 权限配置的契约：
 *   1. 读不到/读坏了 → 空规则集（= 行为与改造前一致，既不放行也不锁死）
 *   2. 单条规则畸形只跳过该条，不让整套配置失效
 *   3. 往返一致：写入后读回得到等价规则
 *
 * 第 1 条尤其重要：权限是安全相关的，"配置读不出来"若变成"一律拒绝"
 * 会让用户完全无法操作，变成"一律放行"则是安全漏洞 —— 两者都不可接受。
 */

let dir: string
let cfgPath: string

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-permcfg-'))
  cfgPath = path.join(dir, 'permissions.json')
})

afterAll(async () => {
  setPermissionConfigPath(null)
  await fs.rm(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(cfgPath, { force: true })
  setPermissionConfigPath(cfgPath)
  clearPermissionConfigCache()
})

describe('路径管理', () => {
  it('设置后能读回', () => {
    setPermissionConfigPath('/tmp/x.json')
    expect(getPermissionConfigPath()).toBe('/tmp/x.json')
    setPermissionConfigPath(cfgPath)
  })

  it('清空缓存后重新读取文件（改完即时生效）', async () => {
    await writePermissionRules([{ behavior: 'allow', rule: 'Read' }])
    const first = await loadPermissionRules()
    expect(first.length).toBe(1)

    // 直接改文件 + 清缓存 → 应读到新内容
    await fs.writeFile(
      cfgPath,
      JSON.stringify({ version: 1, rules: [{ behavior: 'deny', rule: 'Bash' }] }),
      'utf-8',
    )
    clearPermissionConfigCache()
    const second = await loadPermissionRules()
    expect(second.length).toBe(1)
    expect(second[0].behavior).toBe('deny')
  })
})

describe('loadPermissionRules — 降级行为（关键）', () => {
  it('文件不存在 → 空规则集', async () => {
    expect(await loadPermissionRules()).toEqual([])
  })

  it('JSON 损坏 → 空规则集（不抛错）', async () => {
    await fs.writeFile(cfgPath, '{ 这不是 JSON', 'utf-8')
    clearPermissionConfigCache()
    expect(await loadPermissionRules()).toEqual([])
  })

  it('未设置路径 → 空规则集', async () => {
    setPermissionConfigPath(null)
    expect(await loadPermissionRules()).toEqual([])
    setPermissionConfigPath(cfgPath)
  })

  it('空规则集时判定返回 passthrough（行为与改造前一致）', async () => {
    const rules = await loadPermissionRules()
    expect(evaluatePermission(rules, 'Bash', { command: 'rm -rf /' }).behavior).toBe('passthrough')
  })

  it('rules 字段缺失 → 空规则集', async () => {
    await fs.writeFile(cfgPath, JSON.stringify({ version: 1 }), 'utf-8')
    clearPermissionConfigCache()
    expect(await loadPermissionRules()).toEqual([])
  })

  it('rules 不是数组 → 空规则集', async () => {
    await fs.writeFile(cfgPath, JSON.stringify({ version: 1, rules: 'oops' }), 'utf-8')
    clearPermissionConfigCache()
    expect(await loadPermissionRules()).toEqual([])
  })
})

describe('parsePermissionEntries — 单条畸形只跳过该条', () => {
  it('正常条目被解析', () => {
    const rules = parsePermissionEntries([{ behavior: 'allow', rule: 'Bash(git status)' }])
    expect(rules.length).toBe(1)
    expect(rules[0].value.toolName).toBe('Bash')
    expect(rules[0].value.ruleContent).toBe('git status')
    expect(rules[0].behavior).toBe('allow')
  })

  it('未知裁决被跳过，其余保留', () => {
    const rules = parsePermissionEntries([
      { behavior: 'maybe' as never, rule: 'Bash' },
      { behavior: 'deny', rule: 'Bash(rm **)' },
    ])
    expect(rules.length).toBe(1)
    expect(rules[0].behavior).toBe('deny')
  })

  it('空规则字符串被跳过', () => {
    const rules = parsePermissionEntries([
      { behavior: 'allow', rule: '' },
      { behavior: 'allow', rule: '   ' },
      { behavior: 'allow', rule: 'Read' },
    ])
    expect(rules.length).toBe(1)
  })

  it('无法解析出工具名的规则被跳过', () => {
    const rules = parsePermissionEntries([{ behavior: 'allow', rule: '(foo)' }])
    expect(rules.length).toBe(0)
  })

  it('null 条目被跳过', () => {
    const rules = parsePermissionEntries([null as never, { behavior: 'allow', rule: 'Read' }])
    expect(rules.length).toBe(1)
  })

  it('非数组输入返回空（不抛错）', () => {
    expect(parsePermissionEntries(null as never)).toEqual([])
    expect(parsePermissionEntries(undefined as never)).toEqual([])
  })

  it('缺省 source 为 userSettings', () => {
    const rules = parsePermissionEntries([{ behavior: 'allow', rule: 'Read' }])
    expect(rules[0].source).toBe('userSettings')
  })

  it('显式 source 被保留', () => {
    const rules = parsePermissionEntries([
      { behavior: 'allow', rule: 'Read', source: 'session' },
    ])
    expect(rules[0].source).toBe('session')
  })
})

describe('往返一致', () => {
  it('写入后读回得到等价规则', async () => {
    const entries: PermissionRuleEntry[] = [
      { behavior: 'allow', rule: 'Read' },
      { behavior: 'deny', rule: 'Bash(rm **)' },
      { behavior: 'ask', rule: 'Bash(git push **)' },
      { behavior: 'allow', rule: 'Edit(src/**)' },
    ]
    await writePermissionRules(entries)
    const rules = await loadPermissionRules()
    expect(rules.length).toBe(4)
    expect(rules.map(r => r.behavior)).toEqual(['allow', 'deny', 'ask', 'allow'])
  })

  it('含特殊字符的规则往返一致（转义生效）', async () => {
    await writePermissionRules([
      { behavior: 'allow', rule: 'Bash(python -c "print\\(1\\)")' },
    ])
    const rules = await loadPermissionRules()
    expect(rules[0].value.ruleContent).toBe('python -c "print(1)"')
  })

  it('rulesToEntries 反向转换', async () => {
    await writePermissionRules([{ behavior: 'deny', rule: 'Bash(rm **)' }])
    const rules = await loadPermissionRules()
    const back = rulesToEntries(rules)
    expect(back.length).toBe(1)
    expect(back[0].behavior).toBe('deny')
    expect(back[0].rule).toBe('Bash(rm **)')
  })

  it('passthrough 规则不被写回配置（它表示"无规则"）', () => {
    const entries = rulesToEntries([
      { source: 'userSettings', behavior: 'passthrough', value: { toolName: 'Bash' } },
    ])
    expect(entries).toEqual([])
  })

  it('写入后判定立即可用', async () => {
    await writePermissionRules([
      { behavior: 'allow', rule: 'Bash(git status)' },
      { behavior: 'deny', rule: 'Bash(rm **)' },
    ])
    const rules = await loadPermissionRules()
    expect(evaluatePermission(rules, 'Bash', { command: 'git status' }).behavior).toBe('allow')
    expect(evaluatePermission(rules, 'Bash', { command: 'rm -rf /' }).behavior).toBe('deny')
    expect(evaluatePermission(rules, 'Bash', { command: 'ls' }).behavior).toBe('passthrough')
  })

  it('未设置路径时写入抛错', async () => {
    setPermissionConfigPath(null)
    await expect(writePermissionRules([{ behavior: 'allow', rule: 'Read' }])).rejects.toThrow()
    setPermissionConfigPath(cfgPath)
  })
})

describe('ensureSamplePermissionConfig — 示例配置', () => {
  it('文件不存在时写入示例并返回 true', async () => {
    const created = await ensureSamplePermissionConfig()
    expect(created).toBe(true)
    const rules = await loadPermissionRules()
    expect(rules.length).toBeGreaterThan(0)
  })

  it('示例包含危险命令的 ask 规则（不是直接 deny）', async () => {
    await ensureSamplePermissionConfig()
    const rules = await loadPermissionRules()
    const askRules = rules.filter(r => r.behavior === 'ask')
    expect(askRules.length).toBeGreaterThan(0)
    expect(askRules.some(r => r.value.toolName === 'bash')).toBe(true)
  })

  it('文件已存在时不覆盖（返回 false）', async () => {
    await writePermissionRules([{ behavior: 'deny', rule: 'Bash' }])
    clearPermissionConfigCache()
    const created = await ensureSamplePermissionConfig()
    expect(created).toBe(false)
    // 用户配置未被覆盖
    const rules = await loadPermissionRules(true)
    expect(rules.length).toBe(1)
    expect(rules[0].behavior).toBe('deny')
  })

  it('示例规则不含 passthrough（那是内部状态）', async () => {
    await ensureSamplePermissionConfig()
    const raw = await fs.readFile(cfgPath, 'utf-8')
    expect(raw).not.toContain('passthrough')
  })

  it('示例里只读工具默认放行', async () => {
    await ensureSamplePermissionConfig()
    const rules = await loadPermissionRules()
    const readRule = rules.find(r => r.value.toolName === 'cat')
    expect(readRule?.behavior).toBe('allow')
  })
})

describe('安全语义：优先级在配置层也成立', () => {
  it('配置里的 deny 压过配置里的 allow', async () => {
    await writePermissionRules([
      { behavior: 'allow', rule: 'Bash' },
      { behavior: 'deny', rule: 'Bash(rm **)' },
    ])
    const rules = await loadPermissionRules()
    expect(evaluatePermission(rules, 'Bash', { command: 'rm -rf /' }).behavior).toBe('deny')
    expect(evaluatePermission(rules, 'Bash', { command: 'ls' }).behavior).toBe('allow')
  })

  it('旧工具名在配置里被自动归一化', async () => {
    await writePermissionRules([{ behavior: 'allow', rule: 'Task' }])
    const rules = await loadPermissionRules()
    expect(rules[0].value.toolName).toBe('Agent')
    // 且能匹配新名工具
    expect(evaluatePermission(rules, 'Agent', {}).behavior).toBe('allow')
  })
})
