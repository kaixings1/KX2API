/**
 * managedXml 协议解析回归测试
 * 重点覆盖：模型直接返回 surge/Claude 风格 `<tool_call><toolName>…</toolName>
 * <arguments>…</arguments></tool_call>` 时，必须正确提取工具名与参数
 * （此前 `stripDocExampleNoise` 会把 `<tool_call>` 转义、parseSurgeFormat 会把
 * `<toolName>` 当工具名，导致工具静默失效、整块当正文输出）。
 */
import { describe, it, expect } from 'vitest'
import { managedXmlProtocol } from '../protocols/managedXml'

const ctx: any = {
  tools: [
    {
      name: 'ls',
      description: '列出目录文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          showHidden: { type: 'boolean' },
        },
      },
      source: 'openai',
    },
    {
      name: 'Bash',
      description: '执行命令',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
      },
      source: 'openai',
    },
  ],
  protocol: 'managed_xml',
}

describe('managedXml: <tool_call><toolName> 子标签变体', () => {
  it('提取 XML 子标签参数并转成对象（showHidden→boolean）', () => {
    const input = `<tool_call>
  <toolName>ls</toolName>
  <arguments>
    <path>.</path>
    <showHidden>false</showHidden>
  </arguments>
</tool_call>`
    const r = managedXmlProtocol.parse(input, ctx)
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls[0].function.name).toBe('ls')
    expect(JSON.parse(r.toolCalls[0].function.arguments)).toEqual({ path: '.', showHidden: false })
  })

  it('arguments 为 JSON 字符串时直接解析', () => {
    const r = managedXmlProtocol.parse(
      '<tool_call><toolName>Bash</toolName><arguments>{"command":"ls -la"}</arguments></tool_call>',
      ctx,
    )
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls[0].function.name).toBe('Bash')
    expect(JSON.parse(r.toolCalls[0].function.arguments)).toEqual({ command: 'ls -la' })
  })

  it('stripDocExampleNoise 转义过的 &lt;tool_call>（仅开标签转 &amp;lt;）也被还原识别', () => {
    // 模拟 stripDocExampleNoise：只把开标签的 `<` 转成 `&lt;`（闭标签 `</...>` 保→原样）
    const escaped =
      '&lt;tool_call>\n' +
      '  &lt;toolName>ls&lt;/toolName>\n' +
      '  &lt;arguments>&lt;path>.&lt;/path>&lt;/arguments>\n' +
      '</tool_call>'
    const r = managedXmlProtocol.parse(escaped, ctx)
    expect(r.toolCalls.length).toBeGreaterThanOrEqual(1)
    if (r.toolCalls[0]) expect(r.toolCalls[0].function.name).toBe('ls')
  })
})