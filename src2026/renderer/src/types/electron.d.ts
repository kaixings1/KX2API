import type { 
  Provider, 
  Account, 
  ProxyStatus, 
  ProxyStatistics,
  ProviderCheckResult, 
  OAuthResult,
  AuthType,
  CredentialField,
  LogLevel,
  LogEntry,
  LoadBalanceStrategy,
  ModelMapping,
  AppConfig,
  AccountStatus,
  ProviderType,
  ProviderVendor,
  ProviderStatus,
  ApiKey,
  SystemPrompt,
  PromptType,
  ToolCallingConfig,
  LegacyToolPromptConfig,
  EffectiveModel,
} from '../../../shared/types'

export type { 
  Provider, 
  Account, 
  ProxyStatus,
  ProxyStatistics,
  ProviderCheckResult, 
  OAuthResult,
  AuthType,
  CredentialField,
  LogLevel,
  LogEntry,
  LoadBalanceStrategy,
  ModelMapping,
  AppConfig,
  AccountStatus,
  ProviderType,
  ProviderVendor,
  ProviderStatus,
  ApiKey,
  SystemPrompt,
  PromptType,
  ToolCallingConfig,
  LegacyToolPromptConfig,
  EffectiveModel,
}

export interface CustomProviderFormData {
  name: string
  authType: AuthType
  apiEndpoint: string
  headers: Record<string, string>
  description: string
  supportedModels: string[]
  credentialFields: CredentialField[]
}

export interface BuiltinProviderConfig extends Provider {
  credentialFields: CredentialField[]
  tokenCheckEndpoint?: string
  tokenCheckMethod?: 'GET' | 'POST'
}

interface ProxyAPI {
  start: (port?: number) => Promise<boolean>
  stop: () => Promise<boolean>
  getStatus: () => Promise<ProxyStatus>
  onStatusChanged: (callback: (status: ProxyStatus) => void) => () => void
}

interface StoreAPI {
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
  clearAll: () => Promise<void>
}

interface ProvidersAPI {
  getAll: () => Promise<Provider[]>
  getBuiltin: () => Promise<BuiltinProviderConfig[]>
  add: (data: {
    id?: string
    name: string
    type?: 'builtin' | 'custom'
    authType: AuthType
    apiEndpoint: string
    headers?: Record<string, string>
    description?: string
    supportedModels?: string[]
    credentialFields?: CredentialField[]
  }) => Promise<Provider>
  update: (id: string, updates: Partial<Provider>) => Promise<Provider | null>
  delete: (id: string) => Promise<boolean>
  checkStatus: (providerId: string) => Promise<ProviderCheckResult>
  checkAllStatus: () => Promise<Record<string, ProviderCheckResult>>
  duplicate: (id: string) => Promise<Provider>
  export: (id: string) => Promise<string>
  import: (jsonData: string) => Promise<Provider>
  updateModels: (providerId: string) => Promise<{
    success: boolean
    modelsCount?: number
    error?: string
  }>
  getEffectiveModels: (providerId: string) => Promise<EffectiveModel[]>
  addCustomModel: (providerId: string, model: { displayName: string; actualModelId: string }) => Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }>
  removeModel: (providerId: string, modelName: string) => Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }>
  resetModels: (providerId: string) => Promise<{
    success: boolean
    models: EffectiveModel[]
    error?: string
  }>
}

interface AccountsAPI {
  getAll: (includeCredentials?: boolean) => Promise<Account[]>
  add: (data: {
    providerId: string
    name: string
    email?: string
    credentials: Record<string, string>
    dailyLimit?: number
  }) => Promise<Account>
  update: (id: string, updates: Partial<Account>) => Promise<Account | null>
  delete: (id: string) => Promise<boolean>
  validate: (accountId: string) => Promise<boolean>
  validateToken: (providerId: string, credentials: Record<string, string>) => Promise<{
    valid: boolean
    error?: string
    userInfo?: {
      name?: string
      email?: string
      quota?: number
      used?: number
    }
  }>
  getById: (id: string, includeCredentials?: boolean) => Promise<Account | null>
  getByProvider: (providerId: string) => Promise<Account[]>
  getCredits: (accountId: string) => Promise<{
    totalCredits: number
    usedCredits: number
    remainingCredits: number
    expiresAt?: number // Credit reset timestamp (milliseconds)
  } | null>
  clearChats: (accountId: string) => Promise<{ success: boolean; error?: string }>
}

interface OAuthAPI {
  startLogin: (providerId: string, providerType: ProviderVendor) => Promise<OAuthResult>
  cancelLogin: () => Promise<void>
  loginWithToken: (providerId: string, providerType: ProviderVendor, token: string) => Promise<OAuthResult>
  validateToken: (providerId: string, providerType: ProviderVendor, credentials: Record<string, string>) => Promise<{
    valid: boolean
    tokenType?: string
    expiresAt?: number
    accountInfo?: {
      userId?: string
      email?: string
      name?: string
    }
    error?: string
  }>
  refreshToken: (providerId: string, providerType: ProviderVendor, credentials: Record<string, string>) => Promise<{
    type: string
    value: string
    expiresAt?: number
    refreshToken?: string
  } | null>
  getStatus: () => Promise<string>
  startInAppLogin: (providerId: string, providerType: ProviderVendor, timeout?: number) => Promise<OAuthResult>
  cancelInAppLogin: () => Promise<void>
  isInAppLoginOpen: () => Promise<boolean>
  onCallback: (callback: (result: OAuthResult) => void) => () => void
  onProgress: (callback: (event: {
    status: 'idle' | 'pending' | 'success' | 'error' | 'cancelled'
    message: string
    progress?: number
    data?: Record<string, unknown>
  }) => void) => () => void
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

interface LogsAPI {
  get: (filter?: LogFilter) => Promise<LogEntry[]>
  getStats: () => Promise<LogStats>
  getTrend: (days?: number) => Promise<LogTrend[]>
  getAccountTrend: (accountId: string, days?: number) => Promise<LogTrend[]>
  clear: () => Promise<void>
  export: (format?: 'json' | 'txt') => Promise<string>
  getById: (id: string) => Promise<LogEntry | null>
  onNewLog: (callback: (log: LogEntry) => void) => () => void
  getCategoryConfig: () => Promise<{ success: boolean; config: Record<string, { level: string; enabled: boolean }> }>
  updateCategoryConfig: (config: Record<string, { level: string; enabled: boolean }>) => Promise<{ success: boolean }>
}

interface UpdateProgressInfo {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

interface UpdateDownloadedInfo {
  version: string
  releaseDate: string
  releaseNotes?: string
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

interface AppAPI {
  getVersion: () => Promise<string>
  checkUpdate: () => Promise<UpdateStatus>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  getUpdateStatus: () => Promise<UpdateStatus>
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateDownloadedInfo) => void) => () => void
  onUpdateNotAvailable: (callback: (info: UpdateDownloadedInfo) => void) => () => void
  onUpdateProgress: (callback: (progress: UpdateProgressInfo) => void) => () => void
  onUpdateDownloaded: (callback: (info: UpdateDownloadedInfo) => void) => () => void
  onUpdateError: (callback: (error: { message?: string } | string) => void) => () => void
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  openExternal: (url: string) => Promise<void>
}

interface ConfigAPI {
  get: () => Promise<AppConfig>
  update: (updates: Partial<AppConfig>) => Promise<boolean>
  onConfigChanged: (callback: (config: AppConfig) => void) => () => void
}

interface PromptsAPI {
  getAll: () => Promise<SystemPrompt[]>
  getBuiltin: () => Promise<SystemPrompt[]>
  getCustom: () => Promise<SystemPrompt[]>
  getById: (id: string) => Promise<SystemPrompt | undefined>
  add: (prompt: Omit<SystemPrompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SystemPrompt>
  update: (id: string, updates: Partial<SystemPrompt>) => Promise<SystemPrompt | null>
  delete: (id: string) => Promise<boolean>
  getByType: (type: PromptType) => Promise<SystemPrompt[]>
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

interface SessionAPI {
  getConfig: () => Promise<SessionConfig>
  updateConfig: (config: Partial<SessionConfig>) => Promise<void>
  getAll: () => Promise<SessionRecord[]>
  getActive: () => Promise<SessionRecord[]>
  getById: (id: string) => Promise<SessionRecord | undefined>
  getByAccount: (accountId: string) => Promise<SessionRecord[]>
  getByProvider: (providerId: string) => Promise<SessionRecord[]>
  delete: (id: string) => Promise<boolean>
  clearAll: () => Promise<void>
  cleanExpired: () => Promise<number>
}

interface RequestLogEntry {
  id: string
  timestamp: number
  status: 'success' | 'error' | 'pending'
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
  /** Chat user input (pipeline tracking) */
  chatUserInput?: string
  /** Engine URL */
  chatEngineUrl?: string
  /** Engine provider */
  chatEngineProvider?: string
  /** Engine model */
  chatEngineModel?: string
  /** Proxy provider name */
  chatProxyProviderName?: string
  /** Proxy account name */
  chatProxyAccountName?: string
  /** Proxy actual model */
  chatProxyActualModel?: string
  /** Upstream URL */
  chatUpstreamUrl?: string
  /** Upstream status code */
  chatUpstreamStatus?: number
  /** Whether upstream is streaming */
  chatUpstreamIsStream?: boolean
  /** Upstream response preview */
  chatUpstreamResponsePreview?: string
  /** Proxy process latency (ms) */
  chatProxyProcessLatency?: number
  /** Notes / processing summary */
  chatNotes?: string
  /** Web search enabled */
  webSearch?: boolean
  /** Reasoning effort level */
  reasoningEffort?: 'low' | 'medium' | 'high'
  responseStatus: number
  responsePreview?: string
  /** Response body JSON string */
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

interface RequestLogsAPI {
  get: (filter?: RequestLogFilter) => Promise<RequestLogEntry[]>
  getById: (id: string) => Promise<RequestLogEntry | undefined>
  getStats: () => Promise<RequestLogStats>
  getTrend: (days?: number) => Promise<RequestLogTrend[]>
  clear: () => Promise<void>
  onNewLog: (callback: (log: RequestLogEntry) => void) => () => void
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

interface StatisticsAPI {
  get: () => Promise<PersistentStatistics>
  getToday: () => Promise<DailyStatistics>
}

interface TrayAPI {
  openDashboard: () => void
  setHeight: (height: number) => void
  quitApp: () => void
}

interface ManagementApiConfig {
  enableManagementApi: boolean
  managementApiSecret: string
  managementApiPort?: number
}

interface ManagementApiAPI {
  getConfig: () => Promise<ManagementApiConfig>
  updateConfig: (updates: Partial<ManagementApiConfig>) => Promise<boolean>
  generateSecret: () => Promise<string>
}

interface StrategyConfig {
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

interface ContextManagementConfig {
  enabled: boolean
  strategies: StrategyConfig
  executionOrder: ('slidingWindow' | 'tokenLimit' | 'summary')[]
}

interface ContextManagementAPI {
  getConfig: () => Promise<ContextManagementConfig>
  updateConfig: (updates: Partial<ContextManagementConfig>) => Promise<ContextManagementConfig>
}

interface ToolAPI {
  getAll: () => Promise<{ success: boolean; data?: { tools: any[]; groups: any[]; hintRules: any[] }; error?: string }>
  getGroups: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  getHintRules: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  add: (tool: any) => Promise<{ success: boolean; data?: any; error?: string }>
  update: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>
  remove: (id: string) => Promise<{ success: boolean; error?: string }>
  toggle: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>
  addGroup: (group: any) => Promise<{ success: boolean; data?: any; error?: string }>
  updateGroup: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>
  removeGroup: (id: string) => Promise<{ success: boolean; error?: string }>
  addToGroup: (toolId: string, groupId: string) => Promise<{ success: boolean; error?: string }>
  removeFromGroup: (toolId: string, groupId: string) => Promise<{ success: boolean; error?: string }>
  addHintRule: (rule: any) => Promise<{ success: boolean; data?: any; error?: string }>
  updateHintRule: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>
  removeHintRule: (id: string) => Promise<{ success: boolean; error?: string }>
  matchHints: (input: string) => Promise<{ success: boolean; data?: { groups: any[]; tools: any[] }; error?: string }>
  reset: () => Promise<{ success: boolean }>
}

interface ToolCallingAPI {
  getStatus: () => Promise<unknown>
  runSmoke: (input: { clientAdapterId: string }) => Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>
}

interface TeamTaskPhaseEvent {
  phase: string
  detail: string
}

interface TeamTaskDiscussionEvent {
  id: string
  phase: string
  roleId: string
  roleName: string
  content: string
}

interface TeamTaskTaskEvent {
  type: 'start' | 'complete'
  taskId: string
  description: string
  success?: boolean
  durationMs?: number
  output?: string
  error?: string
}

interface TeamTaskDoneEvent {
  success: boolean
  totalDurationMs: number
  discussionRounds: number
  taskResults: Array<{
    taskId: string
    description: string
    success: boolean
    durationMs: number
    output?: string
    error?: string
  }>
  planId: string
}

interface TeamTaskErrorEvent {
  error: string
}

interface TeamTaskAPI {
  execute: (description: string, customRoles?: Array<{ id: string; name: string; systemPrompt: string }>) => Promise<{ success: boolean; report?: unknown; error?: string }>
  getResult: (planId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  onPhaseChange: (callback: (event: TeamTaskPhaseEvent) => void) => () => void
  onDiscussion: (callback: (event: TeamTaskDiscussionEvent) => void) => () => void
  onTaskEvent: (callback: (event: TeamTaskTaskEvent) => void) => () => void
  onDone: (callback: (event: { success: boolean; totalDurationMs: number; discussionRounds: number; taskResults: unknown[]; planId: string }) => void) => () => void
  onError: (callback: (event: TeamTaskErrorEvent) => void) => () => void
}

interface ElectronAPI {
  proxy: ProxyAPI
  store: StoreAPI
  providers: ProvidersAPI
  accounts: AccountsAPI
  oauth: OAuthAPI
  logs: LogsAPI
  requestLogs: RequestLogsAPI
  statistics: StatisticsAPI
  app: AppAPI
  config: ConfigAPI
  prompts: PromptsAPI
  session: SessionAPI
  managementApi: ManagementApiAPI
  contextManagement: ContextManagementAPI
  toolCalling: ToolCallingAPI
  agents: {
    getAll: () => Promise<AgentRecord[]>
    getById: (id: string) => Promise<AgentRecord | null>
    create: (data: Omit<AgentRecord, 'id' | 'createdAt' | 'lastActiveAt'>) => Promise<AgentRecord>
    update: (id: string, updates: Partial<AgentRecord>) => Promise<AgentRecord | null>
    delete: (id: string) => Promise<boolean>
    execute: (id: string, input: string) => Promise<{ success: boolean; error?: string }>
    onOutput: (callback: (data: { agentId: string; content: string }) => void) => () => void
    onDone: (callback: (data: { agentId: string; success: boolean; output: string; error: string }) => void) => () => void
    onError: (callback: (data: { agentId: string; error: string }) => void) => () => void
  }
  commands: {
    getAll: () => Promise<CommandRecord[]>
    getBuiltin: () => Promise<CommandRecord[]>
    getCustom: () => Promise<CommandRecord[]>
    add: (command: Omit<CommandRecord, 'id'>) => Promise<CommandRecord>
    update: (id: string, updates: Partial<CommandRecord>) => Promise<CommandRecord | null>
    delete: (id: string) => Promise<boolean>
    execute: (name: string, args?: string[]) => Promise<CommandExecuteResult>
  }
  git: {
    getStatus: (repoPath: string) => Promise<GitStatus | null>
    clone: (url: string, targetPath: string) => Promise<{ success: boolean; error?: string }>
    pull: (repoPath: string) => Promise<{ success: boolean; output?: string; error?: string }>
    push: (repoPath: string) => Promise<{ success: boolean; output?: string; error?: string }>
    getLog: (repoPath: string, limit?: number) => Promise<Array<{ hash: string; message: string; author: string; date: string }>>
    getBranches: (repoPath: string) => Promise<GitBranch[]>
    checkout: (repoPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>
  }
  plans: {
    getAll: () => Promise<PlanRecord[]>
    getById: (id: string) => Promise<PlanRecord | null>
    create: (data: { title: string; description: string; steps?: Array<{ id: string; description: string; status: string }> }) => Promise<PlanRecord>
    update: (id: string, updates: Partial<PlanRecord>) => Promise<PlanRecord | null>
    delete: (id: string) => Promise<boolean>
    execute: (id: string) => Promise<{ success: boolean; error?: string }>
    onPhaseChange: (callback: (event: { stepId: string; phase: string; detail: string; index: number; total: number }) => void) => () => void
    onDone: (callback: (event: { success: boolean; result?: unknown; error?: string }) => void) => () => void
    onError: (callback: (event: { error: string; step?: string }) => void) => () => void
  }
  prompts: {
    getAll: () => Promise<SystemPrompt[]>
    getBuiltin: () => Promise<SystemPrompt[]>
    getCustom: () => Promise<SystemPrompt[]>
    getById: (id: string) => Promise<SystemPrompt | null>
    add: (prompt: Omit<SystemPrompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SystemPrompt>
    update: (id: string, updates: Partial<SystemPrompt>) => Promise<SystemPrompt | null>
    delete: (id: string) => Promise<boolean>
    getByType: (type: PromptType) => Promise<SystemPrompt[]>
  }
  tasks: {
    getAll: () => Promise<TaskRecord[]>
    getById: (id: string) => Promise<TaskRecord | null>
    create: (data: Omit<TaskRecord, 'id' | 'createdAt'>) => Promise<TaskRecord>
    update: (id: string, updates: Partial<TaskRecord>) => Promise<TaskRecord | null>
    delete: (id: string) => Promise<boolean>
    setStatus: (id: string, status: TaskRecord['status']) => Promise<TaskRecord | null>
  }
  workflows: {
    getAll: () => Promise<WorkflowRecord[]>
    getById: (id: string) => Promise<WorkflowRecord | null>
    create: (data: Omit<WorkflowRecord, 'id' | 'createdAt'>) => Promise<WorkflowRecord>
    update: (id: string, updates: Partial<WorkflowRecord>) => Promise<WorkflowRecord | null>
    delete: (id: string) => Promise<boolean>
    execute: (id: string, input?: Record<string, unknown>) => Promise<{ success: boolean; result?: WorkflowExecuteResult; error?: string }>
    onStepChange: (callback: (event: { stepId: string; stepName: string; status: string; output: string }) => void) => () => void
    onDone: (callback: (event: { success: boolean; result: WorkflowExecuteResult }) => void) => () => void
    onError: (callback: (event: { error: string }) => void) => () => void
  }
  mcp: {
    getConfig: () => Promise<{ servers: McpServerConfig[] }>
    updateConfig: (config: { servers: McpServerConfig[] }) => Promise<{ success: boolean }>
    getServers: () => Promise<McpServerConfig[]>
    addServer: (server: Omit<McpServerConfig, 'id'>) => Promise<McpServerConfig>
    removeServer: (id: string) => Promise<{ success: boolean }>
    testConnection: (server: McpServerConfig) => Promise<{ success: boolean; connected: boolean; tools: any[] }>
    getTools: (serverId: string) => Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>>
  }
  tools: ToolAPI
  plugins: {
    getAll: () => Promise<PluginRecord[]>
    getBuiltin: () => Promise<PluginRecord[]>
    getInstalled: () => Promise<PluginRecord[]>
    install: (pluginId: string) => Promise<{ success: boolean; error?: string }>
    uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>
    enable: (pluginId: string) => Promise<{ success: boolean }>
    disable: (pluginId: string) => Promise<{ success: boolean }>
    update: (pluginId: string) => Promise<{ success: boolean; error?: string }>
  }
  otherConfig: {
    get: () => Promise<OtherConfig>
    update: (updates: { advanced?: Record<string, unknown>; experimental?: Record<string, unknown>; developer?: Record<string, unknown> }) => Promise<{ success: boolean }>
    getAdvanced: () => Promise<Record<string, unknown>>
    updateAdvanced: (config: Record<string, unknown>) => Promise<{ success: boolean }>
    reset: () => Promise<{ success: boolean }>
  }
  team: TeamTaskAPI
  tray: TrayAPI
  cookieSession: {
    init: (providers: string[]) => Promise<{ success: boolean; error?: string }>
    openLogin: (providerType: string) => Promise<{ success: boolean; opened: boolean; error?: string }>
    clearLogin: (providerType: string) => Promise<{ success: boolean; error?: string }>
    getStatus: () => Promise<{ success: boolean; status: Record<string, { ready: boolean; cookieCount: number }> }>
    getCredentials: (providerType: string) => Promise<{ success: boolean; credentials: Record<string, string> }>
    destroy: () => Promise<{ success: boolean }>
    onCredentialsChanged: (callback: (data: { provider: string; credentials: Record<string, string> }) => void) => () => void
  }
  chat: {
    sendMessage: (text: string) => Promise<{ success: boolean; requestId?: string; error?: string }>
    onStreamChunk: (callback: (data: { requestId: string; chunk: string }) => void) => () => void
    onStreamDone: (callback: (data: { requestId: string; content: string; toolOutput?: string }) => void) => () => void
    onStreamError: (callback: (data: { requestId: string; error: string }) => void) => () => void
    getHistory: () => Promise<{ messages: Array<{ role: string; content: string }> }>
    clearHistory: () => Promise<boolean>
    getConfig: () => Promise<Record<string, unknown>>
    setConfig: (updates: Record<string, unknown>) => Promise<{ success: boolean }>
    executeCommand: (name: string, args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
  }
  profiles: {
    getAll: () => Promise<{ success: boolean; profiles?: Profile[]; activeProfile?: string | null }>
    getActive: () => Promise<{ success: boolean; profile?: Profile | null }>
    setActive: (name: string) => Promise<{ success: boolean; profile?: Profile; error?: string }>
    upsert: (profile: Profile) => Promise<{ success: boolean }>
    remove: (name: string) => Promise<{ success: boolean; error?: string }>
  }
  dogeConfig: {
    listFiles: () => Promise<{ success: boolean; files?: Array<{ name: string; path: string; size: number; modified: number }> }>
    readFile: (name: string) => Promise<{ success: boolean; content?: string; error?: string }>
    deleteFile: (name: string) => Promise<{ success: boolean; error?: string }>
  }
  mgmt: {
    export: (moduleName: string, data: any) => Promise<{ success: boolean; path?: string; error?: string }>
    import: (moduleName: string, jsonData: string) => Promise<{ success: boolean; data?: any; count?: number; error?: string }>
    backup: () => Promise<{ success: boolean; path?: string; modules?: string[]; error?: string }>
    restore: (filePath: string) => Promise<{ success: boolean; restored?: Record<string, number>; error?: string }>
    getAllBackups: () => Promise<{ success: boolean; data?: Array<{ name: string; path: string }>; error?: string }>
    deleteBackup: (fileName: string) => Promise<{ success: boolean; error?: string }>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  send: (channel: string, ...args: unknown[]) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

declare global {
  // ==================== New Module Types (mirrors preload/index.ts) ====================
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

  interface AgentRecord {
    id: string
    name: string
    role: string
    systemPrompt: string
    model?: string
    status: 'idle' | 'running' | 'error'
    createdAt: number
    lastActiveAt?: number
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

  interface ReportItem {
    success: boolean
    totalDurationMs: number
    discussionRounds: number
    taskResults: TaskItem[]
    planId: string
  }

  interface TaskItem {
    type: 'start' | 'complete'
    taskId: string
    description: string
    success?: boolean
    durationMs?: number
    output?: string
    error?: string
  }

  interface ManagementApiConfig {
    enableManagementApi: boolean
    managementApiSecret: string
    managementApiPort?: number
  }

  interface Profile {
    name: string
    providers: any[]
    accounts: any[]
    modelMappings: any
    config: any
    createdAt: number
    updatedAt: number
  }

  interface CustomRole {
    id: string
    name: string
    systemPrompt: string
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
