import { describe, it, expect } from 'vitest'
import {
  escapeRuleContent,
  unescapeRuleContent,
  permissionRuleValueFromString,
  permissionRuleValueToString,
  normalizeLegacyToolName,
  getLegacyToolNames,
  matchesRuleContent,
  ruleApplies,
  evaluatePermission,
  extractRuleSubject,
  buildSessionAllow,
  buildUserAllow,
  applyPermissionUpdate,
  explainRule,
  type PermissionRule,
} from '../../engine/permissions/permissionRules'

/**
 * 权限规则的核心契约：
 *   1. 转义/反转义顺序不可颠倒（否则含括号的命令会解析歧义）
 *   2. deny 绝对优先（安全底线，不能被 allow 覆盖）
 *   3. 参数级匹配（`Bash(git status)` 只放行该命令，不是整个 Bash）
 */

describe('escapeRuleContent / unescapeRuleContent', () => {
  it('转义括号', () => {
    expect(escapeRuleContent('print(1)')).toBe('print\\(1\\)')
  })

  it('先转义反斜杠再转义括号（顺序不可颠倒）', () => {
    // 输入 a\b  → 反斜杠变 \\  → a\\b
    expect(escapeRuleContent('a\\b')).toBe('a\\\\b')
  })

  it('往返一致', () => {
    for (const s of ['print(1)', 'a\\b', 'x(y)z\\w', 'no-special', '((()))', '\\(']) {
      expect(unescapeRuleContent(escapeRuleContent(s))).toBe(s)
    }
  })

  it('反转义是转义的逆序（先括号后反斜杠）', () => {
    expect(unescapeRuleContent('print\\(1\\)')).toBe('print(1)')
  })

  it('空串安全', () => {
    expect(escapeRuleContent('')).toBe('')
    expect(unescapeRuleContent('')).toBe('')
  })
})

describe('permissionRuleValueFromString — 解析', () => {
  it('纯工具名', () => {
    expect(permissionRuleValueFromString('Bash')).toEqual({ toolName: 'Bash' })
  })

  it('工具名 + 内容', () => {
    expect(permissionRuleValueFromString('Bash(npm install)')).toEqual({
      toolName: 'Bash',
      ruleContent: 'npm install',
    })
  })

  it('转义括号被还原', () => {
    const r = permissionRuleValueFromString('Bash(python -c "print\\(1\\)")')
    expect(r.ruleContent).toBe('python -c "print(1)"')
  })

  it('空内容归一为工具级规则', () => {
    expect(permissionRuleValueFromString('Bash()')).toEqual({ toolName: 'Bash' })
  })

  it('单独通配归一为工具级规则', () => {
    expect(permissionRuleValueFromString('Bash(*)')).toEqual({ toolName: 'Bash' })
  })

  it('括号不配对的畸形输入退化为工具名（不抛错）', () => {
    expect(permissionRuleValueFromString('Bash(npm').toolName).toBe('Bash(npm')
    expect(permissionRuleValueFromString('Bash)npm(').toolName).toBe('Bash)npm(')
  })

  it('闭合括号后有多余字符时退化为工具名', () => {
    expect(permissionRuleValueFromString('Bash(x)y').toolName).toBe('Bash(x)y')
  })

  it('缺少工具名时退化', () => {
    expect(permissionRuleValueFromString('(foo)').toolName).toBe('(foo)')
  })

  it('旧工具名被归一化', () => {
    expect(permissionRuleValueFromString('Task').toolName).toBe('Agent')
    expect(permissionRuleValueFromString('KillShell(x)').toolName).toBe('TaskStop')
  })

  it('空串安全', () => {
    expect(permissionRuleValueFromString('')).toEqual({ toolName: '' })
    expect(permissionRuleValueFromString('   ')).toEqual({ toolName: '' })
  })

  it('MCP 风格名', () => {
    expect(permissionRuleValueFromString('mcp__fs__read').toolName).toBe('mcp__fs__read')
  })
})

describe('permissionRuleValueToString — 序列化', () => {
  it('无内容时只有工具名', () => {
    expect(permissionRuleValueToString({ toolName: 'Bash' })).toBe('Bash')
  })

  it('含内容时加括号', () => {
    expect(permissionRuleValueToString({ toolName: 'Bash', ruleContent: 'npm install' })).toBe(
      'Bash(npm install)',
    )
  })

  it('内容里的括号被转义', () => {
    expect(permissionRuleValueToString({ toolName: 'Bash', ruleContent: 'print(1)' })).toBe(
      'Bash(print\\(1\\))',
    )
  })

  it('往返一致（解析后再序列化）', () => {
    for (const s of ['Bash', 'Bash(npm install)', 'Bash(print\\(1\\))']) {
      const v = permissionRuleValueFromString(s)
      expect(permissionRuleValueToString(v)).toBe(s)
    }
  })
})

describe('normalizeLegacyToolName', () => {
  it('旧名映射到新名', () => {
    expect(normalizeLegacyToolName('Task')).toBe('Agent')
    expect(normalizeLegacyToolName('KillShell')).toBe('TaskStop')
  })

  it('未知名原样返回', () => {
    expect(normalizeLegacyToolName('Bash')).toBe('Bash')
  })

  it('反查旧名', () => {
    expect(getLegacyToolNames('Agent')).toContain('Task')
    expect(getLegacyToolNames('Nonexistent')).toEqual([])
  })
})

describe('matchesRuleContent — glob 匹配', () => {
  it('精确匹配', () => {
    expect(matchesRuleContent('git status', 'git status')).toBe(true)
    expect(matchesRuleContent('git status', 'git log')).toBe(false)
  })

  it('单星不跨空白（关键：否则 `git *` 会放行任意 git 命令）', () => {
    expect(matchesRuleContent('git *', 'git status')).toBe(true)
    expect(matchesRuleContent('git *', 'git log')).toBe(true)
    // 带额外参数的更复杂命令不该被 `git *` 放行
    expect(matchesRuleContent('git *', 'git push --force origin main')).toBe(false)
  })

  it('双星跨任意内容', () => {
    expect(matchesRuleContent('git **', 'git push --force origin main')).toBe(true)
  })

  it('路径前缀通配', () => {
    expect(matchesRuleContent('src/**', 'src/a/b/c.ts')).toBe(true)
    expect(matchesRuleContent('src/*', 'src/a.ts')).toBe(true)
    expect(matchesRuleContent('src/*', 'src/a/b.ts')).toBe(false)
  })

  it('问号匹配单字符', () => {
    expect(matchesRuleContent('a?c', 'abc')).toBe(true)
    expect(matchesRuleContent('a?c', 'abbc')).toBe(false)
  })

  it('无通配符的规则不做 glob 匹配', () => {
    expect(matchesRuleContent('git status', 'git status extra')).toBe(false)
  })

  it('特殊字符被正确转义', () => {
    expect(matchesRuleContent('a.b', 'a.b')).toBe(true)
    expect(matchesRuleContent('a.b', 'axb')).toBe(false)
  })
})

describe('extractRuleSubject', () => {
  it('优先取 command', () => {
    expect(extractRuleSubject('Bash', { command: 'ls -la' })).toBe('ls -la')
  })

  it('其次取 path', () => {
    expect(extractRuleSubject('Read', { path: 'src/a.ts' })).toBe('src/a.ts')
    expect(extractRuleSubject('Read', { file_path: 'src/a.ts' })).toBe('src/a.ts')
  })

  it('无已知字段时序列化整个输入', () => {
    const s = extractRuleSubject('Custom', { foo: 'bar' })
    expect(s).toContain('bar')
  })

  it('字符串输入直接返回', () => {
    expect(extractRuleSubject('X', 'plain')).toBe('plain')
  })

  it('null 安全', () => {
    expect(extractRuleSubject('X', null)).toBe('')
  })
})

describe('ruleApplies', () => {
  const mk = (toolName: string, ruleContent?: string): PermissionRule => ({
    source: 'userSettings',
    behavior: 'allow',
    value: { toolName, ruleContent },
  })

  it('工具级规则匹配该工具全部调用', () => {
    expect(ruleApplies(mk('Bash'), 'Bash', { command: 'rm -rf /' })).toBe(true)
  })

  it('工具级规则不匹配其它工具', () => {
    expect(ruleApplies(mk('Bash'), 'Read', { path: 'a' })).toBe(false)
  })

  it('内容级规则按内容匹配', () => {
    const r = mk('Bash', 'git status')
    expect(ruleApplies(r, 'Bash', { command: 'git status' })).toBe(true)
    expect(ruleApplies(r, 'Bash', { command: 'git push' })).toBe(false)
  })

  it('MCP 服务器前缀通配', () => {
    const r = mk('mcp__fs__*')
    expect(ruleApplies(r, 'mcp__fs__read', {})).toBe(true)
    expect(ruleApplies(r, 'mcp__git__status', {})).toBe(false)
  })

  it('旧名规则能匹配新名工具（升级后规则不失效）', () => {
    const r = mk('Task')
    expect(ruleApplies(r, 'Agent', {})).toBe(true)
  })
})

describe('evaluatePermission — 裁决', () => {
  const rule = (
    source: PermissionRule['source'],
    behavior: PermissionRule['behavior'],
    toolName: string,
    ruleContent?: string,
  ): PermissionRule => ({ source, behavior, value: { toolName, ruleContent } })

  it('无规则命中时返回 passthrough', () => {
    expect(evaluatePermission([], 'Bash', {}).behavior).toBe('passthrough')
    expect(
      evaluatePermission([rule('userSettings', 'allow', 'Read')], 'Bash', {}).behavior,
    ).toBe('passthrough')
  })

  it('allow 规则命中', () => {
    const d = evaluatePermission([rule('userSettings', 'allow', 'Bash', 'git status')], 'Bash', {
      command: 'git status',
    })
    expect(d.behavior).toBe('allow')
    expect(d.matchedRule).toBeDefined()
  })

  it('deny 绝对优先，不被其它 allow 覆盖', () => {
    const rules = [
      rule('session', 'allow', 'Bash'),
      rule('userSettings', 'deny', 'Bash', 'rm **'),
    ]
    const d = evaluatePermission(rules, 'Bash', { command: 'rm -rf /' })
    expect(d.behavior).toBe('deny')
  })

  it('deny 优先于更高来源的 allow（安全底线）', () => {
    const rules = [
      rule('session', 'allow', 'Bash', 'git *'),
      rule('policySettings', 'deny', 'Bash', 'git push *'),
    ]
    expect(evaluatePermission(rules, 'Bash', { command: 'git push origin' }).behavior).toBe('deny')
  })

  it('同为 allow 时来源优先级更高者胜（session 优先于 user）', () => {
    const rules = [
      rule('userSettings', 'ask', 'Bash'),
      rule('session', 'allow', 'Bash'),
    ]
    expect(evaluatePermission(rules, 'Bash', { command: 'ls' }).behavior).toBe('allow')
  })

  it('同来源时更具体的规则优先', () => {
    const rules = [
      rule('userSettings', 'ask', 'Bash'),
      rule('userSettings', 'allow', 'Bash', 'git status'),
    ]
    const d = evaluatePermission(rules, 'Bash', { command: 'git status' })
    expect(d.behavior).toBe('allow')
    expect(d.matchedRule?.value.ruleContent).toBe('git status')
  })

  it('ask 会被返回（用于触发用户确认）', () => {
    expect(evaluatePermission([rule('userSettings', 'ask', 'Bash')], 'Bash', {}).behavior).toBe('ask')
  })
})

describe('记忆化授权', () => {
  it('「允许一次」写进 session', () => {
    const u = buildSessionAllow('Bash', 'git status')
    expect(u.destination).toBe('session')
    expect(u.type).toBe('addRules')
  })

  it('「永远允许」写进 userSettings', () => {
    expect(buildUserAllow('Bash').destination).toBe('userSettings')
  })

  it('applyPermissionUpdate 追加规则（不修改原数组）', () => {
    const original: PermissionRule[] = []
    const next = applyPermissionUpdate(original, buildSessionAllow('Bash', 'ls'), 'allow')
    expect(original.length).toBe(0)
    expect(next.length).toBe(1)
    expect(next[0].source).toBe('session')
    expect(next[0].behavior).toBe('allow')
  })

  it('removeRules 移除匹配规则', () => {
    let rules = applyPermissionUpdate([], buildUserAllow('Bash', 'ls'), 'allow')
    expect(rules.length).toBe(1)
    rules = applyPermissionUpdate(
      rules,
      { type: 'removeRules', destination: 'userSettings', rules: [{ toolName: 'Bash', ruleContent: 'ls' }] },
      'allow',
    )
    expect(rules.length).toBe(0)
  })

  it('记忆化后规则立即可用于裁决', () => {
    let rules: PermissionRule[] = []
    rules = applyPermissionUpdate(rules, buildSessionAllow('Bash', 'git status'), 'allow')
    expect(evaluatePermission(rules, 'Bash', { command: 'git status' }).behavior).toBe('allow')
  })
})

describe('explainRule', () => {
  it('工具级规则说明', () => {
    expect(explainRule({ source: 'userSettings', behavior: 'allow', value: { toolName: 'Bash' } }))
      .toContain('全部操作')
  })

  it('内容级规则说明', () => {
    const s = explainRule({
      source: 'userSettings',
      behavior: 'allow',
      value: { toolName: 'Bash', ruleContent: 'git status' },
    })
    expect(s).toContain('git status')
  })
})
