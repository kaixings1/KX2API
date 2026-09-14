/**
 * Unified Tool Parser Module
 * Parses tool calls from multiple formats (bracket, XML, Anthropic, JSON)
 */
import { ToolCall } from '../types';
/**
 * Supported tool call formats
 */
export type ToolCallFormat = 'bracket' | 'xml' | 'anthropic' | 'json' | 'unknown';
/**
 * Parsed tool call result
 */
export interface UnifiedParseResult {
    content: string;
    toolCalls: ToolCall[];
    format: ToolCallFormat;
    rawMatches: string[];
}
/**
 * Detect the tool call format in content
 */
export declare function detectToolCallFormat(content: string): ToolCallFormat;
/**
 * Parse tool calls from content using all supported formats
 */
export declare function parseToolCallsUnified(content: string): UnifiedParseResult;
