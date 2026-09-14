/**
 * Prompt Signature Detection Module
 * Re-exports from unified signatures module
 *
 * This module provides backward compatibility for existing imports
 */
import { ChatMessage } from '../types';
import { ClientType, DetectionResult, CLIENT_SIGNATURES, GENERAL_TOOL_SIGNATURES, detectClientFromContent, hasGeneralToolPromptSignature, isKnownClient } from '../constants/signatures';
export type { ClientType, DetectionResult };
export { CLIENT_SIGNATURES, GENERAL_TOOL_SIGNATURES };
export { detectClientFromContent, hasGeneralToolPromptSignature, isKnownClient };
/**
 * Detect client prompt type from messages
 */
export declare function detectClientPromptType(messages: ChatMessage[]): DetectionResult;
/**
 * Check if any tool prompt has been injected
 */
export declare function hasAnyToolPromptInjected(messages: ChatMessage[]): boolean;
/**
 * Check if client has injected prompt
 */
export declare function hasClientPromptInjected(messages: ChatMessage[], clientType: ClientType): boolean;
/**
 * Clean tool prompts from messages (backward compatibility)
 */
export declare function cleanClientToolPrompts(messages: ChatMessage[]): ChatMessage[];
/**
 * Check if tool prompt is injected (backward compatibility)
 */
export declare function hasToolPromptInjected(messages: ChatMessage[]): boolean;
