export type AccountStatus = 'active' | 'inactive' | 'expired' | 'error'

export type ProviderStatus = 'online' | 'offline' | 'unknown'

export type ProviderType = 'builtin' | 'custom'

// Provider vendor type (for OAuth adapters)
export type ProviderVendor = 'deepseek' | 'glm' | 'kimi' | 'mimo' | 'minimax' | 'qwen' | 'qwen-ai' | 'zai' | 'perplexity' | 'stepfun' | 'custom'

export type AuthType = 
  | 'oauth' 
  | 'token' 
  | 'cookie' 
  | 'userToken' 
  | 'refresh_token' 
  | 'jwt' 
  | 'realUserID_token' 
  | 'tongyi_sso_ticket'

export interface CredentialField {
  name: string
  label: string
  type: 'text' | 'password' | 'textarea'
  required: boolean
  placeholder?: string
  helpText?: string
}

export type LoadBalanceStrategy = 'round-robin' | 'fill-first' | 'failover'

export type Theme = 'light' | 'dark' | 'system'

import type {
  LegacyToolPromptConfig,
  ToolCallingConfig,
} from './toolCalling'
import type { AgentLoopConfig } from '../engine/loopConfig'

export type {
  LegacyToolPromptConfig,
  ToolCallingConfig,
}

export interface Account {
  id: string
  providerId: string
  name: string
  email?: string
  credentials: Record<string, string>
  status: AccountStatus
  lastUsed?: number
  createdAt: number
  updatedAt: number
  errorMessage?: string
  requestCount?: number
  dailyLimit?: number
  todayUsed?: number
}

export interface Provider {
  id: string
  name: string
  type: ProviderType
  authType: AuthType
  apiEndpoint: string
  chatPath?: string
  headers: Record<string, string>
  enabled: boolean
  createdAt: number
  updatedAt: number
  description?: string
  icon?: string
  supportedModels?: string[]
  modelMappings?: Record<string, string>
  status?: ProviderStatus
  lastStatusCheck?: number
}

export interface ModelMapping {
  requestModel: string
  actualModel: string
  preferredProviderId?: string
  preferredAccountId?: string
}

export interface ApiKey {
  id: string
  name: string
  key: string
  enabled: boolean
  createdAt: number
  lastUsedAt?: number
  usageCount: number
  description?: string
}

export interface AppConfig {
  proxyPort: number
  proxyHost: string
  loadBalanceStrategy: LoadBalanceStrategy
  modelMappings: Record<string, ModelMapping>
  theme: Theme
  autoStart: boolean
  autoStartProxy: boolean
  minimizeToTray: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  logRetentionDays: number
  requestLogConfig: RequestLogConfig
  requestTimeout: number
  retryCount: number
  /** Agent 引擎循环控制参数（此前为硬编码常量，现可配置） */
  agentLoop?: AgentLoopConfig
  /** 账号熔断（负载均衡）参数 */
  loadBalancer?: LoadBalancerConfig
  /** 工具运行参数（落盘策略、执行超时） */
  toolRuntime?: ToolRuntimeConfig
  /** 图片令牌预算 */
  imageBudget?: ImageBudgetConfig
  /** 记忆召回限制 */
  memory?: MemoryConfig
  /** 自动记忆提取（回合结束后台提炼） */
  autoMemory?: AutoMemoryConfig
  /** 子代理并发等 */
  subagent?: SubagentConfig
  /** 代理层运行参数（去重窗口、流队列、探测超时、轮询间隔） */
  proxyRuntime?: ProxyRuntimeConfig
  /** 日志与审计保留策略 */
  logRuntime?: LogRuntimeConfig
  apiKeys: ApiKey[]
  enableApiKey: boolean
  /** 当前生效的工具组 id（空数组 = 全局组，发送所有已启用的工具） */
  enabledToolGroups?: string[]
  oauthProxyMode: 'system' | 'none'
  sessionConfig: SessionConfig
  toolCallingConfig: ToolCallingConfig
  toolPromptConfig?: LegacyToolPromptConfig
  managementApi: ManagementApiConfig
  contextManagement?: unknown
  language: 'zh-CN' | 'en-US'
}

/**
 * 账号熔断（负载均衡）参数。
 *
 * 原先硬编码在 loadbalancer.ts 内，直接决定「账号失败几次被摘除、
 * 多久后重新参与调度」，属于影响请求走向的关键参数。
 * 全部可选：缺省时回落到默认值，行为与改造前一致。
 */
export interface LoadBalancerConfig {
  /** 连续失败达到该次数即把账号移出候选池；默认 3 */
  failThreshold?: number
  /** 账号被摘除后，经过多久重新参与调度（毫秒）；默认 60000 */
  recoveryTimeMs?: number
}

export const DEFAULT_LOAD_BALANCER_CONFIG: Required<LoadBalancerConfig> = {
  failThreshold: 3,
  recoveryTimeMs: 60000,
}

/** 工具运行参数（落盘策略与执行超时） */
export interface ToolRuntimeConfig {
  /** 单个工具输出超过多少字符触发落盘；默认 50000 */
  maxResultSizeChars?: number
  /** 落盘后给模型看的预览字节数；默认 2000 */
  previewSizeBytes?: number
  /** 单条消息内多个工具结果的聚合上限；默认 200000 */
  maxResultsPerMessageChars?: number
  /** 单个工具执行超时（毫秒）；默认 600000 */
  toolTimeoutMs?: number
}

export const DEFAULT_TOOL_RUNTIME_CONFIG: Required<ToolRuntimeConfig> = {
  maxResultSizeChars: 50000,
  previewSizeBytes: 2000,
  maxResultsPerMessageChars: 200000,
  toolTimeoutMs: 600000,
}

/** 记忆召回限制：决定每轮把哪些记忆、多少内容注入给模型 */
export interface MemoryConfig {
  /** 单轮最多召回几条；默认 5 */
  maxMemoriesPerTurn?: number
  /** 单个记忆最多读取行数；默认 200 */
  maxLinesPerMemory?: number
  /** 单个记忆最多注入字节数；默认 4096 */
  maxBytesPerMemory?: number
  /** 参与打分的候选文件上限；默认 200 */
  maxScanFiles?: number
  /** 低于该分数视为不相关；默认 1 */
  minRelevanceScore?: number
}

export const DEFAULT_MEMORY_CONFIG: Required<MemoryConfig> = {
  maxMemoriesPerTurn: 5,
  maxLinesPerMemory: 200,
  maxBytesPerMemory: 4096,
  maxScanFiles: 200,
  minRelevanceScore: 1,
}

/**
 * 自动记忆提取。
 *
 * 回合结束后判断这轮对话是否值得记，值得才调模型提炼并落盘。
 * **默认关闭**：它会在每轮额外消耗一次模型调用，必须由用户显式开启。
 */
export interface AutoMemoryConfig {
  /** 是否启用 */
  enabled?: boolean
  /** 单次提取的输入字符上限（控制成本）；默认 8000 */
  maxInputChars?: number
}

export const DEFAULT_AUTO_MEMORY_CONFIG: Required<AutoMemoryConfig> = {
  enabled: false,
  maxInputChars: 8000,
}

/**
 * 图片预算。
 *
 * base64 图片会**永久驻留对话历史**且无法被摘要压缩
 * （摘要是把消息换成文字描述；图片一旦进历史只能保留或整条丢弃）。
 * 几张截图就能堆出几十万 token，远超文本消息。
 *
 * 此前 `MessageLoopDeps.imageBudget` 只在类型里声明、从未向下传递。
 */
export interface ImageBudgetConfig {
  /** 历史图片（最近 N 轮之外）的合计 token 阈值；0 = 不限制。默认 20000 */
  historyBase64TokenThreshold?: number
  /** 单条消息内图片的 token 上限；0 = 不限制。默认 8000 */
  maxImageTokensPerMessage?: number
  /** 最近多少条消息内的图片受保护，永不替换。默认 2 */
  keepRecentMessages?: number
}

export const DEFAULT_IMAGE_BUDGET_CONFIG: Required<ImageBudgetConfig> = {
  // 默认值刻意保守：宁可多留图（用户可能在追问），也不要过早丢图导致答非所问。
  // 想强制省上下文可调小，想要"图片永不删"设为 0。
  historyBase64TokenThreshold: 20000,
  maxImageTokensPerMessage: 8000,
  keepRecentMessages: 2,
}

/** 子代理相关参数 */
export interface SubagentConfig {
  /** 最大并发子代理数；默认 5 */
  maxConcurrentAgents?: number
  /** 生成「离开摘要」时纳入的最近消息条数；默认 30 */
  recentMessageWindow?: number
}

export const DEFAULT_SUBAGENT_CONFIG: Required<SubagentConfig> = {
  maxConcurrentAgents: 5,
  recentMessageWindow: 30,
}

/** 代理层运行参数 */
export interface ProxyRuntimeConfig {
  /** 请求去重时间窗口（毫秒）；默认 2000 */
  dedupWindowMs?: number
  /** 去重共享流缓冲上限（MB）；默认 10 */
  dedupMaxBufferMb?: number
  /** 流队列检测缓冲上限（字节）；默认 65536 */
  queueDetectorMaxBytes?: number
  /** 供应商探测超时（毫秒）；默认 15000 */
  checkTimeoutMs?: number
  /** 定时任务轮询间隔（毫秒）；默认 15000 */
  taskCheckIntervalMs?: number
}

export const DEFAULT_PROXY_RUNTIME_CONFIG: Required<ProxyRuntimeConfig> = {
  dedupWindowMs: 2000,
  dedupMaxBufferMb: 10,
  queueDetectorMaxBytes: 65536,
  checkTimeoutMs: 15000,
  taskCheckIntervalMs: 15000,
}

/** 日志与审计保留策略 */
export interface LogRuntimeConfig {
  /** 内存中保留的日志条数上限；默认 10000 */
  maxLogs?: number
  /** 日志文件保留天数；默认 7 */
  retentionDays?: number
  /** 审计日志缓冲条数；默认 100 */
  auditBufferSize?: number
  /** 审计日志落盘间隔（毫秒）；默认 10000 */
  auditFlushIntervalMs?: number
  /** 分片缓存条目上限；默认 200 */
  promptSectionCacheLimit?: number
}

export const DEFAULT_LOG_RUNTIME_CONFIG: Required<LogRuntimeConfig> = {
  maxLogs: 10000,
  retentionDays: 7,
  auditBufferSize: 100,
  auditFlushIntervalMs: 10000,
  promptSectionCacheLimit: 200,
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log category — 细分子系统
 */
export type LogCategory =
  | 'app'
  | 'proxy'
  | 'engine'
  | 'oauth'
  | 'cookie'
  | 'ipc'
  | 'api'
  | 'forward'
  | 'tool'
  | 'session'
  | 'config'
  | 'ui'
  | 'general'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  category: LogCategory
  subCategory?: string
  message: string
  accountId?: string
  providerId?: string
  requestId?: string
  data?: Record<string, unknown>
}

export interface LogCategoryConfig {
  level: LogLevel
  enabled: boolean
}

export interface LogCategoriesConfig {
  [key: string]: LogCategoryConfig
}

export const DEFAULT_LOG_CATEGORIES: LogCategoriesConfig = {
  app:     { level: 'info',  enabled: true },
  proxy:   { level: 'info',  enabled: true },
  engine:  { level: 'info',  enabled: true },
  oauth:   { level: 'info',  enabled: true },
  cookie:  { level: 'debug', enabled: true },
  ipc:     { level: 'info',  enabled: true },
  api:     { level: 'info',  enabled: true },
  forward: { level: 'info',  enabled: true },
  tool:    { level: 'info',  enabled: true },
  session: { level: 'info',  enabled: true },
  config:  { level: 'info',  enabled: true },
  ui:      { level: 'warn',  enabled: true },
  general: { level: 'info',  enabled: true },
}

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  app: '应用',
  proxy: '代理服务',
  engine: '引擎',
  oauth: 'OAuth 登录',
  cookie: 'Cookie 会话',
  ipc: 'IPC 通信',
  api: 'API 请求',
  forward: '请求转发',
  tool: '工具调用',
  session: '会话管理',
  config: '配置',
  ui: '界面',
  general: '通用',
}

export interface ProxyStatus {
  isRunning: boolean
  port: number
  host: string
  uptime: number
  connections: number
}

export interface ProxyStatistics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgLatency: number
  requestsPerMinute: number
  activeConnections: number
  modelUsage: Record<string, number>
  providerUsage: Record<string, number>
  accountUsage: Record<string, number>
}

export interface ProviderCheckResult {
  providerId: string
  status: ProviderStatus
  latency?: number
  error?: string
}

export interface OAuthResult {
  success: boolean
  providerId?: string
  providerType?: ProviderVendor
  credentials?: Record<string, string>
  account?: Account
  accountInfo?: {
    userId?: string
    email?: string
    name?: string
  }
  error?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
  validatedAt: number
  accountInfo?: {
    name?: string
    email?: string
    quota?: number
    used?: number
    expiresAt?: number
  }
}

export type PromptType = 'general' | 'tool-use' | 'agent' | 'translation' | 'search'

export interface SystemPrompt {
  id: string
  name: string
  description: string
  prompt: string
  type: PromptType
  isBuiltin: boolean
  emoji?: string
  groups?: string[]
  createdAt: number
  updatedAt: number
}

export interface SessionConfig {
  sessionTimeout: number
  maxMessagesPerSession: number
  deleteAfterTimeout: boolean
  maxSessionsPerAccount: number
}

export interface RequestLogConfig {
  enabled: boolean
  logToConsole: boolean
  maxEntries: number
  includeBodies: boolean
  maxBodyChars: number
  redactSensitiveData: boolean
}

export interface ManagementApiConfig {
  enableManagementApi: boolean
  managementApiSecret: string
  managementApiPort?: number
}

export interface ManagementApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ManagementApiError
}

export interface ManagementApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ManagementApiPaginationParams {
  page?: number
  limit?: number
}

export interface ManagementApiPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateProviderRequest {
  name: string
  type: ProviderType
  authType: AuthType
  apiEndpoint: string
  chatPath?: string
  headers?: Record<string, string>
  enabled?: boolean
  description?: string
  icon?: string
  supportedModels?: string[]
  modelMappings?: Record<string, string>
}

export interface UpdateProviderRequest {
  name?: string
  apiEndpoint?: string
  chatPath?: string
  headers?: Record<string, string>
  enabled?: boolean
  description?: string
  icon?: string
  supportedModels?: string[]
  modelMappings?: Record<string, string>
}

export interface ProviderStatusRequest {
  enabled: boolean
}

export interface CreateAccountRequest {
  providerId: string
  name: string
  email?: string
  credentials: Record<string, string>
  dailyLimit?: number
}

export interface UpdateAccountRequest {
  name?: string
  email?: string
  credentials?: Record<string, string>
  dailyLimit?: number
}

export interface CreateApiKeyRequest {
  name: string
  description?: string
}

export interface UpdateApiKeyRequest {
  name?: string
  description?: string
  enabled?: boolean
}

export interface CreateModelMappingRequest {
  requestModel: string
  actualModel: string
  preferredProviderId?: string
  preferredAccountId?: string
}

export interface UpdateModelMappingRequest {
  actualModel?: string
  preferredProviderId?: string
  preferredAccountId?: string
}

export interface ProxyStatusResponse {
  isRunning: boolean
  port: number
  host: string
  uptime: number
  connections: number
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  version: string
  uptime: number
  timestamp: number
  components?: {
    proxy: 'up' | 'down'
    database: 'up' | 'down'
    managementApi: 'up' | 'down'
  }
}

export interface StatisticsResponse {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgLatency: number
  requestsPerMinute: number
  activeConnections: number
  modelUsage: Record<string, number>
  providerUsage: Record<string, number>
  accountUsage: Record<string, number>
  dailyStats?: Record<string, {
    totalRequests: number
    successRequests: number
    failedRequests: number
  }>
}

export interface ConfigUpdateRequest {
  proxyPort?: number
  proxyHost?: string
  loadBalanceStrategy?: LoadBalanceStrategy
  theme?: Theme
  autoStart?: boolean
  autoStartProxy?: boolean
  minimizeToTray?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  logRetentionDays?: number
  requestLogConfig?: Partial<RequestLogConfig>
  requestTimeout?: number
  retryCount?: number
  loadBalancer?: LoadBalancerConfig
  toolRuntime?: ToolRuntimeConfig
  imageBudget?: ImageBudgetConfig
  memory?: MemoryConfig
  autoMemory?: AutoMemoryConfig
  subagent?: SubagentConfig
  proxyRuntime?: ProxyRuntimeConfig
  logRuntime?: LogRuntimeConfig
  enableApiKey?: boolean
  enabledToolGroups?: string[]
  oauthProxyMode?: 'system' | 'none'
  sessionConfig?: SessionConfig
  toolCallingConfig?: Partial<ToolCallingConfig>
  toolPromptConfig?: LegacyToolPromptConfig
  managementApi?: ManagementApiConfig
}

export interface EffectiveModel {
  displayName: string
  actualModelId: string
  isCustom: boolean
}

