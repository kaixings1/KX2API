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
 */
export function roughTokenCount(
	content: string,
	bytesPerToken: number = 4,
): number {
	return Math.round(content.length / bytesPerToken)
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
		return roughTokenCount(block)
	}

	switch (block.type) {
		case 'text':
			return roughTokenCount(block.text ?? '')
		case 'image':
		case 'document':
			return 2000
		case 'tool_use':
			return roughTokenCount(
				(block.name ?? '') + JSON.stringify(block.input ?? {}),
			)
		case 'tool_result':
			return estimateContentTokens(block.content)
		case 'thinking':
			return roughTokenCount(block.thinking ?? '')
		case 'redacted_thinking':
			return roughTokenCount(block.data ?? '')
		default:
			return roughTokenCount(JSON.stringify(block))
	}
}

/**
 * Estimate tokens for a content array (message content blocks).
 */
export function estimateContentTokens(
	content: ContentBlock[] | string | undefined,
): number {
	if (!content) return 0
	if (typeof content === 'string') return roughTokenCount(content)

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
