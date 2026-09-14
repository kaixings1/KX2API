/**
 * DeepSeek Authentication Adapter
 * Authentication method: Login using default browser, manually extract token
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class DeepSeekAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    /**
     * Start login flow - Open default browser
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with manually entered token
     */
    loginWithToken(providerId: string, token: string): Promise<OAuthResult>;
    /**
     * Handle callback (DeepSeek does not support)
     */
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    /**
     * Validate token validity
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    /**
     * Refresh token
     */
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
}
export default DeepSeekAdapter;
