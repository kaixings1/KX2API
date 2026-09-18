import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/permissions/permissionRules.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 在**匹配期**做跨写法兼容，而不是在解析期改名。
//
// 分工：
//   - normalizeLegacyToolName：处理「工具**改名**」（Task → Agent，旧名此后不存在）
//   - isSameTool（toolNameCompat）：处理「**同一工具的两种写法**」（Bash/bash、Read/cat）
//
// 两者叠加后：用户写 Bash(rm **) 或 bash(rm **) 都能命中实际工具 `bash`；
// 而解析/存储仍保留用户原样，往返序列化不变（不破坏既有行为与测试）。
const old = [
  '  const ruleTool = normalizeLegacyToolName(rule.value.toolName)',
  '  const actualTool = normalizeLegacyToolName(toolName)',
  '',
  '  // MCP 风格的 `mcp__server__*` 允许前缀通配整个服务器',
  "  if (ruleTool.includes('*')) {",
  '    if (!matchesRuleContent(ruleTool, actualTool)) return false',
  '  } else if (ruleTool !== actualTool) {',
  '    return false',
  '  }',
].join(NL)

const neu = [
  '  const ruleTool = normalizeLegacyToolName(rule.value.toolName)',
  '  const actualTool = normalizeLegacyToolName(toolName)',
  '',
  "  // MCP 风格的 `mcp__server__*` 允许前缀通配整个服务器",
  "  if (ruleTool.includes('*')) {",
  '    if (!matchesRuleContent(ruleTool, actualTool)) return false',
  '  } else if (ruleTool !== actualTool) {',
  '    // 名字不字面相等时，再按「是否同一个工具」判定一次。',
  '    //',
  '    // 原因：本项目里同一工具存在两种写法 —— 注册命令名（bash/cat/ls/find，',
  '    // 实际被调度的名字）与历史风格名（Bash/Read/ListFiles/Glob，用户在',
  '    // 配置文件与设置页里写的名字）。二者若只做字面比较，规则永远不命中，',
  '    // 表现为「配了规则却不生效」。',
  '    //',
  '    // 这里只放宽**工具是否同一**这一层；下面的 ruleContent 匹配仍严格按',
  '    // 用户写的内容执行，不改变权限语义的粒度。',
  '    if (!isSameTool(ruleTool, actualTool)) return false',
  '  }',
].join(NL)

const oldCRLF = old.replace(/\n/g, '\r\n')
const neuCRLF = neu.replace(/\n/g, '\r\n')

if (s.includes(oldCRLF)) s = s.replace(oldCRLF, neuCRLF)
else if (s.includes(old)) s = s.replace(old, neu)
else {
  console.log('未命中 ruleApplies 判定')
  process.exit(1)
}

// 补导入
if (!s.includes('isSameTool')) {
  console.log('替换未生效')
  process.exit(1)
}
if (!s.includes("from '../toolNameCompat.ts'")) {
  const lines = s.split(NL)
  let lastImport = 0
  for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i
  lines.splice(lastImport + 1, 0, "import { isSameTool } from '../toolNameCompat.ts'")
  s = lines.join(NL)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
