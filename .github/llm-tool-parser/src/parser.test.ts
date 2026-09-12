import { describe, expect, it } from 'vitest'

import { looksLikeToolCall, parseLlmToolCalls } from './parser'

describe('parseLlmToolCalls', () => {
  describe('Format A: pure JSON with tool_calls array', () => {
    it('parses a single tool call', () => {
      const text =
        '{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/a.ts"}}]}'
      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(content).toBe('')
      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })

    it('parses multiple tool calls', () => {
      const text = JSON.stringify({
        tool_calls: [
          { tool_name: 'grep', arguments: { pattern: 'foo', path: '/src' } },
          { tool_name: 'glob', arguments: { pattern: '**/*.ts' } },
          { tool_name: 'listFiles', arguments: { path: '/src' } },
        ],
      })
      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(content).toBe('')
      expect(toolCalls).toHaveLength(3)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
      expect(toolCalls[2]!.name).toBe('listFiles')
    })
  })

  describe('Format B: single tool call without array wrapper', () => {
    it('parses single tool_name object', () => {
      const text = '{"tool_name":"bash","arguments":{"command":"ls"}}'
      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(content).toBe('')
      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('bash')
      expect(toolCalls[0]!.arguments).toEqual({ command: 'ls' })
    })
  })

  describe('Multiple consecutive tool_calls JSON blocks', () => {
    it('parses two consecutive tool_calls blocks', () => {
      const text =
        '{"tool_calls":[{"tool_name":"glob","arguments":{"pattern":"README*"}}]}{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/a.ts"}}]}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('glob')
      expect(toolCalls[1]!.name).toBe('fileRead')
      expect(content).toBe('')
    })

    it('parses three consecutive tool_calls blocks (real log scenario)', () => {
      const text =
        '{"tool_calls":[{"tool_name":"glob","arguments":{"pattern":"README*","path":"/Users/someone/gitlab/mini-kode"}},{"tool_name":"fileRead","arguments":{"filePath":"/Users/someone/gitlab/mini-kode/package.json"}}]}{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/Users/someone/gitlab/mini-kode/README.md"}}]}{"tool_calls":[{"tool_name":"fileEdit","arguments":{"filePath":"/Users/someone/gitlab/mini-kode/README.md","old_string":"# mini-kode\\n","new_string":"# mini-kode\\n\\n## Install\\n"}}]}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(4)
      expect(toolCalls[0]!.name).toBe('glob')
      expect(toolCalls[1]!.name).toBe('fileRead')
      expect(toolCalls[2]!.name).toBe('fileRead')
      expect(toolCalls[3]!.name).toBe('fileEdit')
      expect(content).toBe('')
    })

    it('parses consecutive tool_calls blocks with trailing text', () => {
      const text =
        '{"tool_calls":[{"tool_name":"glob","arguments":{"pattern":"*.ts"}}]}{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}以上是文件内容'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('glob')
      expect(toolCalls[1]!.name).toBe('fileRead')
      expect(content).toBe('以上是文件内容')
    })
  })

  describe('JSON at start with trailing text (the s.log bug)', () => {
    it('parses tool_calls JSON followed by trailing text without separator', () => {
      const text =
        '{"tool_calls":[{"tool_name":"grep","arguments":{"pattern":"\\\\.xxxx/skills","path":"/Users/someone/gitlab/xxx-xxxx-agent-cli"}},{"tool_name":"glob","arguments":{"pattern":"**/.xxxx/skills/**"}},{"tool_name":"listFiles","arguments":{"path":"/Users/someone/gitlab/xxx-xxxx-agent-cli/.xxxx"}}]}`.xxxx/skills` 没发现。\n当前仓库里 skill 相关主要是：`.agents/skills/`。'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(3)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
      expect(toolCalls[2]!.name).toBe('listFiles')
      expect(content).toContain('.xxxx/skills')
    })

    it('parses tool_calls JSON followed by newline and text', () => {
      const text =
        '{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/x.ts"}}]}\n文件内容如下...'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(content).toBe('文件内容如下...')
    })

    it('parses tool_calls JSON string with newline', () => {
      const text = `{"tool_calls":[{"tool_name":"fileEdit","arguments":{"filePath":"/Users/someone/gitlab/tyyf6hyazx6l0sgrbr/src/components/bottom-bar/index.tsx","old_string":"      <View\n        className={styles.btns}\n        style={{\n          paddingBottom: isIphoneX ? '40rpx' : '0rpx',\n        }}\n      >\n        {showButtons.map(item => {\n","new_string":"      <View\n        className={styles.btns}\n        style={{\n          paddingBottom: isIphoneX\n            ? 'calc(40rpx + env(safe-area-inset-bottom))'\n            : 'env(safe-area-inset-bottom)',\n        }}\n      >\n        {showButtons.map(item => {\n"}}},{"tool_name":"glob","arguments":{"pattern":"package.json","path":"/Users/someone/gitlab/tyyf6hyazx6l0sgrbr"}},{"tool_name":"glob","arguments":{"pattern":"pnpm-lock.yaml","path":"/Users/someone/gitlab/tyyf6hyazx6l0sgrbr"}}]}`
      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(content).toBe('')
      expect(toolCalls).toHaveLength(3)
      expect(toolCalls[0]!.name).toBe('fileEdit')
      expect(toolCalls[1]!.name).toBe('glob')
      expect(toolCalls[2]!.name).toBe('glob')
      expect(toolCalls[0]!.arguments).toMatchObject({
        filePath:
          '/Users/someone/gitlab/tyyf6hyazx6l0sgrbr/src/components/bottom-bar/index.tsx',
      })
    })
  })

  describe('Format 0.5: text followed by tool_calls JSON', () => {
    it('parses text before JSON block', () => {
      const text =
        '让我来查看一下\n{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(content).toBe('让我来查看一下')
    })
  })

  describe('[tool_calls] marker format', () => {
    it('parses [tool_calls] with consecutive JSON objects', () => {
      const text =
        '我来搜索一下\n[tool_calls]{"tool":"grep","args":{"pattern":"hello"}}{"tool":"glob","args":{"pattern":"*.ts"}}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
      expect(content).toBe('我来搜索一下')
    })
  })

  describe('Action/Arguments format', () => {
    it('parses Action and Arguments text format', () => {
      const text = 'Action: fileRead\nArguments: {"filePath":"/tmp/test.ts"}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/test.ts' })
    })
  })

  describe('XML tag format', () => {
    it('parses XML-style tool calls', () => {
      const text = '<fileRead>{"filePath":"/tmp/a.ts"}</fileRead>'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })

    it('ignores thinking/reflection tags', () => {
      const text =
        '<thinking>{"internal":"reasoning"}</thinking>\n<fileRead>{"filePath":"/a.ts"}</fileRead>'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
    })
  })

  describe('[Called tools: ...] format', () => {
    it('parses single called tool', () => {
      const text = '● [Called tools: fileRead({"filePath":"/tmp/a.ts"})]'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })

    it('parses multiple called tools', () => {
      const text =
        '● [Called tools: grep({"pattern":"foo"}), glob({"pattern":"*.ts"})]'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
    })
  })

  describe('function_call format (GPT3.5/4 legacy)', () => {
    it('parses function_call format', () => {
      const text = JSON.stringify({
        function_call: {
          name: 'fileRead',
          arguments: JSON.stringify({ filePath: '/tmp/a.ts' }),
        },
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })
  })

  describe('Claude tool_use content block', () => {
    it('parses claude tool_use block', () => {
      const text = JSON.stringify({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'fileRead',
            input: { filePath: '/tmp/a.ts' },
          },
        ],
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })

    it('parses multiple tool_use blocks in content array', () => {
      const text = JSON.stringify({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'grep',
            input: { pattern: 'foo' },
          },
          {
            type: 'tool_use',
            id: 'toolu_2',
            name: 'glob',
            input: { pattern: '*.ts' },
          },
        ],
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
    })
  })

  describe('Claude standalone tool_use', () => {
    it('parses standalone tool_use object', () => {
      const text = JSON.stringify({
        type: 'tool_use',
        name: 'fileRead',
        input: { filePath: '/tmp/a.ts' },
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })
  })

  describe('OpenAI Responses API format', () => {
    it('parses responses api function_call', () => {
      const text = JSON.stringify({
        type: 'function_call',
        call_id: 'call_123',
        name: 'fileRead',
        arguments: JSON.stringify({ filePath: '/tmp/a.ts' }),
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })
  })

  describe('tool + args single object format', () => {
    it('parses tool + args format', () => {
      const text = JSON.stringify({
        tool: 'fileRead',
        args: { filePath: '/tmp/a.ts' },
      })

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })
  })

  describe('root array format', () => {
    it('parses root array tool calls', () => {
      const text = JSON.stringify([
        { tool: 'grep', args: { pattern: 'foo' } },
        { tool: 'glob', args: { pattern: '*.ts' } },
      ])

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[1]!.name).toBe('glob')
    })
  })

  describe('XML inside code block', () => {
    it('parses xml inside code block', () => {
      const text = `
\`\`\`xml
<fileRead>{"filePath":"/tmp/a.ts"}</fileRead>
\`\`\`
`

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
    })
  })

  describe('non-JSON arguments', () => {
    it('handles non-json arguments as value string', () => {
      const text = `
Action: grep
Arguments: foo
`

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[0]!.arguments).toEqual({ value: 'foo' })
    })

    it('handles multiline non-json arguments', () => {
      const text = `Action: grep
Arguments:
foo`

      const { toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(toolCalls[0]!.arguments).toEqual({ value: 'foo' })
    })
  })

  describe('plain text (no tool calls)', () => {
    it('returns text as content with empty toolCalls', () => {
      const text = '这是一段普通的回复文本，没有任何工具调用。'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(content).toBe(text)
      expect(toolCalls).toHaveLength(0)
    })

    it('handles empty string', () => {
      const { content, toolCalls } = parseLlmToolCalls('')

      expect(content).toBe('')
      expect(toolCalls).toHaveLength(0)
    })
  })

  describe('code block with tool_calls JSON', () => {
    it('parses tool_calls inside ```json code fence', () => {
      const text =
        '我来读取文件\n```json\n{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}\n```'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('fileRead')
      expect(content).toContain('我来读取文件')
    })
  })
})

describe('looksLikeToolCall', () => {
  it('detects JSON starting with {', () => {
    expect(looksLikeToolCall('{"tool_calls":[...]}')).toBe(true)
  })

  it('detects [tool_calls] marker', () => {
    expect(looksLikeToolCall('[tool_calls]{...}')).toBe(true)
  })

  it('detects Action: format', () => {
    expect(looksLikeToolCall('Action: fileRead\nArguments: {...}')).toBe(true)
  })

  it('detects embedded tool_calls JSON', () => {
    expect(looksLikeToolCall('一些文本 {"tool_calls":[...]}')).toBe(true)
  })

  it('detects [Called tools:] format', () => {
    expect(looksLikeToolCall('● [Called tools: grep(...)]')).toBe(true)
  })

  it('detects root array format', () => {
    expect(looksLikeToolCall('[{"tool":"grep","args":{}}]')).toBe(true)
  })

  it('detects function_call keyword', () => {
    expect(looksLikeToolCall('{"function_call":{"name":"fileRead"}}')).toBe(
      true
    )
  })

  it('detects tool_use keyword', () => {
    expect(looksLikeToolCall('{"type":"tool_use","name":"fileRead"}')).toBe(
      true
    )
  })

  it('returns false for plain text', () => {
    expect(looksLikeToolCall('这是一段普通回复')).toBe(false)
  })

  it('returns false for markdown content', () => {
    expect(looksLikeToolCall('## Heading\n\nSome content here')).toBe(false)
  })

  it('detects partial truncated tool_calls JSON during streaming', () => {
    expect(
      looksLikeToolCall('{"tool_calls":[{"tool_name":"listFiles","arguments')
    ).toBe(true)
  })

  it('detects tool_calls marker before opening brace', () => {
    expect(looksLikeToolCall('"tool_calls": [{"tool_name":"glob"')).toBe(true)
  })
})

describe('truncated / incomplete tool_calls JSON', () => {
  it('does not leak truncated JSON as content (ai.log scenario)', () => {
    const truncated = '{"tool_calls":[{"tool_name":"listFiles","arguments'
    const { content, toolCalls } = parseLlmToolCalls(truncated)

    expect(content).toBe('')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe('listFiles')
    expect(toolCalls[0]!.arguments).toEqual({})
  })

  it('repairs truncated arguments object', () => {
    const truncated =
      '{"tool_calls":[{"tool_name":"listFiles","arguments":{"path":"/Users/xxx/xxxx/yyy"'
    const { content, toolCalls } = parseLlmToolCalls(truncated)

    expect(content).toBe('')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe('listFiles')
    expect(toolCalls[0]!.arguments).toEqual({
      path: '/Users/xxx/xxxx/yyy',
    })
  })

  it('still parses complete JSON unchanged', () => {
    const complete =
      '{"tool_calls":[{"tool_name":"listFiles","arguments":{"path":"/Users/xxx/xxxx/yyy"}}]}'
    const { content, toolCalls } = parseLlmToolCalls(complete)

    expect(content).toBe('')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe('listFiles')
    expect(toolCalls[0]!.arguments).toEqual({
      path: '/Users/xxx/xxxx/yyy',
    })
  })

  it('preserves leading text when trailing JSON is truncated', () => {
    const text =
      '让我看看\n{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/a.ts"'
    const { content, toolCalls } = parseLlmToolCalls(text)

    expect(content).toBe('让我看看')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe('fileRead')
    expect(toolCalls[0]!.arguments).toEqual({ filePath: '/tmp/a.ts' })
  })
})
