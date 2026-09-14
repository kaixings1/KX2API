/**
 * Client Detector Module
 * Detects client type and tool source from messages
 */
import { ChatMessage } from '../types';
import { ClientType, ToolCallFormat, ToolSource } from '../constants/signatures';
/**
 * Client detection result
 */
export interface ClientDetectionResult {
    clientType: ClientType;
    isKnownClient: boolean;
    toolSource: ToolSource;
    toolCallFormat: ToolCallFormat;
    injectsPrompt: boolean;
    confidence: number;
    matchedSignatures: string[];
    tools: any[] | null;
    hasMCPDefinitions: boolean;
}
/**
 * Tool detection result
 */
export interface ToolDetectionResult {
    source: ToolSource;
    tools: any[] | null;
    hasMCPDefinitions: boolean;
}
/**
 * Detect client and tool information from messages
 */
export declare function detectClient(messages: ChatMessage[], openaiTools?: any[]): ClientDetectionResult;
/**
 * Check if any tool prompt has been injected
 */
export declare function hasToolPromptInjected(messages: ChatMessage[]): boolean;
/**
 * Check if client has injected prompt
 */
export declare function hasClientInjectedPrompt(messages: ChatMessage[]): boolean;
/**
 * Get tool call format for client
 */
export declare function getToolCallFormatForClient(clientType: ClientType): ToolCallFormat;
/**
 * Get prompt section markers for client
 */
export declare function getPromptSectionMarkers(clientType: ClientType): {
    start: string;
    end: string;
} | null;
/**
 * Remove tool prompt section from content
 */
export declare function removeToolPromptSection(content: string, clientType: ClientType): string;
/**
 * Clean tool prompts from messages
 */
export declare function cleanToolPrompts(messages: ChatMessage[]): ChatMessage[];
export type { ClientType, ToolCallFormat, ToolSource };
