import type { ChatMessage } from '../types';
import type { ToolCallingPlan } from './types';
export interface HistoryValidationIssue {
    code: string;
    message: string;
    severity: 'error' | 'warning';
    index: number;
    relatedIndex?: number;
    toolCallId?: string;
    fixable?: boolean;
}
export interface HistoryValidationResult {
    valid: boolean;
    errors: HistoryValidationIssue[];
    warnings: HistoryValidationIssue[];
}
export interface HistoryFixResult extends HistoryValidationResult {
    fixedMessages: ChatMessage[];
}
/**
 * Validates message history for tool call / tool result structural issues.
 * Detects:
 *  - tool_result_ordering: result not immediately after its call
 *  - duplicate_tool_result: same result appears twice
 *  - tool_result_before_call: result appears before the call
 *  - tool_result_without_call: result has no matching call
 *  - tool_call_without_result: call has no matching result
 */
export declare function validateToolHistory(messages: ChatMessage[], _options?: {
    plan?: ToolCallingPlan;
}): HistoryValidationResult;
/**
 * Fixes structural issues in message history:
 *  - reorderAdjacentToolResults: reorder result messages that follow their call
 *  - dedupeToolResults: remove duplicate result messages
 *  - removeOrphanToolResults: remove results with no matching call
 */
export declare function fixToolHistory(messages: ChatMessage[], options?: {
    plan?: ToolCallingPlan;
    reorderAdjacentToolResults?: boolean;
    dedupeToolResults?: boolean;
    removeOrphanToolResults?: boolean;
}): HistoryFixResult;
