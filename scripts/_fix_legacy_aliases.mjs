import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/permissions/permissionRules.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 这张表的存在意义就是「工具改名后，用户旧配置仍能命中」。
// 本项目的工具名曾以 Claude Code 风格（Bash/Read/ListFiles/Glob…）出现于
// 权限规则默认值、设置页模板、hooks 匹配键与用户已保存的配置里，
// 而**实际被调度的名字**是注册命令名（bash/cat/ls/find…）。
//
// 把它们补进别名表，即可实现「两套写法都命中」：
//   用户写 Bash(rm **) → 归一化为 bash(rm **) → 与实际工具名一致
//   用户写 bash(rm **) → 原样保留 → 同样命中
// 规则匹配处（本文件 271-272 行）会对**双方**都做归一化，因此两个方向都成立。
const old = [
  'const LEGACY_TOOL_NAME_ALIASES: Record<string, string> = {',
  "  Task: 'Agent',",
  "  KillShell: 'TaskStop',",
  "  AgentOutputTool: 'TaskOutput',",
  "  BashOutputTool: 'TaskOutput',",
  '}',
].join(NL)

const neu = [
  'const LEGACY_TOOL_NAME_ALIASES: Record<string, string> = {',
  '  // ── 工具改名的历史别名（原有）──',
  "  Task: 'Agent',",
  "  KillShell: 'TaskStop',",
  "  AgentOutputTool: 'TaskOutput',",
  "  BashOutputTool: 'TaskOutput',",
  '',
  '  // ── Claude Code 风格名 → 本项目注册命令名 ──',
  '  //',
  '  // 这套名字曾出现在：权限规则默认值、设置页模板、沙箱白名单、hooks 匹配键，',
  '  // 以及**用户已保存的配置文件**里（升级后不能失效）。',
  '  // 而实际被 commandRunners 调度执行的是注册名（bash/cat/ls/find…），',
  '  // 两侧直接比较永远不相等 —— 这正是"规则配了却不生效"的根因。',
  '  //',
  '  // 方向与 src/engine/toolNameResolver.ts 的 TOOL_ALIASES 一致：',
  '  // 统一收敛到**注册命令名**。',
  "  Bash: 'bash',",
  "  Read: 'cat',",
  "  Write: 'cp',",
  "  Edit: 'fix',",
  "  ListFiles: 'ls',",
  "  Glob: 'find',",
  "  Grep: 'find',",
  "  StrReplaceEditor: 'fix',",
  "  WebSearch: 'search',",
  "  WebExtractor: 'search',",
  "  CodeInterpreter: 'exec',",
  "  MultiFileEdit: 'fix',",
  '}',
].join(NL)

const oldCRLF = old.replace(/\n/g, '\r\n')
const neuCRLF = neu.replace(/\n/g, '\r\n')

if (s.includes(oldCRLF)) s = s.replace(oldCRLF, neuCRLF)
else if (s.includes(old)) s = s.replace(old, neu)
else {
  console.log('未命中别名表')
  process.exit(1)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
