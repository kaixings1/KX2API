/**
 * MiniMax Authentication Adapter
 * Login using default browser, manually extract token
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class MiniMaxAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    /**
     * Start login flow - Open default browser
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with token
     * Supports both:
     * - token: JWT token only (realUserID will be extracted from JWT)
     * - token + realUserID: Will be combined as "realUserID+JWTtoken"
     */
    loginWithToken(providerId: string, token: string, realUserID?: string): Promise<OAuthResult>;
    /**
     * Handle callback (MiniMax does not support)
     */
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    /**
     * Validate token validity
     * Uses the same request format as proxy adapter
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    /**
     * Refresh token (MiniMax uses JWT, no refresh mechanism)
     */
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
    /**
     * Extract user ID from JWT token
     */
    private extractUserIdFromToken;
    /**
     * Get user credits/balance
     */
    getCredits(token: string): Promise<{
        totalCredits: number;
        usedCredits: number;
        remainingCredits: number;
    } | null>;
}
export default MiniMaxAdapter;
