/**
 * In-App Login Manager
 * Manages in-app browser window for OAuth login and token extraction
 */
import { EventEmitter } from 'events';
import { ProviderType } from './types';
export interface InAppLoginResult {
    success: boolean;
    credentials?: Record<string, string>;
    error?: string;
}
export interface TokenFoundEvent {
    key: string;
    value: string;
}
export interface InAppLoginOptions {
    providerId: string;
    providerType: ProviderType;
    timeout?: number;
    proxyMode?: 'system' | 'none';
}
export declare class InAppLoginManager extends EventEmitter {
    private loginWindow;
    private loginSession;
    private foundTokens;
    private config;
    private isCompleted;
    private timeoutId;
    private resolvePromise;
    private loginStartTime;
    private lastTokenCheckTime;
    private options;
    constructor();
    startLogin(options: InAppLoginOptions): Promise<InAppLoginResult>;
    private createLoginWindow;
    private setupTokenInterception;
    private hasMinTimePassed;
    private delayedTokenCheck;
    private isValidToken;
    private checkForTokens;
    completeWithSuccess(credentials: Record<string, string>): void;
    private complete;
    private cleanup;
    cancel(): void;
    isWindowOpen(): boolean;
    destroy(): void;
}
export declare const inAppLoginManager: InAppLoginManager;
export default InAppLoginManager;
