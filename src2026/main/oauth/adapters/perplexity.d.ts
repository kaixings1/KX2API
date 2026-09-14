/**
 * Perplexity Authentication Adapter
 * Authentication method: Cookie-based authentication with in-app browser login
 *
 * Note: Perplexity uses Cloudflare protection, so we cannot validate tokens
 * via API calls. We accept cookies directly as valid credentials.
 */
import { BaseOAuthAdapter } from './base';
import { OAuthResult, OAuthOptions, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthCallbackData } from '../types';
export declare class PerplexityAdapter extends BaseOAuthAdapter {
    constructor(config: AdapterConfig);
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    loginWithCookies(providerId: string, cookies: Record<string, string>): Promise<OAuthResult>;
    protected processCallback(data: OAuthCallbackData): Promise<void>;
    validateToken(credentials: Record<string, string>): Promise<TokenValidationResult>;
    refreshToken(credentials: Record<string, string>): Promise<CredentialInfo | null>;
}
export default PerplexityAdapter;
