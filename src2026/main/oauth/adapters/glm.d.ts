/**
 * GLM (Zhipu) Authentication Adapter
 * Authentication method: Login using default browser, manually extract refresh_token
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class GLMAdapter extends BaseOAuthAdapter {
    private pendingResolve;
    constructor(config: AdapterConfig);
    /**
     * Generate signature
     * GLM timestamp signature algorithm
     */
    private generateSign;
    /**
     * Start login flow - Open default browser
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with refresh_token
     */
    loginWithToken(providerId: string, refreshToken: string): Promise<OAuthResult>;
    /**
     * Handle callback (GLM does not support)
     */
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    /**
     * Validate token validity
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    /**
     * Refresh token
     * Get new access_token using refresh_token
     */
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
    /**
     * Get user info
     */
    getUserInfo(accessToken: string): Promise<Record<string, unknown> | null>;
}
export default GLMAdapter;
