import type { Provider, Account, ProxyStatus, ProviderCheckResult, OAuthResult, AuthType, CredentialField, LogLevel, LogEntry, ProviderVendor, AppConfig, SystemPrompt, PromptType, EffectiveModel } from '../shared/types';
type ProviderType = ProviderVendor;
interface Profile {
    name: string;
    provider: 'openai' | 'anthropic' | 'custom';
    baseUrl: string;
    apiKey: string;
    model: string;
    active?: boolean;
    maxToolRounds?: number;
    maxRepeat?: number;
}
interface TokenValidationResult {
    valid: boolean;
    tokenType?: string;
    expiresAt?: number;
    accountInfo?: {
        userId?: string;
        email?: string;
        name?: string;
    };
    error?: string;
}
interface CredentialInfo {
    type: string;
    value: string;
    expiresAt?: number;
    refreshToken?: string;
}
interface OAuthProgressEvent {
    status: 'idle' | 'pending' | 'success' | 'error' | 'cancelled';
    message: string;
    progress?: number;
    data?: Record<string, unknown>;
}
interface LogFilter {
    level?: LogLevel | 'all';
    keyword?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
}
interface LogStats {
    total: number;
    info: number;
    warn: number;
    error: number;
    debug: number;
}
interface LogTrend {
    date: string;
    total: number;
    info: number;
    warn: number;
    error: number;
}
interface RequestLogEntry {
    id: string;
    timestamp: number;
    status: 'success' | 'error';
    statusCode: number;
    method: string;
    url: string;
    model: string;
    actualModel?: string;
    providerId?: string;
    providerName?: string;
    accountId?: string;
    accountName?: string;
    requestBody?: string;
    userInput?: string;
    webSearch?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
    responseStatus: number;
    responsePreview?: string;
    responseBody?: string;
    latency: number;
    isStream: boolean;
    errorMessage?: string;
    errorStack?: string;
}
interface RequestLogFilter {
    status?: 'success' | 'error';
    providerId?: string;
    limit?: number;
}
interface RequestLogStats {
    total: number;
    success: number;
    error: number;
    todayTotal: number;
    todaySuccess: number;
    todayError: number;
}
interface RequestLogTrend {
    date: string;
    total: number;
    success: number;
    error: number;
    avgLatency: number;
}
interface PersistentStatistics {
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    totalLatency: number;
    lastUpdated: number;
    modelUsage: Record<string, number>;
    providerUsage: Record<string, number>;
    accountUsage: Record<string, number>;
    dailyStats: Record<string, DailyStatistics>;
}
interface DailyStatistics {
    date: string;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    totalLatency: number;
    modelUsage: Record<string, number>;
    providerUsage: Record<string, number>;
}
interface UpdateProgressInfo {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}
interface UpdateStatus {
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    error: string | null;
    progress: UpdateProgressInfo | null;
    version: string | null;
    releaseDate: string | null;
    releaseNotes: string | null;
}
interface SessionConfig {
    mode: 'single';
    sessionTimeout: number;
    maxMessagesPerSession: number;
    deleteAfterTimeout: boolean;
    maxSessionsPerAccount: number;
}
interface SessionRecord {
    id: string;
    providerId: string;
    accountId: string;
    providerSessionId: string;
    parentMessageId?: string;
    sessionType: 'chat' | 'agent';
    messages: any[];
    createdAt: number;
    lastActiveAt: number;
    status: 'active' | 'expired' | 'deleted';
    model?: string;
}
interface ManagementApiConfig {
    enableManagementApi: boolean;
    managementApiSecret: string;
    managementApiPort?: number;
}
interface ContextManagementConfig {
    enabled: boolean;
    strategies: {
        slidingWindow: {
            enabled: boolean;
            maxMessages: number;
        };
        tokenLimit: {
            enabled: boolean;
            maxTokens: number;
        };
        summary: {
            enabled: boolean;
            keepRecentMessages: number;
            summaryPrompt?: string;
        };
    };
    executionOrder: ('slidingWindow' | 'tokenLimit' | 'summary')[];
}
declare const electronAPI: {
    proxy: {
        start: (port?: number) => Promise<boolean>;
        stop: () => Promise<boolean>;
        getStatus: () => Promise<ProxyStatus>;
        onStatusChanged: (callback: (status: ProxyStatus) => void) => () => Electron.IpcRenderer;
    };
    store: {
        get: <T>(key: string) => Promise<T | undefined>;
        set: <T>(key: string, value: T) => Promise<void>;
        delete: (key: string) => Promise<void>;
        clearAll: () => Promise<void>;
        onInitError: (callback: (error: {
            message: string | null;
        }) => void) => () => Electron.IpcRenderer;
        retryInit: () => Promise<{
            success: boolean;
            error?: string;
        }>;
    };
    providers: {
        getAll: () => Promise<Provider[]>;
        getBuiltin: () => Promise<any[]>;
        add: (data: {
            name: string;
            authType: AuthType;
            apiEndpoint: string;
            headers?: Record<string, string>;
            description?: string;
            supportedModels?: string[];
            credentialFields?: CredentialField[];
        }) => Promise<Provider>;
        update: (id: string, updates: Partial<Provider>) => Promise<Provider | null>;
        delete: (id: string) => Promise<boolean>;
        checkStatus: (providerId: string) => Promise<ProviderCheckResult>;
        checkAllStatus: () => Promise<Record<string, ProviderCheckResult>>;
        duplicate: (id: string) => Promise<Provider>;
        export: (id: string) => Promise<string>;
        import: (jsonData: string) => Promise<Provider>;
        updateModels: (providerId: string) => Promise<{
            success: boolean;
            modelsCount?: number;
            error?: string;
        }>;
        getEffectiveModels: (providerId: string) => Promise<EffectiveModel[]>;
        addCustomModel: (providerId: string, model: {
            displayName: string;
            actualModelId: string;
        }) => Promise<{
            success: boolean;
            models: EffectiveModel[];
            error?: string;
        }>;
        removeModel: (providerId: string, modelName: string) => Promise<{
            success: boolean;
            models: EffectiveModel[];
            error?: string;
        }>;
        resetModels: (providerId: string) => Promise<{
            success: boolean;
            models: EffectiveModel[];
            error?: string;
        }>;
    };
    accounts: {
        getAll: (includeCredentials?: boolean) => Promise<Account[]>;
        getById: (id: string, includeCredentials?: boolean) => Promise<Account | null>;
        getByProvider: (providerId: string) => Promise<Account[]>;
        add: (data: {
            providerId: string;
            name: string;
            email?: string;
            credentials: Record<string, string>;
            dailyLimit?: number;
        }) => Promise<Account>;
        update: (id: string, updates: Partial<Account>) => Promise<Account | null>;
        delete: (id: string) => Promise<boolean>;
        validate: (accountId: string) => Promise<boolean>;
        validateToken: (providerId: string, credentials: Record<string, string>) => Promise<{
            valid: boolean;
            error?: string;
            userInfo?: {
                name?: string;
                email?: string;
                quota?: number;
                used?: number;
            };
        }>;
        getCredits: (accountId: string) => Promise<{
            totalCredits: number;
            usedCredits: number;
            remainingCredits: number;
        } | null>;
        clearChats: (accountId: string) => Promise<{
            success: boolean;
            error?: string;
        }>;
    };
    oauth: {
        startLogin: (providerId: string, providerType: ProviderType) => Promise<OAuthResult>;
        cancelLogin: () => Promise<void>;
        loginWithToken: (providerId: string, providerType: ProviderType, token: string) => Promise<OAuthResult>;
        validateToken: (providerId: string, providerType: ProviderType, credentials: Record<string, string>) => Promise<TokenValidationResult>;
        refreshToken: (providerId: string, providerType: ProviderType, credentials: Record<string, string>) => Promise<CredentialInfo | null>;
        getStatus: () => Promise<string>;
        startInAppLogin: (providerId: string, providerType: ProviderType, timeout?: number) => Promise<OAuthResult>;
        cancelInAppLogin: () => Promise<void>;
        isInAppLoginOpen: () => Promise<boolean>;
        onCallback: (callback: (result: OAuthResult) => void) => () => Electron.IpcRenderer;
        onProgress: (callback: (event: OAuthProgressEvent) => void) => () => Electron.IpcRenderer;
    };
    logs: {
        get: (filter?: LogFilter) => Promise<LogEntry[]>;
        getStats: () => Promise<LogStats>;
        getTrend: (days?: number) => Promise<LogTrend[]>;
        getAccountTrend: (accountId: string, days?: number) => Promise<LogTrend[]>;
        clear: () => Promise<void>;
        export: (format?: "json" | "txt") => Promise<string>;
        getById: (id: string) => Promise<LogEntry | undefined>;
        onNewLog: (callback: (log: LogEntry) => void) => () => Electron.IpcRenderer;
        getCategoryConfig: () => Promise<{ success: boolean; config: Record<string, { level: string; enabled: boolean }> }>;
        updateCategoryConfig: (config: Record<string, { level: string; enabled: boolean }>) => Promise<{ success: boolean }>;
    };
    requestLogs: {
        get: (filter?: RequestLogFilter) => Promise<RequestLogEntry[]>;
        getById: (id: string) => Promise<RequestLogEntry | undefined>;
        getStats: () => Promise<RequestLogStats>;
        getTrend: (days?: number) => Promise<RequestLogTrend[]>;
        clear: () => Promise<void>;
        onNewLog: (callback: (log: RequestLogEntry) => void) => () => Electron.IpcRenderer;
    };
    statistics: {
        get: () => Promise<PersistentStatistics>;
        getToday: () => Promise<DailyStatistics>;
    };
    app: {
        getVersion: () => Promise<string>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        showWindow: () => Promise<void>;
        hideWindow: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        checkUpdate: () => Promise<UpdateStatus>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
        getUpdateStatus: () => Promise<UpdateStatus>;
        onUpdateChecking: (callback: () => void) => () => Electron.IpcRenderer;
        onUpdateAvailable: (callback: (info: any) => void) => () => Electron.IpcRenderer;
        onUpdateNotAvailable: (callback: (info: any) => void) => () => Electron.IpcRenderer;
        onUpdateProgress: (callback: (progress: UpdateProgressInfo) => void) => () => Electron.IpcRenderer;
        onUpdateDownloaded: (callback: (info: any) => void) => () => Electron.IpcRenderer;
        onUpdateError: (callback: (error: {
            message?: string;
        } | string) => void) => () => Electron.IpcRenderer;
    };
    config: {
        get: () => Promise<AppConfig>;
        update: (updates: Partial<AppConfig>) => Promise<boolean>;
        onConfigChanged: (callback: (config: AppConfig) => void) => () => Electron.IpcRenderer;
    };
    prompts: {
        getAll: () => Promise<SystemPrompt[]>;
        getBuiltin: () => Promise<SystemPrompt[]>;
        getCustom: () => Promise<SystemPrompt[]>;
        getById: (id: string) => Promise<SystemPrompt | undefined>;
        add: (prompt: Omit<SystemPrompt, "id" | "createdAt" | "updatedAt">) => Promise<SystemPrompt>;
        update: (id: string, updates: Partial<SystemPrompt>) => Promise<SystemPrompt | null>;
        delete: (id: string) => Promise<boolean>;
        getByType: (type: PromptType) => Promise<SystemPrompt[]>;
    };
    session: {
        getConfig: () => Promise<SessionConfig>;
        updateConfig: (config: Partial<SessionConfig>) => Promise<void>;
        getAll: () => Promise<SessionRecord[]>;
        getActive: () => Promise<SessionRecord[]>;
        getById: (id: string) => Promise<SessionRecord | undefined>;
        getByAccount: (accountId: string) => Promise<SessionRecord[]>;
        getByProvider: (providerId: string) => Promise<SessionRecord[]>;
        delete: (id: string) => Promise<boolean>;
        clearAll: () => Promise<void>;
        cleanExpired: () => Promise<number>;
    };
    managementApi: {
        getConfig: () => Promise<ManagementApiConfig>;
        updateConfig: (updates: Partial<ManagementApiConfig>) => Promise<ManagementApiConfig>;
        generateSecret: () => Promise<string>;
    };
    contextManagement: {
        getConfig: () => Promise<ContextManagementConfig>;
        updateConfig: (updates: Partial<ContextManagementConfig>) => Promise<ContextManagementConfig>;
    };
    toolCalling: {
        getStatus(): Promise<any>;
        runSmoke(input: {
            clientAdapterId: string;
        }): Promise<any>;
    };
    tray: {
        openDashboard: () => void;
        setHeight: (height: number) => void;
        quitApp: () => void;
    };
    chat: {
        sendMessage: (text: string) => Promise<{
            success: boolean;
            requestId?: string;
            error?: string;
        }>;
        onStreamChunk: (callback: (data: {
            requestId: string;
            chunk: string;
        }) => void) => (() => void);
        onStreamDone: (callback: (data: {
            requestId: string;
            content: string;
            toolOutput?: string;
        }) => void) => (() => void);
        onStreamError: (callback: (data: {
            requestId: string;
            error: string;
        }) => void) => (() => void);
        getHistory: () => Promise<{
            messages: Array<{
                role: string;
                content: string;
            }>;
        }>;
        clearHistory: () => Promise<boolean>;
        getConfig: () => Promise<Record<string, unknown>>;
        setConfig: (updates: Record<string, unknown>) => Promise<{
            success: boolean;
        }>;
        executeCommand: (name: string, args: string[]) => Promise<{
            success: boolean;
            output?: string;
            error?: string;
        }>;
    };
    profiles: {
        getAll: () => Promise<{
            success: boolean;
            profiles?: Profile[];
            activeProfile?: string | null;
        }>;
        getActive: () => Promise<{
            success: boolean;
            profile?: Profile | null;
        }>;
        setActive: (name: string) => Promise<{
            success: boolean;
            profile?: Profile;
            error?: string;
        }>;
        upsert: (profile: Profile) => Promise<{
            success: boolean;
        }>;
        remove: (name: string) => Promise<{
            success: boolean;
            error?: string;
        }>;
    };
    dogeConfig: {
        listFiles: () => Promise<{
            success: boolean;
            files?: Array<{
                name: string;
                path: string;
                size: number;
                modified: number;
            }>;
        }>;
        readFile: (name: string) => Promise<{
            success: boolean;
            content?: string;
            error?: string;
        }>;
        deleteFile: (name: string) => Promise<{
            success: boolean;
            error?: string;
        }>;
    };
    mgmt: {
        export: (moduleName: string, data: any) => Promise<{ success: boolean; path?: string; error?: string }>;
        import: (moduleName: string, jsonData: string) => Promise<{ success: boolean; data?: any; count?: number; error?: string }>;
        backup: () => Promise<{ success: boolean; path?: string; modules?: string[]; error?: string }>;
        restore: (filePath: string) => Promise<{ success: boolean; restored?: Record<string, number>; error?: string }>;
        getAllBackups: () => Promise<{ success: boolean; data?: Array<{ name: string; path: string }>; error?: string }>;
        deleteBackup: (fileName: string) => Promise<{ success: boolean; error?: string }>;
    };
    team: {
        execute: (description: string, customRoles?: Array<{
            id: string;
            name: string;
            systemPrompt: string;
        }>) => Promise<{
            success: boolean;
            report?: unknown;
            error?: string;
        }>;
        getResult: (planId: string) => Promise<{
            success: boolean;
            data?: unknown;
            error?: string;
        }>;
        onPhaseChange: (callback: (event: {
            phase: string;
            detail: string;
        }) => void) => (() => void);
        onDiscussion: (callback: (event: {
            id: string;
            phase: string;
            roleId: string;
            roleName: string;
            content: string;
        }) => void) => (() => void);
        onTaskEvent: (callback: (event: {
            type: "start" | "complete";
            taskId: string;
            description: string;
            success?: boolean;
            durationMs?: number;
            output?: string;
            error?: string;
        }) => void) => (() => void);
        onDone: (callback: (event: {
            success: boolean;
            totalDurationMs: number;
            discussionRounds: number;
            taskResults: unknown[];
            planId: string;
        }) => void) => (() => void);
        onError: (callback: (event: {
            error: string;
        }) => void) => (() => void);
    };
    plans: {
        getAll: () => Promise<{
            success: boolean;
            plans?: Array<{
                id: string;
                title: string;
                description: string;
                status: 'pending' | 'running' | 'completed' | 'failed';
                steps: Array<{ id: string; description: string; status: string }>;
                createdAt: number;
            }>;
        }>;
        getById: (id: string) => Promise<{ success: boolean; plan?: {
            id: string;
            title: string;
            description: string;
            status: 'pending' | 'running' | 'completed' | 'failed';
            steps: Array<{ id: string; description: string; status: string }>;
            createdAt: number;
        } }>;
        create: (data: { title: string; description: string; steps: Array<{ id: string; description: string; status: string }>; status: string }) => Promise<{ success: boolean; plan?: any }>;
        update: (id: string, data: any) => Promise<{ success: boolean; plan?: any }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        execute: (id: string) => Promise<{ success: boolean }>;
    };
    tasks: {
        getAll: () => Promise<{ success: boolean; tasks?: any[] }>;
        getById: (id: string) => Promise<{ success: boolean; task?: any }>;
        create: (data: any) => Promise<{ success: boolean; task?: any }>;
        update: (id: string, data: any) => Promise<{ success: boolean; task?: any }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        setStatus: (id: string, status: string) => Promise<{ success: boolean; task?: any }>;
    };
    git: {
        getStatus: (repoPath: string) => Promise<{ success: boolean; status?: {
            currentBranch: string;
            ahead: number;
            behind: number;
            staged: string[];
            unstaged: string[];
            untracked: string[];
            isClean: boolean;
        } }>;
        clone: (url: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
        pull: (repoPath: string) => Promise<{ success: boolean }>;
        push: (repoPath: string) => Promise<{ success: boolean }>;
        getLog: (repoPath: string, limit?: number) => Promise<{ success: boolean; commits?: any[] }>;
        getBranches: (repoPath: string) => Promise<{ success: boolean; branches?: Array<{ name: string; current: boolean; ahead: number; behind: number }> }>;
        checkout: (repoPath: string, branch: string) => Promise<{ success: boolean }>;
    };
    agents: {
        getAll: () => Promise<{ success: boolean; agents?: any[] }>;
        getById: (id: string) => Promise<{ success: boolean; agent?: any }>;
        create: (data: any) => Promise<{ success: boolean; agent?: any }>;
        update: (id: string, data: any) => Promise<{ success: boolean; agent?: any }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        execute: (id: string, input: string) => Promise<{ success: boolean }>;
    };
    commands: {
        getAll: () => Promise<{ success: boolean; commands?: any[] }>;
        getBuiltin: () => Promise<{ success: boolean; commands?: any[] }>;
        getCustom: () => Promise<{ success: boolean; commands?: any[] }>;
        add: (data: any) => Promise<{ success: boolean; command?: any }>;
        update: (id: string, data: any) => Promise<{ success: boolean; command?: any }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        execute: (name: string, args?: string[]) => Promise<{ success: boolean; result?: any }>;
    };
    workflows: {
        getAll: () => Promise<{ success: boolean; workflows?: any[] }>;
        getById: (id: string) => Promise<{ success: boolean; workflow?: any }>;
        create: (data: any) => Promise<{ success: boolean; workflow?: any }>;
        update: (id: string, data: any) => Promise<{ success: boolean; workflow?: any }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        execute: (id: string, input?: Record<string, unknown>) => Promise<{ success: boolean; result?: any }>;
    };
    mcp: {
        getConfig: () => Promise<{ success: boolean; config?: any }>;
        updateConfig: (config: any) => Promise<{ success: boolean }>;
        getServers: () => Promise<{ success: boolean; servers?: any[] }>;
        getServerById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        addServer: (config: any) => Promise<{ success: boolean; server?: any }>;
        removeServer: (id: string) => Promise<{ success: boolean }>;
        testConnection: (serverConfig: any) => Promise<{ success: boolean; connected?: boolean; tools?: any[] }>;
        getTools: (serverId?: string) => Promise<{ success: boolean; tools?: any[] }>;
    };
    plugins: {
        getAll: () => Promise<{ success: boolean; plugins?: any[] }>;
        getBuiltin: () => Promise<{ success: boolean; plugins?: any[] }>;
        getInstalled: () => Promise<{ success: boolean; plugins?: any[] }>;
        getById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        install: (id: string) => Promise<{ success: boolean }>;
        uninstall: (id: string) => Promise<{ success: boolean }>;
        enable: (id: string) => Promise<{ success: boolean }>;
        disable: (id: string) => Promise<{ success: boolean }>;
        update: (id: string) => Promise<{ success: boolean }>;
    };
    tools: {
        getAll: () => Promise<{ success: boolean; data?: { tools: any[]; groups: any[]; hintRules: any[] }; error?: string }>;
        getGroups: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getHintRules: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getById: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        add: (tool: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        update: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        remove: (id: string) => Promise<{ success: boolean; error?: string }>;
        toggle: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        addGroup: (group: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        updateGroup: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        removeGroup: (id: string) => Promise<{ success: boolean; error?: string }>;
        addToGroup: (toolId: string, groupId: string) => Promise<{ success: boolean }>;
        removeFromGroup: (toolId: string, groupId: string) => Promise<{ success: boolean }>;
        addHintRule: (rule: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        updateHintRule: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        removeHintRule: (id: string) => Promise<{ success: boolean; error?: string }>;
        matchHints: (input: string) => Promise<{ success: boolean; data?: { groups: any[]; tools: any[] }; error?: string }>;
        reset: () => Promise<{ success: boolean }>;
        resetBuiltin: (kind: 'tool' | 'group' | 'hintRule', id: string) => Promise<{ success: boolean; error?: string }>;
        ensureFile: (id: string) => Promise<{ success: boolean; data?: { path: string }; error?: string }>;
        revealFile: (id: string) => Promise<{ success: boolean; data?: { path: string }; error?: string }>;
    };
    otherConfig: {
        get: () => Promise<{ success: boolean; config?: any }>;
        update: (data: any) => Promise<{ success: boolean; config?: any }>;
        getAdvanced: () => Promise<{ success: boolean; config?: any }>;
        updateAdvanced: (data: Record<string, unknown>) => Promise<{ success: boolean }>;
        reset: () => Promise<{ success: boolean }>;
    };
    on: (channel: string, callback: (...args: unknown[]) => void) => () => Electron.IpcRenderer;
    send: (channel: string, ...args: unknown[]) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<any>;
};
export type ElectronAPI = typeof electronAPI;
export {};
