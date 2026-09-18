import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/toolCallExtractor.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 统一为「本项目注册命令名」。原实现产出 Claude 风格名（Bash/Read/ListFiles…），
// 这些名字在 commandRunners 注册表里不存在，归一化后仍调不通工具。
const pairs = [
  // inferToolNameFromArgs
  ["return 'Bash';", "return 'bash';"],
  ["return 'CodeInterpreter';", "return 'exec';"],
  ["return 'WebSearch';", "return 'search';"],
  ["return 'WebExtractor';", "return 'search';"],
  ["return 'Read';", "return 'cat';"],
  ["return 'Glob';", "return 'find';"],
  ["return 'Grep';", "return 'find';"],
  ["return 'ListFiles';", "return 'ls';"],
  ["return 'StrReplaceEditor';", "return 'fix';"],
  // 意图规则里的判定
  ["if (normalizedName === 'Bash' &&", "if (normalizedName === 'bash' &&"],
  // ruleToolDeclareCn / ruleLooseToolDeclare 等
  ["    name = 'ListFiles'", "    name = 'ls'"],
  ["    name = 'Read'", "    name = 'cat'"],
  ["    name = 'Bash'", "    name = 'bash'"],
  ["return makeIntentMatch('ListFiles',", "return makeIntentMatch('ls',"],
  ["return makeIntentMatch('Read',", "return makeIntentMatch('cat',"],
  ["return makeIntentMatch('Bash',", "return makeIntentMatch('bash',"],
  ["isList ? 'ListFiles' : 'Read'", "isList ? 'ls' : 'cat'"],
]

let applied = 0
for (const [from, to] of pairs) {
  const n = s.split(from).length - 1
  if (n > 0) {
    s = s.split(from).join(to)
    applied += n
  }
}

// TOOL_NAME_MAP_LOOSE：直接改成引用统一表的同源方向
const looseRe = /const TOOL_NAME_MAP_LOOSE: Record<string, string> = \{[\s\S]*?\n\}/
if (looseRe.test(s)) {
  s = s.replace(
    looseRe,
    [
      '/**',
      ' * 松散的「模型自造名 → 本项目注册命令名」映射。',
      ' *',
      ' * 原表映射到 Claude 风格名（Bash/Read/ListFiles/Glob…），那些名字在本项目',
      ' * 注册表里一个都不存在 —— 归一化后仍然调不通工具。现统一为注册名，',
      ' * 与 TOOL_NAME_MAPPING（protocols/shared.ts）和 toolNameResolver 同向。',
      ' */',
      'const TOOL_NAME_MAP_LOOSE: Record<string, string> = {',
      "  bash: 'bash', shell: 'bash', cmd: 'bash',",
      "  read: 'cat', cat: 'cat', read_file: 'cat',",
      "  ls: 'ls', dir: 'ls', list: 'ls', list_dir: 'ls', list_directory: 'ls',",
      "  find: 'find', glob: 'find', grep: 'find', search: 'find',",
      "  exec: 'exec', run: 'bash',",
      "  cp: 'cp', mkdir: 'mkdir',",
      '}',
    ].join('\n'),
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（替换 ${applied} 处字面量 + LOOSE 表）`)
}
