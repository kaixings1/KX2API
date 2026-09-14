/**
 * Qwen AI (International) Authentication Adapter
 * Implements chat.qwen.ai API authentication
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class QwenAiAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    loginWithToken(providerId: string, token: string): Promise<OAuthResult>;
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    getUserInfo(token: string): Promise<Record<string, unknown> | null>;
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
}
export default QwenAiAdapter;
