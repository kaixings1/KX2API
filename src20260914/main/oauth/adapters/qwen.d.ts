/**
 * Qwen Authentication Adapter
 * Login using browser, extract tongyi_sso_ticket from cookies
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class QwenAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    private generateCookie;
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    loginWithToken(providerId: string, ticket: string): Promise<OAuthResult>;
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
    getSessionList(ticket: string): Promise<unknown[] | null>;
    deleteSession(sessionId: string, ticket: string): Promise<boolean>;
}
export default QwenAdapter;
