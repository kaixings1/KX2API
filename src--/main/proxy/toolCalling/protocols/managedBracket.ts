import type { ToolProtocolAdapter } from './base.ts'
import type { ToolParseContext } from '../types.ts'
import {
  buildToolCall,
  createParseResult,
  genericToolResultBlock,
  detectMarkers,
  renderToolList,
  stripFencedCodeBlocks,
  toolNames,
} from './shared.ts'

const START_MARKER = '[function_calls]'
const END_MARKER = '[/function_calls]'

export const managedBracketProtocol: ToolProtocolAdapter = {
  id: 'managed_bracket',

  renderPrompt(tools) {
    return `## Available Tools
You can invoke the following developer tools. Tool names are case-sensitive.

${renderToolList(tools)}

When calling tools, respond with only this block:

[function_calls]
[call:exact_tool_name]{"argument":"value"}[/call]
[/function_calls]`
  },

  detectStart(buffer) {
    return detectMarkers(buffer, [START_MARKER])
  },

  parse(content: string, context: ToolParseContext) {
    const parseable = stripFencedCodeBlocks(content)
    const allowedNames = toolNames(context.tools)
    const rawMatches: string[] = []
    const invalidToolNames: string[] = []
    const toolCalls = []
    const blockPattern = /\[function_calls\]([\s\S]*?)\[\/function_calls\]/g
    let blockMatch: RegExpExecArray | null

    while ((blockMatch = blockPattern.exec(parseable)) !== null) {
      rawMatches.push(blockMatch[0])
      const callPattern = /\[call:([^\]]+)\]([\s\S]*?)\[\/call\]/g
      let callMatch: RegExpExecArray | null

      while ((callMatch = callPattern.exec(blockMatch[1])) !== null) {
        const name = callMatch[1].trim()
        if (!allowedNames.has(name)) {
          invalidToolNames.push(name)
          continue
        }

        toolCalls.push(buildToolCall(`call_${toolCalls.length}`, toolCalls.length, name, callMatch[2], callMatch[0]))
      }
    }

    if (toolCalls.length === 0) {
      // ── 兜底：识别模型原生返回的 OpenAI tool_calls JSON（如 GLM 原生 function calling）──
      const nativeToolCalls = parseNativeOpenAiToolCalls(parseable, allowedNames, invalidToolNames, rawMatches)
      if (nativeToolCalls.length > 0) {
        const cleanContent = rawMatches.reduce((acc, raw) => acc.replace(raw, ''), parseable).trim()
        return createParseResult({
          content: cleanContent,
          toolCalls: nativeToolCalls,
          protocol: 'openai_chat',
          rawMatches,
          invalidToolNames,
        })
      }
      return createParseResult({
        content,
        toolCalls,
        protocol: rawMatches.length > 0 ? 'managed_bracket' : 'unknown',
        rawMatches,
        invalidToolNames,
      })
    }

    const cleanContent = rawMatches.reduce((acc, raw) => acc.replace(raw, ''), parseable).trim()
    return createParseResult({
      content: cleanContent,
      toolCalls,
      protocol: 'managed_bracket',
      rawMatches,
      invalidToolNames,
    })
  },

  formatAssistantToolCalls(calls) {
    const body = calls.map((call) => `[call:${call.name}]${call.arguments}[/call]`).join('\n')
    return `${START_MARKER}\n${body}\n${END_MARKER}`
  },

  formatToolResult(result) {
    return genericToolResultBlock(result)
  },
}

/**
 * 从模型原生返回的 OpenAI tool_calls JSON 中解析工具调用。
 * 支持两种形态：
 *  1. 完整对象 {"tool_calls":[{"id":"...","type":"function","function":{"name":"Bash","arguments":"{...}"}}]}
 *  2. 流式片段或片段化 JSON：匹配 "name":"X" + "arguments":"..." 对
 * 仅当工具名在 allowedNames 中时才收录。
 */
function parseNativeOpenAiToolCalls(
  content: string,
  allowedNames: Set<string>,
  invalidToolNames: string[],
  rawMatches: string[],
): ReturnType<typeof buildToolCall>[] {
  const result: ReturnType<typeof buildToolCall>[] = []

  // 形态1：完整 JSON 对象
  const fullMatch = /"tool_calls"\s*:\s*\[([\s\S]*?)\]\s*[,}]/.exec(content)
  if (fullMatch) {
    try {
      const arr = JSON.parse(`[${fullMatch[1]}]`)
      for (const tc of arr) {
        const fn = tc?.function
        if (!fn || typeof fn.name !== 'string') continue
        if (!allowedNames.has(fn.name)) {
          invalidToolNames.push(fn.name)
          continue
        }
        rawMatches.push(JSON.stringify(tc))
        result.push(
          buildToolCall(`call_${result.length}`, result.length, fn.name, fn.arguments ?? '{}', JSON.stringify(tc)),
        )
      }
      if (result.length > 0) return result
    } catch {
      // 退化到片段匹配
    }
  }

  // 形态2：逐对匹配 "name":"X" 后跟 "arguments":"..."
  const pairPattern = /"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  let pm: RegExpExecArray | null
  const seen = new Set<string>()
  while ((pm = pairPattern.exec(content)) !== null) {
    const name = pm[1]
    if (!allowedNames.has(name)) {
      invalidToolNames.push(name)
      continue
    }
    if (seen.has(name + pm[2])) continue
    seen.add(name + pm[2])
    rawMatches.push(pm[0])
    let args = pm[2]
    try {
      // arguments 在 JSON 字符串里是转义后的，需反转义一层
      args = JSON.parse(`"${pm[2]}"`)
    } catch {
      // 保留原样
    }
    result.push(buildToolCall(`call_${result.length}`, result.length, name, typeof args === 'string' ? args : JSON.stringify(args), pm[0]))
  }

  return result
}
