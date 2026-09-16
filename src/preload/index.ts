import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../main/ipc/channels'
import type {
  Provider,
  Account,
  ProxyStatus,
  ProviderCheckResult,
  OAuthResult,
  AuthType,
  CredentialField,
  LogLevel,
  LogEntry,
  ProviderVendor,
  AppConfig,
  SystemPrompt,
  PromptType,
  EffectiveModel,
} from '../shared/types'

import type { AgentRecord } from '../main/agents/types'

// ==================== New Module Types ====================

interface PlanRecord {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps: Array<{ id: string; description: string; status: string; result?: string | null }>
  createdAt: number
  completedAt?: number
  updatedAt?: number
}

interface TaskRecord {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assignee?: string
  tags: string[]
  createdAt: number
  dueAt?: number
  completedAt?: number
}

interface GitStatus {
  currentBranch: string
  ahead: number
  behind: number
  staged: string[]
  unstaged: string[]
  untracked: string[]
  isClean: boolean
}

interface GitBranch {
  name: string
  current: boolean
  ahead: number
  behind: number
}

interface CommandRecord {
  id: string
  name: string
  description: string
  command: string
  args?: string[]
  type: 'builtin' | 'custom'
  enabled: boolean
}

interface CommandExecuteResult {
  success: boolean
  output?: string
  error?: string
  durationMs?: number
}

interface WorkflowRecord {
  id: string
  name: string
  description: string
  steps: Array<{ id: string; name: string; type: string; config: Record<string, unknown> }>
  enabled: boolean
  createdAt: number
  lastRunAt?: number
}

interface WorkflowExecuteResult {
  success: boolean
  stepResults: Array<{ stepId: string; success: boolean; output?: string; error?: string }>
  totalDurationMs: number
}

interface McpServerConfig {
  id: string
  name: string
  url: string
  transport: 'stdio' | 'sse' | 'http'
  enabled: boolean
  tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
}

interface PluginRecord {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  installed: boolean
  icon?: string
}

interface OtherConfig {
  advanced: Record<string, unknown>
  experimental: Record<string, unknown>
  developer: Record<string, unknown>
}

const proxyAPI = {
  start: (port?: number): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.PROXY_START, port),

  stop: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.PROXY_STOP),

  getStatus: (): Promise<ProxyStatus> =>
    ipcRenderer.invoke(IpcChannels.PROXY_GET_STATUS),

  onStatusChanged: (callback: (status: ProxyStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ProxyStatus) => callback(status)
    ipcRenderer.on(IpcChannels.PROXY_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.PROXY_STATUS_CHANGED, handler)
  },
}

const storeAPI = {
  get: <T>(key: string): Promise<T | undefined> =>
    ipcRenderer.invoke(IpcChannels.STORE_GET, key),

  set: <T>(key: string, value: T): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.STORE_SET, key, value),

  delete: (key: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.STORE_DELETE, key),

  clearAll: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.STORE_CLEAR_ALL),

  onInitError: (callback: (error: { message: string | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: { message: string | null }) => callback(error)
    ipcRenderer.on(IpcChannels.STORE_INIT_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.STORE_INIT_ERROR, handler)
  },

  retryInit: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.STORE_RETRY_INIT),
}

const providersAPI = {
  getAll: (): Promise<Provider[]> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_ALL),

  getBuiltin: (): Promise<any[]> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_BUILTIN),

  add: (data: {
    name: string
    authType: AuthType
    apiEndpoint: string
    headers?: Record<string, string>
    description?: string
    supportedModels?: string[]
    credentialFields?: CredentialField[]
  }): Promise<Provider> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_ADD, data),

  update: (id: string, updates: Partial<Provider>): Promise<Provider | null> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_UPDATE, id, updates),

  delete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_DELETE, id),

  checkStatus: (providerId: string): Promise<ProviderCheckResult> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_CHECK_STATUS, providerId),

  checkAllStatus: (): Promise<Record<string, ProviderCheckResult>> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_CHECK_ALL_STATUS),

  duplicate: (id: string): Promise<Provider> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_DUPLICATE, id),

  export: (id: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_EXPORT, id),

  import: (jsonData: string): Promise<Provider> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_IMPORT, jsonData),

  updateModels: (providerId: string): Promise<{
    success: boolean
    modelsCount?: number
    error?: string
  }> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_UPDATE_MODELS, providerId),

  getEffectiveModels: (providerId: string): Promise<EffectiveModel[]> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_EFFECTIVE_MODELS, providerId),

  addCustomModel: (providerId: string, model: { displayName: string; actualModelId: string }): Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_ADD_CUSTOM_MODEL, providerId, model),

  removeModel: (providerId: string, modelName: string): Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_REMOVE_MODEL, providerId, modelName),

  resetModels: (providerId: string): Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }> =>
    ipcRenderer.invoke(IpcChannels.PROVIDERS_RESET_MODELS, providerId),
}

const accountsAPI = {
  getAll: (includeCredentials?: boolean): Promise<Account[]> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_ALL, includeCredentials),

  getById: (id: string, includeCredentials?: boolean): Promise<Account | null> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_BY_ID, id, includeCredentials),

  getByProvider: (providerId: string): Promise<Account[]> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_BY_PROVIDER, providerId),

  add: (data: {
    providerId: string
    name: string
    email?: string
    credentials: Record<string, string>
    dailyLimit?: number
  }): Promise<Account> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_ADD, data),

  update: (id: string, updates: Partial<Account>): Promise<Account | null> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_UPDATE, id, updates),

  delete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_DELETE, id),

  validate: (accountId: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_VALIDATE, accountId),

  validateToken: (providerId: string, credentials: Record<string, string>): Promise<{
    valid: boolean
    error?: string
    userInfo?: {
      name?: string
      email?: string
      quota?: number
      used?: number
    }
  }> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_VALIDATE_TOKEN, providerId, credentials),

  getCredits: (accountId: string): Promise<{
    totalCredits: number
    usedCredits: number
    remainingCredits: number
  } | null> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_CREDITS, accountId),

  clearChats: (accountId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_CLEAR_CHATS, accountId),

  resetStatus: (accountId: string, status?: 'active' | 'inactive' | 'expired' | 'error'): Promise<Account | null> =>
    ipcRenderer.invoke(IpcChannels.ACCOUNTS_RESET_STATUS, accountId, status),
}

type ProviderType = ProviderVendor

interface Profile {
  name: string
  provider: 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  active?: boolean
  maxToolRounds?: number
  maxRepeat?: number
}

interface TokenValidationResult {
  valid: boolean
  tokenType?: string
  expiresAt?: number
  accountInfo?: {
    userId?: string
    email?: string
    name?: string
  }
  error?: string
}

interface CredentialInfo {
  type: string
  value: string
  expiresAt?: number
  refreshToken?: string
}

interface OAuthProgressEvent {
  status: 'idle' | 'pending' | 'success' | 'error' | 'cancelled'
  message: string
  progress?: number
  data?: Record<string, unknown>
}

const oauthAPI = {
  startLogin: (providerId: string, providerType: ProviderType): Promise<OAuthResult> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_START_LOGIN, providerId, providerType),

  cancelLogin: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_CANCEL_LOGIN),

  loginWithToken: (providerId: string, providerType: ProviderType, token: string): Promise<OAuthResult> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_LOGIN_WITH_TOKEN, { providerId, providerType, token }),

  validateToken: (providerId: string, providerType: ProviderType, credentials: Record<string, string>): Promise<TokenValidationResult> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_VALIDATE_TOKEN, { providerId, providerType, credentials }),

  refreshToken: (providerId: string, providerType: ProviderType, credentials: Record<string, string>): Promise<CredentialInfo | null> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_REFRESH_TOKEN, { providerId, providerType, credentials }),

  getStatus: (): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_GET_STATUS),

  startInAppLogin: (providerId: string, providerType: ProviderType, timeout?: number): Promise<OAuthResult> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_START_IN_APP_LOGIN, { providerId, providerType, timeout }),

  cancelInAppLogin: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_CANCEL_IN_APP_LOGIN),

  isInAppLoginOpen: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.OAUTH_IN_APP_LOGIN_STATUS),

  onCallback: (callback: (result: OAuthResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: OAuthResult) => callback(result)
    ipcRenderer.on(IpcChannels.OAUTH_CALLBACK, handler)
    return () => ipcRenderer.removeListener(IpcChannels.OAUTH_CALLBACK, handler)
  },

  onProgress: (callback: (event: OAuthProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: OAuthProgressEvent) => callback(event)
    ipcRenderer.on(IpcChannels.OAUTH_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.OAUTH_PROGRESS, handler)
  },
}

interface LogFilter {
  level?: LogLevel | 'all'
  keyword?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

interface LogStats {
  total: number
  info: number
  warn: number
  error: number
  debug: number
}

interface LogTrend {
  date: string
  total: number
  info: number
  warn: number
  error: number
}

const logsAPI = {
  get: (filter?: LogFilter): Promise<LogEntry[]> =>
    ipcRenderer.invoke(IpcChannels.LOGS_GET, filter),

  getStats: (): Promise<LogStats> =>
    ipcRenderer.invoke(IpcChannels.LOGS_GET_STATS),

  getTrend: (days?: number): Promise<LogTrend[]> =>
    ipcRenderer.invoke(IpcChannels.LOGS_GET_TREND, days),

  getAccountTrend: (accountId: string, days?: number): Promise<LogTrend[]> =>
    ipcRenderer.invoke(IpcChannels.LOGS_GET_ACCOUNT_TREND, accountId, days),

  clear: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LOGS_CLEAR),

  export: (format?: 'json' | 'txt'): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.LOGS_EXPORT, format),

  getById: (id: string): Promise<LogEntry | null> =>
    ipcRenderer.invoke(IpcChannels.LOGS_GET_BY_ID, id),

  onNewLog: (callback: (log: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: LogEntry) => callback(log)
    ipcRenderer.on(IpcChannels.LOGS_NEW_LOG, handler)
    return () => ipcRenderer.removeListener(IpcChannels.LOGS_NEW_LOG, handler)
  },
}

interface RequestLogEntry {
  id: string
  timestamp: number
  status: 'success' | 'error'
  statusCode: number
  method: string
  url: string
  model: string
  actualModel?: string
  providerId?: string
  providerName?: string
  accountId?: string
  accountName?: string
  requestBody?: string
  userInput?: string
  webSearch?: boolean
  reasoningEffort?: 'low' | 'medium' | 'high'
  responseStatus: number
  responsePreview?: string
  responseBody?: string
  latency: number
  isStream: boolean
  errorMessage?: string
  errorStack?: string
}

interface RequestLogFilter {
  status?: 'success' | 'error'
  providerId?: string
  limit?: number
}

interface RequestLogStats {
  total: number
  success: number
  error: number
  todayTotal: number
  todaySuccess: number
  todayError: number
}

interface RequestLogTrend {
  date: string
  total: number
  success: number
  error: number
  avgLatency: number
}

const requestLogsAPI = {
  get: (filter?: RequestLogFilter): Promise<RequestLogEntry[]> =>
    ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET, filter),

  getById: (id: string): Promise<RequestLogEntry | null> =>
    ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_BY_ID, id),

  getStats: (): Promise<RequestLogStats> =>
    ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_STATS),

  getTrend: (days?: number): Promise<RequestLogTrend[]> =>
    ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_TREND, days),

  clear: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_CLEAR),

  onNewLog: (callback: (log: RequestLogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: RequestLogEntry) => callback(log)
    ipcRenderer.on(IpcChannels.REQUEST_LOGS_NEW, handler)
    return () => ipcRenderer.removeListener(IpcChannels.REQUEST_LOGS_NEW, handler)
  },
}

interface PersistentStatistics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalLatency: number
  lastUpdated: number
  modelUsage: Record<string, number>
  providerUsage: Record<string, number>
  accountUsage: Record<string, number>
  dailyStats: Record<string, DailyStatistics>
}

interface DailyStatistics {
  date: string
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalLatency: number
  modelUsage: Record<string, number>
  providerUsage: Record<string, number>
}

const statisticsAPI = {
  get: (): Promise<PersistentStatistics> =>
    ipcRenderer.invoke(IpcChannels.STATISTICS_GET),

  getToday: (): Promise<DailyStatistics> =>
    ipcRenderer.invoke(IpcChannels.STATISTICS_GET_TODAY),
}

interface UpdateProgressInfo {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  downloaded: boolean
  error: string | null
  progress: UpdateProgressInfo | null
  version: string | null
  releaseDate: string | null
  releaseNotes: string | null
}

const appAPI = {
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.APP_GET_VERSION),

  minimize: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_MINIMIZE),

  maximize: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_MAXIMIZE),

  close: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_CLOSE),

  showWindow: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_SHOW_WINDOW),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_HIDE_WINDOW),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_OPEN_EXTERNAL, url),

  checkUpdate: (): Promise<UpdateStatus> =>
    ipcRenderer.invoke(IpcChannels.APP_CHECK_UPDATE),

  downloadUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_DOWNLOAD_UPDATE),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.APP_INSTALL_UPDATE),

  getUpdateStatus: (): Promise<UpdateStatus> =>
    ipcRenderer.invoke(IpcChannels.APP_GET_UPDATE_STATUS),

  onUpdateChecking: (callback: () => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on(IpcChannels.APP_UPDATE_CHECKING, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_CHECKING, listener)
  },

  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on(IpcChannels.APP_UPDATE_AVAILABLE, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_AVAILABLE, listener)
  },

  onUpdateNotAvailable: (callback: (info: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on(IpcChannels.APP_UPDATE_NOT_AVAILABLE, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_NOT_AVAILABLE, listener)
  },

  onUpdateProgress: (callback: (progress: UpdateProgressInfo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: UpdateProgressInfo) => callback(progress)
    ipcRenderer.on(IpcChannels.APP_UPDATE_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_PROGRESS, listener)
  },

  onUpdateDownloaded: (callback: (info: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: any) => callback(info)
    ipcRenderer.on(IpcChannels.APP_UPDATE_DOWNLOADED, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_DOWNLOADED, listener)
  },

  onUpdateError: (callback: (error: { message?: string } | string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: { message?: string } | string) => callback(error)
    ipcRenderer.on(IpcChannels.APP_UPDATE_ERROR, listener)
    return () => ipcRenderer.removeListener(IpcChannels.APP_UPDATE_ERROR, listener)
  },
}

const configAPI = {
  get: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_GET),

  update: (updates: Partial<AppConfig>): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_UPDATE, updates),

  onConfigChanged: (callback: (config: AppConfig) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: AppConfig) => callback(config)
    ipcRenderer.on(IpcChannels.CONFIG_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.CONFIG_CHANGED, handler)
  },
}

const promptsAPI = {
  getAll: (): Promise<SystemPrompt[]> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_GET_ALL),

  getBuiltin: (): Promise<SystemPrompt[]> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BUILTIN),

  getCustom: (): Promise<SystemPrompt[]> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_GET_CUSTOM),

  getById: (id: string): Promise<SystemPrompt | null> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BY_ID, id),

  add: (prompt: Omit<SystemPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<SystemPrompt> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_ADD, prompt),

  update: (id: string, updates: Partial<SystemPrompt>): Promise<SystemPrompt | null> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_UPDATE, id, updates),

  delete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_DELETE, id),

  getByType: (type: PromptType): Promise<SystemPrompt[]> =>
    ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BY_TYPE, type),
}

interface SessionConfig {
  mode: 'single'
  sessionTimeout: number
  maxMessagesPerSession: number
  deleteAfterTimeout: boolean
  maxSessionsPerAccount: number
}

interface SessionRecord {
  id: string
  providerId: string
  accountId: string
  providerSessionId: string
  parentMessageId?: string
  sessionType: 'chat' | 'agent'
  messages: any[]
  createdAt: number
  lastActiveAt: number
  status: 'active' | 'expired' | 'deleted'
  model?: string
}

const sessionAPI = {
  getConfig: (): Promise<SessionConfig> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_CONFIG),

  updateConfig: (config: Partial<SessionConfig>): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SESSION_UPDATE_CONFIG, config),

  getAll: (): Promise<SessionRecord[]> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_ALL),

  getActive: (): Promise<SessionRecord[]> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_ACTIVE),

  getById: (id: string): Promise<SessionRecord | null> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_ID, id),

  getByAccount: (accountId: string): Promise<SessionRecord[]> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_ACCOUNT, accountId),

  getByProvider: (providerId: string): Promise<SessionRecord[]> =>
    ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_PROVIDER, providerId),

  delete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.SESSION_DELETE, id),

  clearAll: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SESSION_CLEAR_ALL),

  cleanExpired: (): Promise<number> =>
    ipcRenderer.invoke(IpcChannels.SESSION_CLEAN_EXPIRED),
}

interface ManagementApiConfig {
  enableManagementApi: boolean
  managementApiSecret: string
  managementApiPort?: number
}

interface ContextManagementConfig {
  enabled: boolean
  strategies: {
    slidingWindow: {
      enabled: boolean
      maxMessages: number
    }
    tokenLimit: {
      enabled: boolean
      maxTokens: number
    }
    summary: {
      enabled: boolean
      keepRecentMessages: number
      summaryPrompt?: string
    }
  }
  executionOrder: ('slidingWindow' | 'tokenLimit' | 'summary')[]
}

const managementApiAPI = {
  getConfig: (): Promise<ManagementApiConfig> =>
    ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_GET_CONFIG),

  updateConfig: (updates: Partial<ManagementApiConfig>): Promise<ManagementApiConfig> =>
    ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_UPDATE_CONFIG, updates),

  generateSecret: (): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_GENERATE_SECRET),
}

const contextManagementAPI = {
  getConfig: (): Promise<ContextManagementConfig> =>
    ipcRenderer.invoke(IpcChannels.CONTEXT_MANAGEMENT_GET_CONFIG),

  updateConfig: (updates: Partial<ContextManagementConfig>): Promise<ContextManagementConfig> =>
    ipcRenderer.invoke(IpcChannels.CONTEXT_MANAGEMENT_UPDATE_CONFIG, updates),
}

function resolveLocalManagementApiBaseUrl(config: AppConfig): string {
  const configuredHost = config.proxyHost || '127.0.0.1'
  const host = configuredHost === '0.0.0.0' || configuredHost === '::' || configuredHost === '[::]'
    ? '127.0.0.1'
    : configuredHost

  return `http://${host}:${config.proxyPort}/v0/management`
}

const toolCallingAPI = {
  async getStatus() {
    const config = await configAPI.get()
    const secret = config.managementApi?.managementApiSecret
    if (!secret) return null

    const response = await fetch(`${resolveLocalManagementApiBaseUrl(config)}/tool-calling/status`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    return response.json()
  },

  async runSmoke(input: { clientAdapterId: string }) {
    const config = await configAPI.get()
    const secret = config.managementApi?.managementApiSecret
    if (!secret) {
      return { success: false, error: { message: 'Management API secret is not configured.' } }
    }

    const response = await fetch(`${resolveLocalManagementApiBaseUrl(config)}/tool-calling/smoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    return response.json()
  },
}

const trayAPI = {
  openDashboard: (): void =>
    ipcRenderer.send('tray:open-dashboard'),

  setHeight: (height: number): void =>
    ipcRenderer.send('tray:set-height', height),

  quitApp: (): void =>
    ipcRenderer.send('tray:quit-app'),
}

const electronAPI = {
  proxy: proxyAPI,
  store: storeAPI,
  providers: providersAPI,
  accounts: accountsAPI,
  oauth: oauthAPI,
  logs: {
    ...logsAPI,
    getCategoryConfig: (): Promise<{ success: boolean; config: Record<string, { level: string; enabled: boolean }> }> =>
      ipcRenderer.invoke(IpcChannels.LOG_GET_CATEGORY_CONFIG),
    updateCategoryConfig: (config: Record<string, { level: string; enabled: boolean }>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.LOG_UPDATE_CATEGORY_CONFIG, config),
  },
  requestLogs: requestLogsAPI,
  statistics: statisticsAPI,
  app: appAPI,
  config: configAPI,
  prompts: promptsAPI,
  session: sessionAPI,
  managementApi: managementApiAPI,
  contextManagement: contextManagementAPI,
  toolCalling: toolCallingAPI,
  tray: trayAPI,

  // ==================== Plans Management API ====================
  plans: {
    getAll: (): Promise<PlanRecord[]> =>
      ipcRenderer.invoke(IpcChannels.PLANS_GET_ALL).then((r: any) => (r.success ? (r.data as PlanRecord[]) : [])),

    getById: (id: string): Promise<PlanRecord | null> =>
      ipcRenderer.invoke(IpcChannels.PLANS_GET_BY_ID, id).then((r: any) => (r.success ? (r.data as PlanRecord | null) : null)),

    create: (data: { title: string; description: string }): Promise<PlanRecord> =>
      ipcRenderer.invoke(IpcChannels.PLANS_CREATE, data).then((r: any) => (r.success ? (r.data as PlanRecord) : null as any)),

    update: (id: string, updates: Partial<PlanRecord>): Promise<PlanRecord | null> =>
      ipcRenderer.invoke(IpcChannels.PLANS_UPDATE, id, updates).then((r: any) => (r.success ? (r.data as PlanRecord | null) : null)),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.PLANS_DELETE, id).then((r: any) => (r.success ? true : false)),

    execute: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.PLANS_EXECUTE, id).then((r: any) => ({ success: r.success, error: r.error })),

    onPhaseChange: (callback: (event: { stepId: string; phase: string; detail: string; index: number; total: number }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { stepId: string; phase: string; detail: string; index: number; total: number }) => callback(event)
      ipcRenderer.on(IpcChannels.PLANS_STREAM_PHASE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.PLANS_STREAM_PHASE, handler)
    },

    onDone: (callback: (event: { success: boolean; result?: unknown; error?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { success: boolean; result?: unknown; error?: string }) => callback(event)
      ipcRenderer.on(IpcChannels.PLANS_STREAM_DONE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.PLANS_STREAM_DONE, handler)
    },

    onError: (callback: (event: { error: string; step?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { error: string; step?: string }) => callback(event)
      ipcRenderer.on(IpcChannels.PLANS_STREAM_ERROR, handler)
      return () => ipcRenderer.removeListener(IpcChannels.PLANS_STREAM_ERROR, handler)
    },
  },

  // ==================== Tasks Management API ====================
  tasks: {
    getAll: (): Promise<TaskRecord[]> =>
      ipcRenderer.invoke(IpcChannels.TASKS_GET_ALL).then((r: any) => r.data as TaskRecord[]),

    getById: (id: string): Promise<TaskRecord | null> =>
      ipcRenderer.invoke(IpcChannels.TASKS_GET_BY_ID, id).then((r: any) => r.success ? (r.data as TaskRecord | null) : null),

    create: (data: Omit<TaskRecord, 'id' | 'createdAt'>): Promise<TaskRecord> =>
      ipcRenderer.invoke(IpcChannels.TASKS_CREATE, data).then((r: any) => r.data as TaskRecord),

    update: (id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> =>
      ipcRenderer.invoke(IpcChannels.TASKS_UPDATE, id, updates).then((r: any) => r.success ? (r.data as TaskRecord | null) : null),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.TASKS_DELETE, id).then((r: any) => r.success as boolean),

    setStatus: (id: string, status: TaskRecord['status']): Promise<TaskRecord | null> =>
      ipcRenderer.invoke(IpcChannels.TASKS_SET_STATUS, id, status).then((r: any) => r.success ? (r.data as TaskRecord | null) : null),

    execute: (taskId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.TASKS_EXECUTE, taskId).then((r: any) => ({ success: r.success, error: r.error })),

    abort: (taskId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.TASKS_ABORT, taskId).then((r: any) => ({ success: r.success })),

    getRunning: (): Promise<{ taskId: string; aborted: boolean }[]> =>
      ipcRenderer.invoke(IpcChannels.TASKS_GET_RUNNING).then((r: any) => r),

    onStreamEvent: (callback: (event: { type: string; taskId?: string; detail?: string; logEntry?: { time: number; event: string; detail?: string }; task?: TaskRecord }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { type: string; taskId?: string; detail?: string; logEntry?: { time: number; event: string; detail?: string }; task?: TaskRecord }) => callback(event)
      ipcRenderer.on(IpcChannels.TASKS_STREAM_EVENT, handler)
      return () => ipcRenderer.removeListener(IpcChannels.TASKS_STREAM_EVENT, handler)
    },
  },

  // ==================== Git Management API ====================
  git: {
    getStatus: (repoPath: string): Promise<GitStatus | null> =>
      ipcRenderer.invoke(IpcChannels.GIT_GET_STATUS, repoPath).then((r: any) => r.success ? (r.data as GitStatus | null) : null),

    clone: (url: string, targetPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.GIT_CLONE, url, targetPath).then((r: any) => ({ success: r.success, error: r.error })),

    pull: (repoPath: string): Promise<{ success: boolean; output?: string; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.GIT_PULL, repoPath).then((r: any) => r.data as { success: boolean; output?: string; error?: string }),

    push: (repoPath: string): Promise<{ success: boolean; output?: string; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.GIT_PUSH, repoPath).then((r: any) => r.data as { success: boolean; output?: string; error?: string }),

    getLog: (repoPath: string, limit?: number): Promise<Array<{ hash: string; message: string; author: string; date: string }>> =>
      ipcRenderer.invoke(IpcChannels.GIT_GET_LOG, repoPath, limit).then((r: any) => r.data as Array<{ hash: string; message: string; author: string; date: string }>),

    getBranches: (repoPath: string): Promise<GitBranch[]> =>
      ipcRenderer.invoke(IpcChannels.GIT_GET_BRANCHES, repoPath).then((r: any) => r.data as GitBranch[]),

    checkout: (repoPath: string, branchName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.GIT_CHECKOUT, repoPath, branchName).then((r: any) => ({ success: r.success, error: r.error })),
  },

  // ==================== Agents Management API ====================
  agents: {
    getAll: (): Promise<AgentRecord[]> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_GET_ALL).then((r: any) => r.data as AgentRecord[]),

    getById: (id: string): Promise<AgentRecord | null> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_GET_BY_ID, id).then((r: any) => r.success ? (r.data as AgentRecord | null) : null),

    create: (data: Omit<AgentRecord, 'id' | 'createdAt' | 'lastActiveAt'>): Promise<AgentRecord> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_CREATE, data).then((r: any) => r.data as AgentRecord),

    update: (id: string, updates: Partial<AgentRecord>): Promise<AgentRecord | null> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_UPDATE, id, updates).then((r: any) => r.success ? (r.data as AgentRecord | null) : null),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_DELETE, id).then((r: any) => r.success as boolean),

    execute: (id: string, input: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_EXECUTE, id, input).then((r: any) => ({ success: r.success, error: r.error })),

    abort: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_ABORT, id).then((r: any) => ({ success: r.success })),

    getRunning: (): Promise<{ success: boolean; data?: string[] }> =>
      ipcRenderer.invoke(IpcChannels.AGENTS_GET_RUNNING).then((r: any) => r),

    onOutput: (callback: (data: { agentId: string; content: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; content: string }) => callback(data)
      ipcRenderer.on(IpcChannels.AGENTS_STREAM_OUTPUT, handler)
      return () => ipcRenderer.removeListener(IpcChannels.AGENTS_STREAM_OUTPUT, handler)
    },

    onDone: (callback: (data: { agentId: string; success: boolean; output: string; error: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; success: boolean; output: string; error: string }) => callback(data)
      ipcRenderer.on(IpcChannels.AGENTS_STREAM_DONE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.AGENTS_STREAM_DONE, handler)
    },

    onError: (callback: (data: { agentId: string; error: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; error: string }) => callback(data)
      ipcRenderer.on(IpcChannels.AGENTS_STREAM_ERROR, handler)
      return () => ipcRenderer.removeListener(IpcChannels.AGENTS_STREAM_ERROR, handler)
    },
  },

  // ==================== Commands Management API ====================
  commands: {
    getAll: (): Promise<CommandRecord[]> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_GET_ALL).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_GET_ALL failed')
        return r.data as CommandRecord[]
      }),

    getBuiltin: (): Promise<CommandRecord[]> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_GET_BUILTIN).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_GET_BUILTIN failed')
        return r.data as CommandRecord[]
      }),

    getCustom: (): Promise<CommandRecord[]> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_GET_CUSTOM).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_GET_CUSTOM failed')
        return r.data as CommandRecord[]
      }),

    add: (command: Omit<CommandRecord, 'id'>): Promise<CommandRecord> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_ADD, command).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_ADD failed')
        return r.data as CommandRecord
      }),

    update: (id: string, updates: Partial<CommandRecord>): Promise<CommandRecord | null> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_UPDATE, id, updates).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_UPDATE failed')
        return r.data as CommandRecord | null
      }),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_DELETE, id).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_DELETE failed')
        return r.success as boolean
      }),

    execute: (name: string, args?: string[]): Promise<CommandExecuteResult> =>
      ipcRenderer.invoke(IpcChannels.COMMANDS_EXECUTE, name, args).then((r: any) => {
        if (!r?.success) throw new Error(r?.error || 'COMMANDS_EXECUTE failed')
        return r.data as CommandExecuteResult
      }),
  },

  // ==================== Workflows Management API ====================
  workflows: {
    getAll: (): Promise<WorkflowRecord[]> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_GET_ALL).then((r: any) => r.data as WorkflowRecord[]),

    getById: (id: string): Promise<WorkflowRecord | null> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_GET_BY_ID, id).then((r: any) => r.success ? (r.data as WorkflowRecord | null) : null),

    create: (data: Omit<WorkflowRecord, 'id' | 'createdAt'>): Promise<WorkflowRecord> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_CREATE, data).then((r: any) => r.data as WorkflowRecord),

    update: (id: string, updates: Partial<WorkflowRecord>): Promise<WorkflowRecord | null> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_UPDATE, id, updates).then((r: any) => r.success ? (r.data as WorkflowRecord | null) : null),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_DELETE, id).then((r: any) => r.success as boolean),

    execute: (id: string, input?: Record<string, unknown>): Promise<{ success: boolean; result?: WorkflowExecuteResult; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.WORKFLOWS_EXECUTE, id, input).then((r: any) => ({ success: r.success, result: r.data, error: r.error })),

    onStepChange: (callback: (event: { stepId: string; stepName: string; status: string; output: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { stepId: string; stepName: string; status: string; output: string }) => callback(event)
      ipcRenderer.on(IpcChannels.WORKFLOWS_STREAM_STEP, handler)
      return () => ipcRenderer.removeListener(IpcChannels.WORKFLOWS_STREAM_STEP, handler)
    },

    onDone: (callback: (event: { success: boolean; result: WorkflowExecuteResult }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { success: boolean; result: WorkflowExecuteResult }) => callback(event)
      ipcRenderer.on(IpcChannels.WORKFLOWS_STREAM_DONE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.WORKFLOWS_STREAM_DONE, handler)
    },

    onError: (callback: (event: { error: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { error: string }) => callback(event)
      ipcRenderer.on(IpcChannels.WORKFLOWS_STREAM_ERROR, handler)
      return () => ipcRenderer.removeListener(IpcChannels.WORKFLOWS_STREAM_ERROR, handler)
    },
  },

  // ==================== MCP Management API ====================
  mcp: {
    getConfig: (): Promise<{ servers: McpServerConfig[] }> =>
      ipcRenderer.invoke(IpcChannels.MCP_GET_CONFIG).then((r: any) => r.data as { servers: McpServerConfig[] }),

    updateConfig: (config: { servers: McpServerConfig[] }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.MCP_UPDATE_CONFIG, config).then((r: any) => ({ success: r.success })),

    getServers: (): Promise<McpServerConfig[]> =>
      ipcRenderer.invoke(IpcChannels.MCP_GET_SERVERS).then((r: any) => r.data as McpServerConfig[]),

    getServerById: (id: string): Promise<McpServerConfig | null> =>
      ipcRenderer.invoke(IpcChannels.MCP_GET_SERVER_BY_ID, id).then((r: any) => r.success ? (r.data as McpServerConfig | null) : null),

    addServer: (server: Omit<McpServerConfig, 'id'>): Promise<McpServerConfig> =>
      ipcRenderer.invoke(IpcChannels.MCP_ADD_SERVER, server).then((r: any) => r.data as McpServerConfig),

    removeServer: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.MCP_REMOVE_SERVER, id).then((r: any) => ({ success: r.success })),

    testConnection: (server: McpServerConfig): Promise<{ success: boolean; connected: boolean; tools: any[] }> =>
      ipcRenderer.invoke(IpcChannels.MCP_TEST_CONNECTION, server).then((r: any) => ({ success: r.success, connected: r.connected, tools: r.tools })),

    getTools: (serverId: string): Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>> =>
      ipcRenderer.invoke(IpcChannels.MCP_GET_TOOLS, serverId).then((r: any) => r.data as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>),
  },

  // ==================== Plugins Management API ====================
  plugins: {
    getAll: (): Promise<PluginRecord[]> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_GET_ALL).then((r: any) => r.data as PluginRecord[]),

    getBuiltin: (): Promise<PluginRecord[]> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_GET_BUILTIN).then((r: any) => r.data as PluginRecord[]),

    getInstalled: (): Promise<PluginRecord[]> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_GET_INSTALLED).then((r: any) => r.data as PluginRecord[]),

    getById: (id: string): Promise<PluginRecord | null> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_GET_BY_ID, id).then((r: any) => r.success ? (r.data as PluginRecord | null) : null),

    install: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_INSTALL, pluginId).then((r: any) => ({ success: r.success, error: r.error })),

    uninstall: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_UNINSTALL, pluginId).then((r: any) => ({ success: r.success, error: r.error })),

    enable: (pluginId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_ENABLE, pluginId).then((r: any) => ({ success: r.success })),

    disable: (pluginId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_DISABLE, pluginId).then((r: any) => ({ success: r.success })),

    update: (pluginId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_UPDATE, pluginId).then((r: any) => ({ success: r.success, error: r.error })),

    add: (data: Omit<PluginRecord, 'id'>): Promise<PluginRecord> =>
      ipcRenderer.invoke(IpcChannels.PLUGINS_ADD, data).then((r: any) => r.data as PluginRecord),
  },

  // ==================== Other Config API ====================
  otherConfig: {
    get: (): Promise<OtherConfig> =>
      ipcRenderer.invoke(IpcChannels.OTHER_CONFIG_GET).then((r: any) => r.data as OtherConfig),

    update: (updates: { advanced?: Record<string, unknown>; experimental?: Record<string, unknown>; developer?: Record<string, unknown> }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.OTHER_CONFIG_UPDATE, updates).then((r: any) => ({ success: r.success })),

    getAdvanced: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IpcChannels.OTHER_CONFIG_GET_ADVANCED).then((r: any) => r.data as Record<string, unknown>),

    updateAdvanced: (config: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.OTHER_CONFIG_UPDATE_ADVANCED, config).then((r: any) => ({ success: r.success })),

    reset: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.OTHER_CONFIG_RESET).then((r: any) => ({ success: r.success })),
  },

  // ==================== Management Import/Export ====================
  mgmt: {
    export: (moduleName: string, data: any): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_EXPORT, moduleName, data).then((r: any) => r),

    import: (moduleName: string, jsonData: string): Promise<{ success: boolean; data?: any; count?: number; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_IMPORT, moduleName, jsonData).then((r: any) => r),

    backup: (): Promise<{ success: boolean; path?: string; modules?: string[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_BACKUP).then((r: any) => r),

    restore: (filePath: string): Promise<{ success: boolean; restored?: Record<string, number>; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_RESTORE, filePath).then((r: any) => r),

    getAllBackups: (): Promise<{ success: boolean; data?: Array<{ name: string; path: string }>; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_GET_ALL_BACKUPS).then((r: any) => r),

    deleteBackup: (fileName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.MGMT_DELETE_BACKUP, fileName).then((r: any) => r),
  },

  // Cookie Session — 网页 Cookie 持续注入
  cookieSession: {
    init: (providers: ProviderVendor[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_INIT, providers),
    openLogin: (providerType: ProviderVendor): Promise<{ success: boolean; opened: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_OPEN_LOGIN, providerType),
    clearLogin: (providerType: ProviderVendor): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_CLEAR_LOGIN, providerType),
    getStatus: (): Promise<{ success: boolean; status: Record<ProviderVendor, { ready: boolean; cookieCount: number }> }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_GET_STATUS),
    getCredentials: (providerType: ProviderVendor): Promise<{ success: boolean; credentials: Record<string, string> }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_GET_CREDENTIALS, providerType),
    destroy: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IpcChannels.COOKIE_SESSION_DESTROY),
    onCredentialsChanged: (callback: (data: { provider: ProviderVendor; credentials: Record<string, string> }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { provider: ProviderVendor; credentials: Record<string, string> }) => callback(data)
      ipcRenderer.on(IpcChannels.COOKIE_SESSION_CREDENTIALS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.COOKIE_SESSION_CREDENTIALS_CHANGED, handler)
    },
  },

  // Chat API — AI 对话功能
  chat: {
    sendMessage: (text: string): Promise<{ success: boolean; requestId?: string; error?: string }> =>
      ipcRenderer.invoke('chat:sendMessage', text),

    onStreamChunk: (callback: (data: { requestId: string; chunk: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; chunk: string }) => callback(data)
      ipcRenderer.on(IpcChannels.CHAT_STREAM_CHUNK, handler)
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_CHUNK, handler)
    },

    onStreamDone: (callback: (data: { requestId: string; content: string; toolOutput?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; content: string; toolOutput?: string }) => callback(data)
      ipcRenderer.on(IpcChannels.CHAT_STREAM_DONE, handler)
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_DONE, handler)
    },

    onStreamError: (callback: (data: { requestId: string; error: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => callback(data)
      ipcRenderer.on(IpcChannels.CHAT_STREAM_ERROR, handler)
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_ERROR, handler)
    },

    onStreamReasoning: (callback: (data: { requestId: string; reasoning: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; reasoning: string }) => callback(data)
      ipcRenderer.on(IpcChannels.CHAT_STREAM_REASONING, handler)
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_REASONING, handler)
    },

    getHistory: (): Promise<{ messages: Array<{ role: string; content: string }> }> =>
      ipcRenderer.invoke('chat:getHistory'),

    clearHistory: (): Promise<boolean> =>
      ipcRenderer.invoke('chat:clearHistory'),

    getConfig: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('chat:getConfig'),

    setConfig: (updates: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chat:setConfig', updates),

    executeCommand: (name: string, args: string[]): Promise<{ success: boolean; output?: string; error?: string }> =>
      ipcRenderer.invoke('chat:executeCommand', name, args),
  },

  // Profiles API — 配置组管理
  profiles: {
    getAll: (): Promise<{ success: boolean; profiles?: Profile[]; activeProfile?: string | null }> =>
      ipcRenderer.invoke('profiles:getAll'),

    getActive: (): Promise<{ success: boolean; profile?: Profile | null }> =>
      ipcRenderer.invoke('profiles:getActive'),

    setActive: (name: string): Promise<{ success: boolean; profile?: Profile; error?: string }> => {
      console.log('[Preload] profiles.setActive invoked:', name)
      return ipcRenderer.invoke('profiles:setActive', name).then(r => {
        console.log('[Preload] profiles.setActive result:', r)
        return r
      }).catch(e => {
        console.error('[Preload] profiles.setActive error:', e)
        return { success: false, error: (e as Error).message }
      })
    },

    upsert: (profile: Profile): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('profiles:upsert', profile),

    remove: (name: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('profiles:remove', name),
  },

  // .doge config file management
  dogeConfig: {
    listFiles: (): Promise<{ success: boolean; files?: Array<{ name: string; path: string; size: number; modified: number }> }> =>
      ipcRenderer.invoke('doge:listConfigFiles'),

    readFile: (name: string): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('doge:readConfigFile', name),

    deleteFile: (name: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('doge:deleteConfigFile', name),
  },

  // Config Groups — API 配置组管理
  configGroups: {
    list: (): Promise<{ success: boolean; groups?: ConfigGroup[]; activeGroup?: string | null }> =>
      ipcRenderer.invoke('configGroups:list'),

    get: (id: string): Promise<{ success: boolean; group?: ConfigGroup; data?: ConfigGroupData; error?: string }> =>
      ipcRenderer.invoke('configGroups:get', id),

    getById: (id: string): Promise<{ success: boolean; group?: ConfigGroup; data?: ConfigGroupData; error?: string }> =>
      ipcRenderer.invoke('configGroups:getById', id),

    create: (id: string, data?: Partial<ConfigGroupData>): Promise<{ success: boolean; group?: ConfigGroup; error?: string }> =>
      ipcRenderer.invoke('configGroups:create', id, data),

    update: (id: string, data: ConfigGroupData): Promise<{ success: boolean; group?: ConfigGroup; error?: string }> =>
      ipcRenderer.invoke('configGroups:update', id, data),

    delete: (id: string): Promise<{ success: boolean; id?: string; deleted?: boolean; error?: string }> =>
      ipcRenderer.invoke('configGroups:delete', id),

    setActive: (id: string): Promise<{ success: boolean; group?: ConfigGroup; error?: string }> =>
      ipcRenderer.invoke('configGroups:setActive', id),

    switch: (id: string): Promise<{ success: boolean; group?: ConfigGroup; preset?: string; error?: string }> =>
      ipcRenderer.invoke('configGroups:switch', id),
  },

  // Team Task — 多角色协作任务
  team: {
    execute: (description: string, customRoles?: Array<{ id: string; name: string; systemPrompt: string }>): Promise<{ success: boolean; report?: unknown; error?: string }> =>
      ipcRenderer.invoke('team:execute', description, customRoles),

    getResult: (planId: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('team:getResult', planId),

    onPhaseChange: (callback: (event: { phase: string; detail: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { phase: string; detail: string }) => callback(event)
      ipcRenderer.on('team:streamPhase', handler)
      return () => ipcRenderer.removeListener('team:streamPhase', handler)
    },

    onDiscussion: (callback: (event: { id: string; phase: string; roleId: string; roleName: string; content: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { id: string; phase: string; roleId: string; roleName: string; content: string }) => callback(event)
      ipcRenderer.on('team:streamDiscussion', handler)
      return () => ipcRenderer.removeListener('team:streamDiscussion', handler)
    },

    onTaskEvent: (callback: (event: { type: 'start' | 'complete'; taskId: string; description: string; success?: boolean; durationMs?: number; output?: string; error?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { type: 'start' | 'complete'; taskId: string; description: string; success?: boolean; durationMs?: number; output?: string; error?: string }) => callback(event)
      ipcRenderer.on('team:streamTask', handler)
      return () => ipcRenderer.removeListener('team:streamTask', handler)
    },

    onDone: (callback: (event: { success: boolean; totalDurationMs: number; discussionRounds: number; taskResults: unknown[]; planId: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { success: boolean; totalDurationMs: number; discussionRounds: number; taskResults: unknown[]; planId: string }) => callback(event)
      ipcRenderer.on('team:streamDone', handler)
      return () => ipcRenderer.removeListener('team:streamDone', handler)
    },

    onError: (callback: (event: { error: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: { error: string }) => callback(event)
      ipcRenderer.on('team:streamError', handler)
      return () => ipcRenderer.removeListener('team:streamError', handler)
    },
  },

  // Tools — 工具管理
  tools: {
    getAll: (): Promise<{ success: boolean; data?: { tools: any[]; groups: any[]; hintRules: any[] }; error?: string }> =>
      ipcRenderer.invoke('tools:getAll'),

    getGroups: (): Promise<{ success: boolean; data?: any[]; error?: string }> =>
      ipcRenderer.invoke('tools:getGroups'),

    getHintRules: (): Promise<{ success: boolean; data?: any[]; error?: string }> =>
      ipcRenderer.invoke('tools:getHintRules'),

    add: (tool: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:add', tool),

    update: (id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:update', id, updates),

    remove: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:remove', id),

    toggle: (id: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:toggle', id),

    addGroup: (group: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:addGroup', group),

    updateGroup: (id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:updateGroup', id, updates),

    removeGroup: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:removeGroup', id),

    addToGroup: (toolId: string, groupId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:addToGroup', toolId, groupId),

    removeFromGroup: (toolId: string, groupId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:removeFromGroup', toolId, groupId),

    addHintRule: (rule: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:addHintRule', rule),

    updateHintRule: (id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:updateHintRule', id, updates),

    removeHintRule: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:removeHintRule', id),

    matchHints: (input: string): Promise<{ success: boolean; data?: { groups: any[]; tools: any[] }; error?: string }> =>
      ipcRenderer.invoke('tools:matchHints', input),

    reset: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('tools:reset'),

    getById: (id: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:getById', id),

    /** 把内置工具/分组/规则恢复成内置默认（清除用户对其的覆盖） */
    resetBuiltin: (
      kind: 'tool' | 'group' | 'hintRule',
      id: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:resetBuiltin', kind, id),

    /** 确保实体已有可编辑文件（内置项首次会物化一份），返回 JSON 文件路径 */
    ensureFile: (id: string): Promise<{ success: boolean; data?: { path: string }; error?: string }> =>
      ipcRenderer.invoke('tools:ensureFile', id),

    /** 在系统文件管理器中定位并选中该工具的 JSON 文件 */
    revealFile: (id: string): Promise<{ success: boolean; data?: { path: string }; error?: string }> =>
      ipcRenderer.invoke('tools:revealFile', id),

    // ---- 角色与元工具（dev.txt §4/§6）----

    /** 全部角色配置 */
    getRoles: (): Promise<{ success: boolean; data?: any[]; error?: string }> =>
      ipcRenderer.invoke('tools:getRoles'),

    /** 更新角色配置（默认组 / 允许组 / 禁用标签 / 禁用风险 / 活跃上限） */
    updateRole: (id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:updateRole', id, updates),

    /** 搜索工具，返回轻量卡片（不含完整 schema） */
    search: (
      query: string,
      opts?: { group?: string; tags?: string[]; limit?: number }
    ): Promise<{ success: boolean; data?: any[]; error?: string }> =>
      ipcRenderer.invoke('tools:search', query, opts),

    /** 加载工具进当前会话活跃集 */
    load: (ids: string[], sessionId?: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:load', ids, sessionId),

    /** 从活跃集卸载工具 */
    unload: (ids: string[], sessionId?: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:unload', ids, sessionId),

    /** 当前活跃工具 */
    active: (sessionId?: string): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:active', sessionId),

    // ---- 度量与上下文状态（dev.txt §13）----

    /** 运行时度量汇总：成功率 / 误选率 / token / 分层占比 */
    metrics: (since?: number): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:metrics', since),

    /** 清空度量 */
    resetMetrics: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:metricsReset'),

    /** 当前上下文构建状态（是否分层、全量基线 token、预算） */
    contextStatus: (): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke('tools:contextStatus'),
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },

  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args)
  },

  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
