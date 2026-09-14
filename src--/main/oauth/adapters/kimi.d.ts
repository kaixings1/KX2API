/**
 * Kimi Authentication Adapter
 * Login using default browser, manually extract token
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class KimiAdapter extends BaseOAuthAdapter {
    private deviceId;
    private sessionId;
    constructor(config: AdapterConfig);
    /**
     * Generate device ID
     */
    private generateDeviceId;
    /**
     * Generate session ID
     */
    private generateSessionId;
    /**
     * Detect token type
     * Reference: detectTokenType function from Kimi-Free-API
     */
    detectTokenType(token: string): 'jwt' | 'refresh';
    /**
     * Extract device ID from JWT token
     */
    private extractDeviceIdFromJWT;
    /**
     * Extract session ID from JWT token
     */
    private extractSessionIdFromJWT;
    /**
     * Extract user ID from JWT token
     */
    private extractUserIdFromJWT;
    /**
     * Get request headers
     */
    private getHeaders;
    private callGrpcApi;
    /**
     * Start login flow - Open default browser
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with token
     */
    loginWithToken(providerId: string, token: string): Promise<OAuthResult>;
    /**
     * Handle callback (Kimi does not support)
     */
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    /**
     * Validate token validity using gRPC API
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    /**
     * Refresh token - Kimi no longer supports refresh token API
     */
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
    /**
     * Get research version usage
     */
    getResearchUsage(token: string): Promise<{
        remain: number;
        total: number;
        used: number;
    } | null>;
}
export default KimiAdapter;
