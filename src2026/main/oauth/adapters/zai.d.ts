/**
 * Z.ai Adapter
 * Implements Z.ai (GLM International) API protocol
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, TokenValidationResult, AdapterConfig, OAuthCallbackData } from '../types';
export declare class ZaiAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    /**
     * Complete authentication with manually entered token
     */
    loginWithToken(providerId: string, token: string): Promise<OAuthResult>;
    /**
     * Handle callback (Z.ai does not support)
     */
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    /**
     * Validate token validity
     */
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
}
