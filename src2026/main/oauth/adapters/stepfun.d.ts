/**
 * StepFun Adapter
 * Implements StepFun (阶跃星辰) API key authentication
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, AdapterConfig } from '../types';
export declare class StepFunOAuthAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    /**
     * Start login flow - Open default browser to platform.stepfun.com
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with API key
     */
    loginWithToken(providerId: string, token: string): Promise<OAuthResult>;
    /**
     * Validate token - supports both API key (sk-*) and session token (Oasis-Token)
     * Oasis-Token can be JWT or other formats; web API accepts it via Cookie header
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    private validateApiKey;
    private validateJwtToken;
}
