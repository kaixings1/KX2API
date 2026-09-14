/**
 * Credential Storage Module - Credential Validation
 * Validate credentials for each provider
 */
import { Provider, ValidationResult } from './types';
/**
 * Validate credential validity
 * @param provider Provider configuration
 * @param credentials Credential data
 * @returns Validation result
 */
export declare function validateCredentials(provider: Provider, credentials: Record<string, string>): Promise<ValidationResult>;
/**
 * Batch validate credentials
 * @param providers Provider list
 * @param credentialsMap Credential mapping (provider ID -> credentials)
 * @returns Validation result mapping
 */
export declare function validateCredentialsBatch(providers: Provider[], credentialsMap: Map<string, Record<string, string>>): Promise<Map<string, ValidationResult>>;
/**
 * Quick validate OpenAI API Key
 * @param apiKey API Key
 * @returns Validation result
 */
export declare function validateOpenAIKey(apiKey: string): Promise<ValidationResult>;
/**
 * Quick validate Claude API Key
 * @param apiKey API Key
 * @returns Validation result
 */
export declare function validateClaudeKey(apiKey: string): Promise<ValidationResult>;
/**
 * Quick validate ChatGPT Cookie
 * @param cookie Cookie string
 * @returns Validation result
 */
export declare function validateChatGPTCookie(cookie: string): Promise<ValidationResult>;
declare const _default: {
    validateCredentials: typeof validateCredentials;
    validateCredentialsBatch: typeof validateCredentialsBatch;
    validateOpenAIKey: typeof validateOpenAIKey;
    validateClaudeKey: typeof validateClaudeKey;
    validateChatGPTCookie: typeof validateChatGPTCookie;
};
export default _default;
