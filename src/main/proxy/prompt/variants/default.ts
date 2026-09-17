import type { PromptVariant } from '../types'

export const DEFAULT_VARIANT: PromptVariant = {
  id: 'default',
  name: 'Default',
  description: 'Default prompt variant for generic models',
  /**
   * 唯一通配兜底变体。
   *
   * `selectPromptVariant` 会跳过 id 为 'default' 的项继续遍历，
   * 因此这里既是「所有模型都能匹配」也是「最后才会用到」。
   *
   * 注意保持它是**唯一**带通配模式且非专用（priority 0）的变体 ——
   * 若其它变体也用 `.*`，会因数组顺序抢在它前面，导致注入的协议
   * 与实际解析器不一致（XML_VARIANT 曾有此问题，已改为不参与自动匹配）。
   */
  modelPatterns: ['.*'],
  systemPrompt: 'You are a helpful AI assistant.',
  toolPromptTemplate: `## Available Tools
You can invoke the following developer tools. Call a tool only when it is required and follow the JSON schema exactly when providing arguments.

CRITICAL: Tool names are CASE-SENSITIVE. You MUST use the exact tool name as defined below, including any prefixes like 'default_api:'.

{{TOOL_DEFINITIONS}}

## Tool Call Protocol
When you decide to call a tool, you MUST respond with NOTHING except a single [function_calls] block exactly like the template below:

[function_calls]
[call:exact_tool_name_from_list]{"argument": "value"}[/call]
[/function_calls]

CRITICAL RULES:
1. EVERY tool call MUST start with [call:exact_tool_name] and end with [/call]
2. You MUST use the EXACT tool name as defined in the Available Tools list (e.g., if the tool is named \`default_api:read_file\`, you MUST use \`[call:default_api:read_file]\`, NOT \`[call:read_file]\`).
3. The content between [call:...] and [/call] MUST be a raw JSON object on ONE LINE - NO LINE BREAKS inside the JSON
4. Do NOT wrap JSON in \`\`\`json blocks
5. Do NOT output any other text, explanation, or reasoning before or after the [function_calls] block
6. If you need to call multiple tools, put them all inside the same [function_calls] block, each with its own [call:...]...[/call] wrapper
7. JSON arguments MUST be compact, all on one line, NO pretty printing, NO newlines
8. If you are writing code or regular expressions, you MUST properly escape all backslashes and quotes inside the JSON string.

EXAMPLE with multiple tools - NOTE THE JSON IS ALL ON ONE LINE:
[function_calls]
[call:default_api:read_file]{"filePath":"/path/to/file"}[/call]
[call:default_api:list_dir]{"target_directory":"/path/to/dir"}[/call]
[call:default_api:search_content]{"pattern":"example","directory":"/path/to/dir"}[/call]
[/function_calls]

When you receive a tool result, it will be in the format:
[TOOL_RESULT for call_id] result_content`,
  toolCallFormat: 'bracket',
  priority: 0,
}
