/**
 * Token counting utilities for estimating token usage.
 *
 * Provides both local estimation (no API required) and helper functions
 * for file-type-aware token counting.
 *
 * All functions in this module are provider-agnostic and require no external SDK.
 */

/**
 * Rough token count estimation based on character length.
 *
 * Uses a bytes-per-token ratio: typically 4 characters per token for
 * English text, but JSON/JSONL/JSONC is denser (~2 chars per token).
 *
 * NOTE: the ratio above only holds for Latin text. CJK characters are
 * far denser — roughly 1 token per 1.5 characters — so a pure
 * `length / 4` estimate undercounts Chinese/Japanese/Korean content by
 * more than 2x. Use `estimateTokensWithCjk` when the text may be CJK.
 */
export function roughTokenCount(
	content: string,
	bytesPerToken: number = 4,
): number {
	return Math.round(content.length / bytesPerToken)
}

/** Characters-per-token ratio for CJK text (Chinese/Japanese/Korean). */
export const CJK_CHARS_PER_TOKEN = 1.5

/**
 * Count CJK code points in a string.
 *
 * Covers CJK Unified Ideographs, Extension A, compatibility ideographs,
 * CJK punctuation and fullwidth forms.
 */
export function countCjkChars(text: string): number {
	let n = 0
	for (const ch of text) {
		const code = ch.codePointAt(0)!
		if (
			(code >= 0x4e00 && code <= 0x9fff) ||
			(code >= 0x3400 && code <= 0x4dbf) ||
			(code >= 0xf900 && code <= 0xfaff) ||
			(code >= 0x3000 && code <= 0x303f) ||
			(code >= 0xff00 && code <= 0xffef)
		) {
			n++
		}
	}
	return n
}

/**
 * Serialize an arbitrary value to a string without throwing.
 * JSON.stringify returns a non-string for nullish input and throws on
 * circular references; both would otherwise break token estimation.
 */
export function safeStringify(value: unknown): string {
	if (value == null) return ''
	if (typeof value === 'string') return value
	try {
		return JSON.stringify(value) ?? ''
	} catch {
		return String(value)
	}
}

/**
 * Estimate tokens for text that may mix Latin and CJK.
 *
 * Splits the character count by script and applies the appropriate ratio
 * to each part, so a Chinese-heavy conversation is no longer undercounted.
 * `bytesPerToken` applies only to the non-CJK portion.
 */
export function estimateTokensWithCjk(
	content: string,
	bytesPerToken: number = 4,
): number {
	if (content.length === 0) return 0
	const cjk = countCjkChars(content)
	if (cjk === 0) return Math.round(content.length / bytesPerToken)
	const latin = content.length - cjk
	return Math.ceil(latin / bytesPerToken + cjk / CJK_CHARS_PER_TOKEN)
}

/**
 * Returns an estimated bytes-per-token ratio for a given file extension.
 *
 * Dense formats like JSON have many single-character tokens ({, }, :, ,, ")
 * so the real ratio is closer to 2. Plain text defaults to 4.
 */
export function bytesPerTokenForFileType(fileExtension: string): number {
	switch (fileExtension) {
		case 'json':
		case 'jsonl':
		case 'jsonc':
			return 2
		default:
			return 4
	}
}

/**
 * Estimates token count using a file-type-aware bytes-per-token ratio.
 */
export function roughTokenCountForFileType(
	content: string,
	fileExtension: string,
): number {
	return roughTokenCount(content, bytesPerTokenForFileType(fileExtension))
}

/**
 * Block type categories for token estimation.
 */
export type BlockType =
	| 'text'
	| 'image'
	| 'document'
	| 'tool_use'
	| 'tool_result'
	| 'thinking'
	| 'redacted_thinking'
	| string

export interface ContentBlock {
	type: BlockType
	text?: string
	thinking?: string
	data?: string
	name?: string
	input?: Record<string, unknown>
	content?: ContentBlock[] | string
}

/**
 * Estimate tokens for a single content block by its type.
 *
 * - text: characters / 4
 * - image / document: fixed 2000 (conservative estimate matching API billing)
 * - tool_use: name + stringified input
 * - tool_result: recursively estimate content
 * - thinking: thinking text length / 4
 * - redacted_thinking: data length / 4
 * - other: stringify the block and count characters / 4
 */
export function estimateBlockTokens(block: ContentBlock | string): number {
	if (typeof block === 'string') {
		return estimateTokensWithCjk(block)
	}

	switch (block.type) {
		case 'text':
			return estimateTokensWithCjk(block.text ?? '')
		case 'image':
		case 'document':
			return 2000
		case 'tool_use':
			return estimateTokensWithCjk(
				(block.name ?? '') + safeStringify(block.input ?? {}),
			)
		case 'tool_result':
			return estimateContentTokens(block.content)
		case 'thinking':
			return estimateTokensWithCjk(block.thinking ?? '')
		case 'redacted_thinking':
			return estimateTokensWithCjk(block.data ?? '')
		default:
			return estimateTokensWithCjk(safeStringify(block))
	}
}

/**
 * Estimate tokens for a content array (message content blocks).
 */
export function estimateContentTokens(
	content: ContentBlock[] | string | undefined,
): number {
	if (!content) return 0
	if (typeof content === 'string') return estimateTokensWithCjk(content)

	let total = 0
	for (const block of content) {
		total += estimateBlockTokens(block)
	}
	return total
}

/**
 * Estimate tokens for a single message.
 */
export function estimateMessageTokens(message: {
	type: string
	message?: { content?: ContentBlock[] | string }
}): number {
	if (
		(message.type === 'assistant' || message.type === 'user') &&
		message.message?.content
	) {
		return estimateContentTokens(
			message.message.content as ContentBlock[] | string,
		)
	}
	return 0
}

/**
 * Estimate total tokens for a list of messages.
 */
export function estimateMessagesTokens(
	messages: {
		type: string
		message?: { content?: ContentBlock[] | string }
	}[],
): number {
	return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}
