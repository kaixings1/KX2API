/**
 * OAuth Adapter Base Class
 * Defines common interface and base implementation for all provider authentication adapters
 */
import { BrowserWindow } from 'electron';
import http from 'http';
import { ProviderType, AuthMethod, OAuthResult, OAuthOptions, OAuthCallbackData, TokenValidationResult, CredentialInfo, AdapterConfig, OAuthProgressEvent } from './types';
/**
 * OAuth adapter abstract base class
 */
export declare abstract class BaseOAuthAdapter {
    protected config: AdapterConfig;
    protected callbackServer: http.Server | null;
    protected callbackPort: number;
    protected state: string;
    protected mainWindow: BrowserWindow | null;
    protected progressCallback: ((event: OAuthProgressEvent) => void) | null;
    constructor(config: AdapterConfig);
    /**
     * Get provider type
     */
    getProviderType(): ProviderType;
    /**
     * Get supported authentication methods
     */
    getSupportedAuthMethods(): AuthMethod[];
    /**
     * Set main window reference
     */
    setMainWindow(window: BrowserWindow): void;
    /**
     * Set progress callback
     */
    setProgressCallback(callback: (event: OAuthProgressEvent) => void): void;
    /**
     * Emit progress event
     */
    protected emitProgress(status: OAuthProgressEvent['status'], message: string, data?: Record<string, unknown>): void;
    /**
     * Generate random state string
     */
    protected generateState(): string;
    /**
     * Validate state string
     */
    protected validateState(state: string): boolean;
    /**
     * Create local callback server
     */
    protected createCallbackServer(): Promise<number>;
    /**
     * Close callback server
     */
    protected closeCallbackServer(): void;
    /**
     * Handle OAuth callback
     */
    protected handleCallback(req: http.IncomingMessage, res: http.ServerResponse): void;
    /**
     * Open URL in system browser
     */
    protected openBrowser(url: string): Promise<void>;
    /**
     * Start OAuth login flow
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Cancel login flow
     */
    cancelLogin(): Promise<void>;
    /**
     * Process callback data
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
    /**
     * Get login URL
     */
    protected getLoginUrl(): string;
    /**
     * Get API URL
     */
    protected getApiUrl(): string;
    /**
     * Generate UUID
     */
    protected generateUUID(): string;
    /**
     * Generate MD5 hash
     */
    protected md5(input: string): string;
    /**
     * Get current timestamp (seconds)
     */
    protected getTimestamp(): number;
    /**
     * Get current timestamp (milliseconds)
     */
    protected getTimestampMs(): number;
    /**
     * Parse JWT token
     */
    protected parseJWT(token: string): Record<string, unknown> | null;
    /**
     * Check if it is a JWT token
     */
    protected isJWT(token: string): boolean;
    /**
     * Clean up resources
     */
    destroy(): void;
}
export default BaseOAuthAdapter;
