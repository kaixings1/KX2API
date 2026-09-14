/**
 * Credential Storage Module - Core Storage Implementation
 * Uses electron-store for persistent storage
 * Uses Electron's safeStorage API for sensitive data encryption
 */
import { BrowserWindow } from 'electron';
import { StoreSchema, AppConfig, Account, Provider, LogEntry, LogLevel, SystemPrompt, SessionRecord, SessionConfig, ChatMessage, RequestLogEntry, PersistentStatistics, DailyStatistics, EffectiveModel, ProviderModelOverrides, CustomModel } from './types';
import type { AppLogFilter } from '../appLogs/types';
/**
 * Storage Instance Type Definition
 */
type StoreType = any;
/**
 * Storage Manager Class
 * Responsible for data persistence and encryption
 */
declare class StoreManager {
    private store;
    private isInitialized;
    private mainWindow;
    private initializationError;
    private requestLogManager;
    private appLogManager;
    setMainWindow(window: BrowserWindow | null): void;
    /**
     * Check if storage has initialization error
     */
    hasInitializationError(): boolean;
    /**
     * Get initialization error
     */
    getInitializationError(): Error | null;
    /**
     * Initialize Storage
     * Create storage instance and initialize default data
     */
    initialize(): Promise<void>;
    /**
     * Recover from corrupted data file
     * Backup the corrupted file and create a new one
     */
    private recoverFromCorruptedData;
    /**
     * Get Storage Path
     * Storage path: ~/.chat2api/
     */
    private getStoragePath;
    /**
     * Get Encryption Key
     * Returns a fixed encryption key for electron-store
     * Note: electron-store uses this key to encrypt/decrypt the data file,
     * so it must be stable across app restarts
     */
    private getEncryptionKey;
    /**
     * Get Default Data Structure
     */
    private getEncryptionKeyPath;
    private readOrCreateEncryptionKey;
    /**
     * Get Default Data Structure
     */
    private getDefaultData;
    private initializeRequestLogManager;
    private initializeAppLogManager;
    private getMaxLogEntries;
    private normalizeConfig;
    private initializeDefaultModelMappings;
    /**
     * Initialize Default Providers
     * Clear provider list, users create providers by adding accounts
     */
    private initializeDefaultProviders;
    /**
     * Ensure provider exists, create if not
     */
    ensureProviderExists(providerId: string): void;
    /**
     * Ensure Storage is Initialized
     */
    private ensureInitialized;
    private getLogPriority;
    private shouldRecordLog;
    private getCombinedLogs;
    flushPendingWrites(): void;
    /**
     * Encrypt Sensitive Data
     * @param data Data to encrypt
     * @returns Encrypted string
     */
    encryptData(data: string): string;
    /**
     * Decrypt Sensitive Data
     * @param encryptedData Encrypted data
     * @returns Decrypted string
     */
    decryptData(encryptedData: string): string;
    /**
     * Encrypt Credentials Object
     * @param credentials Credentials object
     * @returns Encrypted credentials object
     */
    encryptCredentials(credentials: Record<string, string>): Record<string, string>;
    /**
     * Decrypt Credentials Object
     * @param encryptedCredentials Encrypted credentials object
     * @returns Decrypted credentials object
     */
    decryptCredentials(encryptedCredentials: Record<string, string>): Record<string, string>;
    /**
     * Get All Providers
     */
    getProviders(): Provider[];
    /**
     * Get Provider By ID
     */
    getProviderById(id: string): Provider | undefined;
    /**
     * Add Provider
     */
    addProvider(provider: Provider): void;
    /**
     * Update Provider
     */
    updateProvider(id: string, updates: Partial<Provider>): Provider | null;
    /**
     * Delete Provider
     */
    deleteProvider(id: string): boolean;
    /**
     * Get Model Overrides for a Provider
     * Returns user customizations to built-in provider models
     */
    getModelOverrides(providerId: string): ProviderModelOverrides | undefined;
    /**
     * Check if Provider has Model Overrides
     * Returns true if provider has user-added models or excluded models
     */
    hasModelOverrides(providerId: string): boolean;
    /**
     * Get All Accounts
     * @param includeCredentials Whether to include decrypted credentials
     */
    getAccounts(includeCredentials?: boolean): Account[];
    /**
     * Get Account By ID
     * @param includeCredentials Whether to include decrypted credentials
     */
    getAccountById(id: string, includeCredentials?: boolean): Account | undefined;
    /**
     * Get Accounts By Provider ID
     */
    getAccountsByProviderId(providerId: string, includeCredentials?: boolean): Account[];
    /**
     * Add Account
     * Credentials are automatically encrypted before storage
     */
    addAccount(account: Account): void;
    /**
     * Update Account
     */
    updateAccount(id: string, updates: Partial<Account>): Account | null;
    /**
     * Delete Account
     */
    deleteAccount(id: string): boolean;
    /**
     * Get Active Accounts
     */
    getActiveAccounts(includeCredentials?: boolean): Account[];
    /**
     * Get Application Configuration
     */
    getConfig(): AppConfig;
    /**
     * Set Application Configuration
     */
    setConfig(config: AppConfig): void;
    /**
     * Update Application Configuration
     */
    updateConfig(updates: Partial<AppConfig>): AppConfig;
    /**
     * Reset Configuration to Default Values
     */
    resetConfig(): AppConfig;
    /**
     * Add Log Entry
     */
    addLog(level: LogLevel, message: string, data?: {
        accountId?: string;
        providerId?: string;
        requestId?: string;
        data?: Record<string, unknown>;
        model?: string;
        actualModel?: string;
        latency?: number;
        isStream?: boolean;
        error?: string;
    }): LogEntry;
    /**
     * Get Logs
     * @param limit Limit count
     * @param level Log level filter
     */
    getLogs(filter?: AppLogFilter): LogEntry[];
    /**
     * Clear Logs
     */
    clearLogs(): void;
    replaceLogs(logs: LogEntry[]): void;
    /**
     * Get Log Statistics
     */
    getLogStats(): {
        total: number;
        info: number;
        warn: number;
        error: number;
        debug: number;
    };
    /**
     * Get Log Trend
     */
    getLogTrend(days?: number): {
        date: string;
        total: number;
        info: number;
        warn: number;
        error: number;
    }[];
    /**
     * Get Log Trend for specific account
     * Only counts successful API requests (logs with requestId) to match requestCount
     */
    getAccountLogTrend(accountId: string, days?: number): {
        date: string;
        total: number;
        info: number;
        warn: number;
        error: number;
    }[];
    /**
     * Export Logs
     */
    exportLogs(format?: 'json' | 'txt'): string;
    /**
     * Get Log By ID
     */
    getLogById(id: string): LogEntry | undefined;
    /**
     * Clear Expired Logs
     */
    cleanExpiredLogs(): void;
    /**
     * Add Request Log Entry
     */
    addRequestLog(entry: Omit<RequestLogEntry, 'id'>): RequestLogEntry;
    /**
     * Update Request Log Entry
     */
    updateRequestLog(id: string, updates: Partial<RequestLogEntry>): boolean;
    /**
     * Get Request Logs
     */
    getRequestLogs(limit?: number, filter?: {
        status?: 'success' | 'error';
        providerId?: string;
    }): RequestLogEntry[];
    /**
     * Get Request Log By ID
     */
    getRequestLogById(id: string): RequestLogEntry | undefined;
    /**
     * Clear Request Logs
     */
    clearRequestLogs(): void;
    /**
     * Get Request Log Statistics
     */
    getRequestLogStats(): {
        total: number;
        success: number;
        error: number;
        todayTotal: number;
        todaySuccess: number;
        todayError: number;
    };
    /**
     * Get Request Log Trend
     */
    getRequestLogTrend(days?: number): {
        date: string;
        total: number;
        success: number;
        error: number;
        avgLatency: number;
    }[];
    /**
     * Get Persistent Statistics
     */
    getStatistics(): PersistentStatistics;
    /**
     * Update Statistics
     */
    updateStatistics(updates: Partial<PersistentStatistics>): PersistentStatistics;
    /**
     * Record Request in Statistics
     */
    recordRequestInStats(success: boolean, latency: number, model?: string, providerId?: string, accountId?: string): PersistentStatistics;
    /**
     * Get Today Statistics
     */
    getTodayStatistics(): DailyStatistics;
    /**
     * Clean Old Daily Statistics (older than 30 days)
     */
    cleanOldDailyStats(): void;
    /**
     * Get All System Prompts
     * Merges built-in prompts with custom prompts
     */
    getSystemPrompts(): SystemPrompt[];
    /**
     * Get Built-in System Prompts
     */
    getBuiltinPrompts(): SystemPrompt[];
    /**
     * Get Custom System Prompts
     */
    getCustomPrompts(): SystemPrompt[];
    /**
     * Get System Prompt By ID
     */
    getSystemPromptById(id: string): SystemPrompt | undefined;
    /**
     * Add Custom System Prompt
     */
    addSystemPrompt(prompt: Omit<SystemPrompt, 'id' | 'createdAt' | 'updatedAt'>): SystemPrompt;
    /**
     * Update Custom System Prompt
     * Cannot update built-in prompts
     */
    updateSystemPrompt(id: string, updates: Partial<SystemPrompt>): SystemPrompt | null;
    /**
     * Delete Custom System Prompt
     * Cannot delete built-in prompts
     */
    deleteSystemPrompt(id: string): boolean;
    /**
     * Get System Prompts By Type
     */
    getSystemPromptsByType(type: SystemPrompt['type']): SystemPrompt[];
    /**
     * Get Session Configuration
     */
    getSessionConfig(): SessionConfig;
    /**
     * Update Session Configuration
     */
    updateSessionConfig(updates: Partial<SessionConfig>): SessionConfig;
    /**
     * Get All Sessions
     */
    getSessions(): SessionRecord[];
    /**
     * Get Session By ID
     */
    getSessionById(id: string): SessionRecord | undefined;
    /**
     * Get Active Sessions
     */
    getActiveSessions(): SessionRecord[];
    /**
     * Add Session
     */
    addSession(session: SessionRecord): void;
    /**
     * Update Session
     */
    updateSession(id: string, updates: Partial<SessionRecord>): SessionRecord | null;
    /**
     * Add Message to Session
     */
    addMessageToSession(sessionId: string, message: ChatMessage): SessionRecord | null;
    /**
     * Delete Session
     */
    deleteSession(id: string): boolean;
    /**
     * Mark Session as Expired
     */
    expireSession(id: string): SessionRecord | null;
    /**
     * Clean Expired Sessions
     * Always delete sessions with 'expired' status
     * For timed-out active sessions, behavior depends on deleteAfterTimeout config:
     * - If true: Delete them from storage
     * - If false: Mark them as 'expired' (will be deleted on next clean)
     */
    cleanExpiredSessions(): number;
    /**
     * Get Sessions By Account ID
     */
    getSessionsByAccountId(accountId: string): SessionRecord[];
    /**
     * Get Sessions By Provider ID
     */
    getSessionsByProviderId(providerId: string): SessionRecord[];
    /**
     * Clear All Sessions
     */
    clearAllSessions(): void;
    /**
     * Get User Model Overrides
     */
    private getUserModelOverrides;
    /**
     * Set User Model Overrides
     */
    private setUserModelOverrides;
    /**
     * Get Provider Model Overrides
     */
    private getProviderModelOverrides;
    /**
     * Get Effective Models for a Provider
     * Merges default models with user overrides
     */
    getEffectiveModels(providerId: string): EffectiveModel[];
    /**
     * Add Custom Model to Provider
     */
    addCustomModel(providerId: string, model: CustomModel): EffectiveModel[];
    /**
     * Remove Model from Provider
     * For default models: add to excludedModels
     * For custom models: remove from addedModels
     */
    removeModel(providerId: string, modelName: string): EffectiveModel[];
    /**
     * Reset Provider Models to Default
     * Removes all user overrides for the provider
     */
    resetModels(providerId: string): EffectiveModel[];
    /**
     * Generate Unique ID
     */
    generateId(): string;
    /**
     * Get Storage Instance (for internal use only)
     */
    getStore(): StoreType | null;
    /**
     * Clear All Data
     */
    clearAll(): void;
    /**
     * Export Data (for backup)
     * Does not include encrypted credential data
     */
    exportData(): Omit<StoreSchema, 'accounts'> & {
        accounts: Omit<Account, 'credentials'>[];
    };
    /**
     * Get Storage Path
     */
    getStorePath(): string;
    private getRequestLogManager;
    private getAppLogManager;
}
export declare const storeManager: StoreManager;
export type { StoreType };
