import { describe, expect, it } from 'vitest'

import { looksLikeToolCall, parseLlmToolCalls } from '../parser'

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
        '{"tool_calls":[{"tool_name":"glob","arguments":{"pattern":"*.ts"}},{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/b.ts"}}]}{"tool_calls":[{"tool_name":"fileEdit","arguments":{"filePath":"/c.ts"}}]}'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(4)
      expect(toolCalls[0]!.name).toBe('glob')
      expect(toolCalls[1]!.name).toBe('fileRead')
      expect(toolCalls[2]!.name).toBe('fileRead')
      expect(toolCalls[3]!.name).toBe('fileEdit')
      expect(content).toBe('')
    })
  })

  describe('JSON at start with trailing text', () => {
    it('parses tool_calls JSON followed by trailing text without separator', () => {
      const text =
        '{"tool_calls":[{"tool_name":"grep","arguments":{"pattern":"foo"}}]} trailing text'

      const { content, toolCalls } = parseLlmToolCalls(text)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.name).toBe('grep')
      expect(content).toBe('trailing text')
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
  })

  describe('function_call format', () => {
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

  describe('truncated / incomplete tool_calls JSON', () => {
    it('does not leak truncated JSON as content', () => {
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

  it('returns false for plain text', () => {
    expect(looksLikeToolCall('这是一段普通回复')).toBe(false)
  })

  it('returns false for markdown content', () => {
    expect(looksLikeToolCall('## Heading\n\nSome content here')).toBe(false)
  })
})
