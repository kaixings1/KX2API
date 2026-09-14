/**
 * Unified Signature Definitions
 * Central definition for all tool prompt signatures
 */
/**
 * Client types that may inject tool prompts
 */
export type ClientType = 'cline' | 'rooCode' | 'claudeCode' | 'cherryStudio' | 'kilocode' | 'codexCli' | 'vscodeAgent' | 'unknown';
/**
 * Tool call output format
 */
export type ToolCallFormat = 'bracket' | 'xml' | 'anthropic' | 'json' | 'native' | 'managed_xml' | 'kimi';
/**
 * Client signature configuration
 */
export interface ClientSignatureConfig {
    id: ClientType;
    name: string;
    detectPatterns: string[];
    toolCallFormat: ToolCallFormat;
    injectsPrompt: boolean;
    promptSectionMarkers?: {
        start: string;
        end: string;
    };
}
/**
 * Client signature registry
 * Each client has detection patterns and tool call format
 */
export declare const CLIENT_SIGNATURES: Record<ClientType, ClientSignatureConfig>;
/**
 * General tool prompt signatures
 * Used to detect if any tool prompt has been injected
 */
export declare const GENERAL_TOOL_SIGNATURES: string[];
/**
 * Format-specific signatures
 * Used to detect the output format of tool calls
 */
export declare const FORMAT_SIGNATURES: Record<ToolCallFormat, string[]>;
/**
 * Detection result with confidence level
 */
export interface DetectionResult {
    clientType: ClientType;
    confidence: number;
    matchedSignatures: string[];
    toolCallFormat: ToolCallFormat;
    injectsPrompt: boolean;
}
/**
 * Tool source type
 */
export type ToolSource = 'openai' | 'mcp' | 'none';
/**
 * Tool detection result
 */
export interface ToolDetectionResult {
    source: ToolSource;
    tools: any[] | null;
    hasMCPDefinitions: boolean;
}
/**
 * Check if content contains any general tool prompt signature
 */
export declare function hasGeneralToolPromptSignature(content: string): boolean;
/**
 * Detect client type from content
 */
export declare function detectClientFromContent(content: string): DetectionResult;
/**
 * Detect tool call format from content
 */
export declare function detectToolCallFormat(content: string): ToolCallFormat;
/**
 * Get client signature config by type
 */
export declare function getClientSignature(clientType: ClientType): ClientSignatureConfig;
/**
 * Get all known client types
 */
export declare function getKnownClientTypes(): ClientType[];
/**
 * Check if client type is known
 */
export declare function isKnownClient(clientType: ClientType): boolean;
