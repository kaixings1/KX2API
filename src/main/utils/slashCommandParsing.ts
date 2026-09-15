/**
 * Centralized utilities for parsing slash commands
 *
 * 始终使用首词解析模式：第一个空格前的词为命令名，其余为参数。
 * 中文技能名的模糊匹配由上层处理。
 */

export type ParsedSlashCommand = {
  commandName: string
  args: string
  isMcp: boolean
}

/**
 * Parses a slash command input string into its component parts
 *
 * @example
 * parseSlashCommand('/search foo bar')
 * // => { commandName: 'search', args: 'foo bar', isMcp: false }
 *
 * @example
 * parseSlashCommand('/mcp:tool (MCP) arg1 arg2')
 * // => { commandName: 'mcp:tool (MCP)', args: 'arg1 arg2', isMcp: true }
 */
export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmedInput = input.trim()

  if (!trimmedInput.startsWith('/')) {
    return null
  }

  const withoutSlash = trimmedInput.slice(1)
  const words = withoutSlash.split(' ')

  if (!words[0]) {
    return null
  }

  let commandName: string
  let isMcp = false
  let argsStartIndex = 1

  commandName = words[0]!
  argsStartIndex = 1

  // Check for MCP commands (second word is '(MCP)')
  if (words.length > 1 && words[1] === '(MCP)') {
    commandName = commandName + ' (MCP)'
    isMcp = true
    argsStartIndex = 2
  }

  // 命令名与参数之间可能有多个空格（'/search  foo'），空 token 要丢掉，
  // 否则 args 会带上多余的前导空格（单测 parseSlashCommand: trims whitespace 覆盖）
  const args = words.slice(argsStartIndex).filter(Boolean).join(' ')

  return {
    commandName,
    args,
    isMcp,
  }
}
