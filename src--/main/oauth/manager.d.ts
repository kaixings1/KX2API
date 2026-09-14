/**
 * OAuth Flow Manager
 * Manages authentication flows for providers, including local callback server and browser login
 */
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { ProviderType, OAuthResult, OAuthOptions, OAuthStatus, TokenValidationResult, CredentialInfo } from './types';
/**
 * OAuth Manager class
 */
export declare class OAuthManager extends EventEmitter {
    private adapters;
    private mainWindow;
    private currentLogin;
    constructor();
    /**
     * Set main window reference
     */
    setMainWindow(window: BrowserWindow): void;
    /**
     * Get or create adapter
     */
    private getAdapter;
    /**
     * Send progress to renderer process
     */
    private sendProgressToRenderer;
    /**
     * Start OAuth login flow
     */
    startLogin(options: OAuthOptions): Promise<OAuthResult>;
    /**
     * Complete authentication with manually entered token
     */
    loginWithToken(providerId: string, providerType: ProviderType, token: string, realUserID?: string, mimoUserId?: string, mimoPhToken?: string): Promise<OAuthResult>;
    /**
     * Cancel current login flow
     */
    cancelLogin(): Promise<void>;
    /**
     * Clean up current login state
     */
    private cleanup;
    /**
     * Validate Token
     */
    validateToken(providerId: string, providerType: ProviderType, credentials: Record<string, string>): Promise<TokenValidationResult>;
    /**
     * Refresh Token
     */
    refreshToken(providerId: string, providerType: ProviderType, credentials: Record<string, string>): Promise<CredentialInfo | null>;
    /**
     * Open browser
     */
    openBrowser(url: string): Promise<void>;
    /**
     * Get current login status
     */
    getStatus(): OAuthStatus;
    /**
     * Start in-app login flow
     * Opens a new browser window within the app for login
     * Automatically extracts token after successful login
     */
    startInAppLogin(providerId: string, providerType: ProviderType, timeout?: number, proxyMode?: 'system' | 'none'): Promise<OAuthResult>;
    /**
     * Cancel in-app login
     */
    cancelInAppLogin(): void;
    /**
     * Check if in-app login window is open
     */
    isInAppLoginOpen(): boolean;
    /**
     * Destroy manager
     */
    destroy(): void;
}
/**
 * Singleton instance
 */
export declare const oauthManager: OAuthManager;
export default OAuthManager;
