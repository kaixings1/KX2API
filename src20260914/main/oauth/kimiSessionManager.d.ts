/**
 * Kimi Persistent Session Manager
 *
 * Maintains a hidden BrowserWindow with a persistent session partition
 * to keep Kimi login state alive, similar to how browser cookies work.
 *
 * When the JWT token expires, the adapter can read a fresh cookie
 * from this session instead of requiring the user to manually re-login.
 */
import { EventEmitter } from 'events';
export interface KimiSessionManagerEvents {
    'token-found': (token: string) => void;
    'token-expired': () => void;
    'session-ready': () => void;
    'session-error': (error: Error) => void;
}
export declare class KimiSessionManager extends EventEmitter {
    private window;
    private session;
    private currentToken;
    private refreshTimer;
    private isReady;
    private refreshCount;
    private maxRefreshCount;
    constructor();
    /**
     * Initialize the persistent Kimi session
     */
    initialize(): Promise<void>;
    /**
     * Extract the current token from cookies
     */
    extractToken(): Promise<string | null>;
    /**
     * Get the current token
     */
    getToken(): string | null;
    /**
     * Check if the session is ready
     */
    ready(): boolean;
    /**
     * Refresh the session by reloading the Kimi page
     */
    refreshSession(): Promise<string | null>;
    /**
     * Start periodic session refresh
     */
    private startPeriodicRefresh;
    /**
     * Stop the session manager
     */
    destroy(): void;
}
/**
 * Singleton instance
 */
export declare const kimiSessionManager: KimiSessionManager;
export default kimiSessionManager;
