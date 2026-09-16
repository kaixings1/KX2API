import { describe, it, expect } from 'vitest'
import {
	roughTokenCount,
	bytesPerTokenForFileType,
	roughTokenCountForFileType,
	estimateBlockTokens,
	estimateContentTokens,
	estimateMessageTokens,
	estimateMessagesTokens,
	countCjkChars,
	estimateTokensWithCjk,
	safeStringify,
} from '../index.ts'

describe('roughTokenCount', () => {
	it('returns 0 for empty string', () => {
		expect(roughTokenCount('')).toBe(0)
	})

	it('defaults to 4 chars per token', () => {
		expect(roughTokenCount('abcd')).toBe(1)
		expect(roughTokenCount('abcdefgh')).toBe(2)
	})

	it('uses custom bytesPerToken', () => {
		expect(roughTokenCount('abcd', 2)).toBe(2)
	})

	it('rounds to nearest integer', () => {
		expect(roughTokenCount('abcde', 4)).toBe(1) // 5/4 = 1.25 → Math.round = 1
	})
})

describe('bytesPerTokenForFileType', () => {
	it('returns 2 for json', () => {
		expect(bytesPerTokenForFileType('json')).toBe(2)
	})

	it('returns 2 for jsonl', () => {
		expect(bytesPerTokenForFileType('jsonl')).toBe(2)
	})

	it('returns 2 for jsonc', () => {
		expect(bytesPerTokenForFileType('jsonc')).toBe(2)
	})

	it('returns 4 for unknown types', () => {
		expect(bytesPerTokenForFileType('txt')).toBe(4)
		expect(bytesPerTokenForFileType('ts')).toBe(4)
		expect(bytesPerTokenForFileType('md')).toBe(4)
	})
})

describe('roughTokenCountForFileType', () => {
	it('uses json ratio for json content', () => {
		expect(roughTokenCountForFileType('{"a":1}', 'json')).toBe(4) // 8 chars / 2 = 4
	})

	it('uses default ratio for txt content', () => {
		expect(roughTokenCountForFileType('hello world', 'txt')).toBe(3) // 11 / 4 = 2.75 → 3
	})
})

describe('estimateBlockTokens', () => {
	it('handles string input', () => {
		expect(estimateBlockTokens('hello')).toBe(1) // 5/4 = 1.25 → Math.round = 1
	})

	it('handles text block', () => {
		expect(estimateBlockTokens({ type: 'text', text: 'hello' })).toBe(1)
	})

	it('handles image/document block', () => {
		expect(estimateBlockTokens({ type: 'image' })).toBe(2000)
		expect(estimateBlockTokens({ type: 'document' })).toBe(2000)
	})

	it('handles tool_use block', () => {
		const block = { type: 'tool_use', name: 'read', input: { path: '/tmp' } }
		expect(estimateBlockTokens(block)).toBeGreaterThan(0)
	})

	it('handles thinking block', () => {
		expect(estimateBlockTokens({ type: 'thinking', thinking: 'let me think...' })).toBeGreaterThan(0)
	})

	it('handles redacted_thinking block', () => {
		expect(estimateBlockTokens({ type: 'redacted_thinking', data: 'REDACTED' })).toBe(2) // 8/4 = 2
	})

	it('falls back to JSON.stringify for unknown types', () => {
		const block = { type: 'mcp_tool_use', input: { foo: 'bar' } }
		expect(estimateBlockTokens(block)).toBeGreaterThan(0)
	})
})

describe('estimateContentTokens', () => {
	it('returns 0 for undefined', () => {
		expect(estimateContentTokens(undefined)).toBe(0)
	})

	it('handles string content', () => {
		expect(estimateContentTokens('hello')).toBe(1) // 5/4 = 1.25 → Math.round = 1
	})

	it('sums tokens for array of blocks', () => {
		const blocks = [
			{ type: 'text', text: 'hi' },
			{ type: 'text', text: 'there' },
		]
		expect(estimateContentTokens(blocks)).toBe(2) // "hi"(0.5→1) + "there"(1.25→1) = 2
	})
})

describe('estimateMessageTokens', () => {
	it('returns 0 for non-assistant/user types', () => {
		expect(estimateMessageTokens({ type: 'system' })).toBe(0)
	})

	it('returns 0 when no content', () => {
		expect(estimateMessageTokens({ type: 'user' })).toBe(0)
	})

	it('estimates assistant message with content', () => {
		expect(estimateMessageTokens({ type: 'assistant', message: { content: 'hello' } })).toBe(1) // 5/4 = 1.25 → 1
	})

	it('estimates user message with content', () => {
		expect(estimateMessageTokens({ type: 'user', message: { content: 'world' } })).toBe(1)
	})
})

describe('countCjkChars', () => {
	it('returns 0 for pure Latin text', () => {
		expect(countCjkChars('hello world')).toBe(0)
	})

	it('counts CJK ideographs', () => {
		expect(countCjkChars('你好世界')).toBe(4)
	})

	it('counts CJK punctuation and fullwidth forms', () => {
		expect(countCjkChars('，。！')).toBe(3)
	})

	it('counts only the CJK portion of mixed text', () => {
		expect(countCjkChars('hello 你好')).toBe(2)
	})

	it('ignores ASCII digits and punctuation', () => {
		expect(countCjkChars('abc123!@#')).toBe(0)
	})
})

describe('estimateTokensWithCjk', () => {
	it('returns 0 for empty string', () => {
		expect(estimateTokensWithCjk('')).toBe(0)
	})

	it('matches the Latin ratio for purely Latin text', () => {
		expect(estimateTokensWithCjk('abcdefgh', 4)).toBe(2)
	})

	it('uses 1.5 chars per token for CJK text', () => {
		// 12 CJK chars / 1.5 = 8 tokens
		expect(estimateTokensWithCjk('你好世界你好世界你好世界')).toBe(8)
	})

	it('does not undercount CJK the way a flat /4 ratio does', () => {
		const chinese = '这是一段中文内容用于验证估算准确性'
		const flat = roughTokenCount(chinese, 4)
		const aware = estimateTokensWithCjk(chinese)
		expect(aware).toBeGreaterThan(flat * 2)
	})

	it('blends ratios for mixed Latin and CJK content', () => {
		// 8 Latin chars / 4 = 2 tokens, plus 3 CJK chars / 1.5 = 2 tokens
		expect(estimateTokensWithCjk('abcdefgh你好啊')).toBe(4)
	})
})

describe('safeStringify', () => {
	it('returns empty string for nullish input', () => {
		expect(safeStringify(null)).toBe('')
	})

	it('passes strings through unchanged', () => {
		expect(safeStringify('hello')).toBe('hello')
	})

	it('serializes plain objects', () => {
		expect(safeStringify({ a: 1 })).toBe('{"a":1}')
	})

	it('does not throw on circular references', () => {
		const obj: Record<string, unknown> = { a: 1 }
		obj.self = obj
		expect(() => safeStringify(obj)).not.toThrow()
	})
})

describe('CJK awareness of block estimation', () => {
	it('estimates Chinese text blocks above the flat ratio', () => {
		const block = { type: 'thinking', thinking: '让我思考一下这个问题' }
		expect(estimateBlockTokens(block)).toBeGreaterThan(
			roughTokenCount('让我思考一下这个问题', 4),
		)
	})

	it('does not throw on a block with a circular input', () => {
		const input: Record<string, unknown> = { name: 'x' }
		input.self = input
		expect(() =>
			estimateBlockTokens({ type: 'tool_use', name: 't', input }),
		).not.toThrow()
	})
})

describe('estimateMessagesTokens', () => {
	it('returns 0 for empty array', () => {
		expect(estimateMessagesTokens([])).toBe(0)
	})

	it('sums tokens across messages', () => {
		const messages = [
			{ type: 'user', message: { content: 'hi' } },
			{ type: 'assistant', message: { content: 'hello' } },
		]
		expect(estimateMessagesTokens(messages)).toBe(2) // "hi"(0.5→1) + "hello"(1.25→1) = 2
	})
})
