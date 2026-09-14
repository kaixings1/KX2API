/**
 * Token Extraction Configuration
 * Defines how to extract tokens from different providers
 */
import { ProviderType } from './types';
export type TokenSourceType = 'networkHeader' | 'localStorage' | 'cookie';
export interface TokenSource {
    type: TokenSourceType;
    key: string;
    urlPattern?: string;
    extractPattern?: string;
}
export interface TokenExtractionConfig {
    loginUrl: string;
    tokenSources: TokenSource[];
    targetDomains: string[];
    successUrlPatterns?: RegExp[];
    windowTitle?: string;
}
export declare const TOKEN_EXTRACTION_CONFIGS: Record<ProviderType, TokenExtractionConfig>;
export declare function getTokenExtractionConfig(providerType: ProviderType): TokenExtractionConfig | null;
