/**
 * Credential Storage Module - Type Definitions
 * Defines core data structures for accounts, providers, and configuration
 */

import type { ProviderStatus } from '../../shared/types'
import type { LegacyToolPromptConfig, ToolCallingConfig } from '../../shared/toolCalling.ts'
import { DEFAULT_TOOL_CALLING_CONFIG } from '../../shared/toolCalling.ts'

/**
 * Account Status Enum
 */
export type AccountStatus = 'active' | 'inactive' | 'expired' | 'error'

/**
 * Provider Type Enum
 */
export type ProviderType = 'builtin' | 'custom'

/**
 * Authentication Type Enum
 * - oauth: OAuth authentication
 * - token: Simple Token authentication
 * - cookie: Cookie authentication
 * - userToken: User Token authentication (DeepSeek)
 * - refresh_token: Refresh token authentication (GLM)
 * - jwt: JWT/Refresh token authentication (Kimi)
 * - realUserID_token: realUserID+JWT authentication (MiniMax)
 * - tongyi_sso_ticket: Tongyi SSO ticket authentication (Qwen)
 */
export type AuthType = 
  | 'oauth' 
  | 'token' 
  | 'cookie' 
  | 'userToken' 
  | 'refresh_token' 
  | 'jwt' 
  | 'realUserID_token' 
  | 'tongyi_sso_ticket'

/**
 * Credential Field Configuration Interface
 * Defines credential fields required by provider
 */
export interface CredentialField {
  /** Field name */
  name: string
  /** Field label (display name) */
  label: string
  /** Field type */
  type: 'text' | 'password' | 'textarea'
  /** Whether required */
  required: boolean
  /** Placeholder text */
  placeholder?: string
  /** Help text */
  helpText?: string
}

/**
 * Built-in Provider Configuration Interface
 * Extends Provider interface, adds credential field configuration
 */
export interface BuiltinProviderConfig extends Omit<Provider, 'createdAt' | 'updatedAt'> {
  /** Credential field configuration */
  credentialFields: CredentialField[]
  /** Token check endpoint */
  tokenCheckEndpoint?: string
  /** Token check method */
  tokenCheckMethod?: 'GET' | 'POST'
  /** Models list API endpoint for dynamic model fetching */
  modelsApiEndpoint?: string
  /** Additional headers for models API request */
  modelsApiHeaders?: Record<string, string>
}

/**
 * Load Balance Strategy Enum
 */
export type LoadBalanceStrategy = 'round-robin' | 'fill-first' | 'failover' | 'weighted'

/**
 * Quota Type Enum
 */
export type QuotaType = 'token' | 'request' | 'times'

/**
 * Channel Group Interface
 */
export interface ChannelGroup {
  id: string
  name: string
  description?: string
  testModel?: string
  models?: string[]
  /** Base multiplier for cost calculation */
  multiplier?: number
  /** Group priority (lower = higher priority) */
  priority?: number
  /** Whether the group is enabled */
  enabled?: boolean
  createdAt: number
  updatedAt: number
}

/**
 * User Group Interface (for rate limiting and access control)
 */
export interface UserGroup {
  id: string
  name: string
  description?: string
  /** RPM limit */
  rpm?: number
  /** TPM limit */
  tpm?: number
  /** Daily request limit */
  dailyLimit?: number
  /** Model access whitelist (empty = all models) */
  allowedModels?: string[]
  /** Group priority */
  priority?: number
  /** Whether enabled */
  enabled?: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Announcement Interface
 */
export interface Announcement {
  id: string
  title: string
  content: string
  /** Markdown content */
  markdown?: string
  /** Whether enabled */
  enabled: boolean
  /** Priority for display ordering */
  priority?: number
  /** Start time for time-limited announcements */
  startTime?: number
  /** End time for time-limited announcements */
  endTime?: number
  createdAt: number
  updatedAt: number
}

/**
 * Theme Enum
 */
export type Theme = 'light' | 'dark' | 'system'

/**
 * Account Interface
 * Represents account configuration under a provider
 */
export interface Account {
  /** Account unique identifier */
  id: string
  /** Provider ID */
  providerId: string
  /** Account name */
  name: string
  /** Account email (optional) */
  email?: string
  /** Credential data (encrypted storage) */
  credentials: Record<string, string>
  /** Account status */
  status: AccountStatus
  /** Last used time (timestamp) */
  lastUsed?: number
  /** Created time (timestamp) */
  createdAt: number
  /** Updated time (timestamp) */
  updatedAt: number
  /** Error message (when status is error) */
  errorMessage?: string
  /** Request count */
  requestCount?: number
  /** Daily request limit */
  dailyLimit?: number
  /** Today used count */
  todayUsed?: number
  /** Group IDs this account belongs to */
  groupIds?: string[]
  /** Channel group ID */
  groupId?: string
  /** Test model for connection testing */
  testModel?: string
  /** Model list for this account */
  models?: string[]
  /** Whether this account is enabled */
  enabled?: boolean
  /** Whether to use this account for load balancing */
  usedInLoadBalance?: boolean
  /** Retry count on failure */
  retryCount?: number
  /** Weight for load balancing (1-100) */
  weight?: number
  /** Channel priority (lower = higher priority) */
  priority?: number
  /** Response timeout override (ms) */
  timeout?: number
  /** Model mappings for this account */
  modelMappings?: Record<string, string>
  /** Whether model mappings override global mappings */
  overrideModelMappings?: boolean
  /** Whether this account requires web session (Oasis-Token) */
  requireWebSession?: boolean
  /** Base URL override for this account */
  baseUrlOverride?: string
  /** Custom headers for this account */
  customHeaders?: Record<string, string>
}

/**
 * Provider Interface
 * Represents an API provider configuration
 */
export interface Provider {
  /** Provider unique identifier */
  id: string
  /** Provider name */
  name: string
  /** Provider type */
  type: ProviderType
  /** Authentication type */
  authType: AuthType
  /** API endpoint address */
  apiEndpoint: string
  /** Chat API path */
  chatPath?: string
  /** Default request headers */
  headers: Record<string, string>
  /** Whether enabled */
  enabled: boolean
  /** Created time (timestamp) */
  createdAt: number
  /** Updated time (timestamp) */
  updatedAt: number
  /** Provider description */
  description?: string
  /** Icon URL */
  icon?: string
  /** Supported model list */
  supportedModels?: string[]
  /** Model name mapping */
  modelMappings?: Record<string, string>
  /** Provider status */
  status?: ProviderStatus
  /** Last status check time */
  lastStatusCheck?: number
  /** Group IDs this provider belongs to */
  groupIds?: string[]
  /** Whether to test channel on creation */
  testModelOnCreate?: string
  /** Whether to auto-retry on failure */
  autoRetry?: boolean
  /** Retry count */
  retryCount?: number
  /** Retry delay (ms) */
  retryDelay?: number
  /** Request timeout override (ms) */
  timeout?: number
  /** Weight for load balancing (1-100) */
  weight?: number
  /** Base URL (for proxy settings) */
  baseUrl?: string
  /** Whether to use this provider for load balancing */
  usedInLoadBalance?: boolean
  /** Quota configuration */
  quota?: {
    /** Quota type */
    type: QuotaType
    /** Total quota value */
    total: number
    /** Used quota value */
    used: number
  }
  /** Custom API path templates */
  apiPaths?: {
    chat?: string
    completion?: string
    embedding?: string
    image?: string
    audio?: string
    models?: string
  }
  /** Request format: 'openai' | 'anthropic' | 'google' */
  requestFormat?: string
  /** Whether to stream by default */
  defaultStream?: boolean
  /** Credential fields configuration */
  credentialFields?: CredentialField[]
  /** Whether this is a custom provider (not built-in) */
  custom?: boolean
  /** Provider category */
  category?: string
  /** Provider tags */
  tags?: string[]
}

/**
 * Model Mapping Configuration
 * Maps request model to actual used model
 */
export interface ModelMapping {
  /** Request model name */
  requestModel: string
  /** Actual used model name */
  actualModel: string
  /** Preferred provider ID */
  preferredProviderId?: string
  /** Preferred account ID */
  preferredAccountId?: string
}

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  /** Whether rate limiting is enabled */
  enabled: boolean
  /** Requests per minute per user */
  rpm?: number
  /** Tokens per minute per user */
  tpm?: number
  /** Daily request limit per user */
  dailyLimit?: number
  /** Requests per minute per IP */
  ipRpm?: number
  /** Token limit per request */
  tokenLimit?: number
}

/**
 * Announcement Configuration
 */
export interface AnnouncementConfig {
  /** Whether announcements are enabled */
  enabled: boolean
  /** List of announcements */
  announcements: Announcement[]
}

/**
 * Quota Configuration
 */
export interface QuotaConfig {
  /** Whether quota tracking is enabled */
  enabled: boolean
  /** Default quota type */
  defaultType: QuotaType
  /** Default quota value */
  defaultValue: number
  /** Whether to deduct quota on failed requests */
  deductOnFailure: boolean
  /** Whether to allow quota top-up via redemption code */
  allowRedemption: boolean
}

/**
 * Billing Configuration
 */
export interface BillingConfig {
  /** Whether billing is enabled */
  enabled: boolean
  /** Currency symbol */
  currency: string
  /** Exchange rate to USD (1 unit = X USD) */
  exchangeRate: number
  /** Default price per 1K tokens (input) */
  defaultInputPrice: number
  /** Default price per 1K tokens (output) */
  defaultOutputPrice: number
  /** Model-specific pricing overrides */
  modelPricing: Record<string, { input: number; output: number }>
}

/**
 * Channel Group Configuration
 */
export interface ChannelGroupConfig {
  /** Whether channel groups are enabled */
  enabled: boolean
  /** List of channel groups */
  groups: ChannelGroup[]
}

/**
 * User Group Configuration
 */
export interface UserGroupConfig {
  /** Whether user groups are enabled */
  enabled: boolean
  /** List of user groups */
  groups: UserGroup[]
}

/**
 * Logging Configuration Extension
 */
export interface LoggingConfig {
  /** Whether access logs are enabled */
  accessLogEnabled: boolean
  /** Whether to log request body */
  logRequestBody: boolean
  /** Whether to log response body */
  logResponseBody: boolean
  /** Maximum log retention days */
  maxLogRetentionDays: number
  /** Whether to log to file */
  logToFile: boolean
  /** Log file path */
  logFilePath?: string
  /** Whether to enable debug logging for specific models */
  debugModels?: string[]
}

/**
 * Image Generation Configuration
 */
export interface ImageConfig {
  /** Whether image generation is enabled */
  enabled: boolean
  /** Default size */
  defaultSize: string
  /** Supported sizes */
  supportedSizes: string[]
  /** Default quality */
  defaultQuality?: string
  /** Default style */
  defaultStyle?: string
}

/**
 * Audio Configuration
 */
export interface AudioConfig {
  /** Whether audio API is enabled */
  enabled: boolean
  /** Supported input formats */
  inputFormats: string[]
  /** Supported output formats */
  outputFormats: string[]
}

/**
 * Rerank Configuration
 */
export interface RerankConfig {
  /** Whether rerank API is enabled */
  enabled: boolean
  /** Default top-k */
  defaultTopK: number
}

/**
 * Application Configuration Interface
 */
export interface AppConfig {
  /** Proxy service port */
  proxyPort: number
  /** Proxy service bind address */
  proxyHost: string
  /** Load balance strategy */
  loadBalanceStrategy: LoadBalanceStrategy
  /** Model mapping configuration */
  modelMappings: Record<string, ModelMapping>
  /** Default model mappings have been seeded into editable config */
  defaultModelMappingsSeeded?: boolean
  /** UI theme */
  theme: Theme
  /** Auto start on boot */
  autoStart: boolean
  /** Auto start proxy on launch */
  autoStartProxy: boolean
  /** Minimize to tray */
  minimizeToTray: boolean
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  /** Log retention days */
  logRetentionDays: number
  /** Request log persistence configuration */
  requestLogConfig: RequestLogConfig
  /** Request timeout (milliseconds) */
  requestTimeout: number
  /** Retry count */
  retryCount: number
  /** API Key list */
  apiKeys: ApiKey[]
  /** Whether to enable API Key authentication */
  enableApiKey: boolean
  /** OAuth proxy mode: 'system' uses system proxy, 'none' disables proxy */
  oauthProxyMode: 'system' | 'none'
  /** Session management configuration */
  sessionConfig: SessionConfig
  /** Tool calling configuration */
  toolCallingConfig: ToolCallingConfig
  /** Legacy migration input from pre-v2 tool prompt settings */
  toolPromptConfig?: LegacyToolPromptConfig
  /** Management API configuration */
  managementApi: ManagementApiConfig
  /** Context management configuration */
  contextManagement: ContextManagementConfig
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig
  /** Announcement configuration */
  announcementConfig: AnnouncementConfig
  /** Quota configuration */
  quotaConfig: QuotaConfig
  /** Billing configuration */
  billingConfig: BillingConfig
  /** Channel group configuration */
  channelGroupConfig: ChannelGroupConfig
  /** User group configuration */
  userGroupConfig: UserGroupConfig
  /** Logging configuration */
  loggingConfig: LoggingConfig
  /** Image generation configuration */
  imageConfig: ImageConfig
  /** Audio configuration */
  audioConfig: AudioConfig
  /** Rerank configuration */
  rerankConfig: RerankConfig
  /** 启用的工具插件列表（ID 列表），空数组表示使用默认值 */
  enabledPlugins: string[]
  /** 启用的工具分组列表，空数组表示使用所有工具 */
  enabledToolGroups: string[]
}

/**
 * Log Level Enum
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Session Status Enum
 */
export type SessionStatus = 'active' | 'expired' | 'deleted'

/**
 * Sliding Window Configuration Interface
 * Controls message count-based context trimming
 */
export interface SlidingWindowConfig {
  /** Whether sliding window strategy is enabled */
  enabled: boolean
  /** Maximum number of messages to keep */
  maxMessages: number
}

/**
 * Token Limit Configuration Interface
 * Controls token count-based context trimming
 */
export interface TokenLimitConfig {
  /** Whether token limit strategy is enabled */
  enabled: boolean
  /** Maximum number of tokens to keep */
  maxTokens: number
}

/**
 * Summary Configuration Interface
 * Controls context summarization strategy
 */
export interface SummaryConfig {
  /** Whether summary strategy is enabled */
  enabled: boolean
  /** Number of recent messages to keep after summarization */
  keepRecentMessages: number
  /** Custom summary prompt template (optional) */
  summaryPrompt?: string
}

/**
 * Context Management Configuration Interface
 * Controls how conversation context is managed and trimmed
 */
export interface ContextManagementConfig {
  /** Whether context management is enabled */
  enabled: boolean
  /** Strategy configurations */
  strategies: {
    slidingWindow: SlidingWindowConfig
    tokenLimit: TokenLimitConfig
    summary: SummaryConfig
  }
  /** Execution order of strategies */
  executionOrder: ('slidingWindow' | 'tokenLimit' | 'summary')[]
}

/**
 * Chat Message Interface
 * Represents a single message in a conversation
 */
export interface ChatMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system' | 'tool'
  /** Message content */
  content: string | any[]
  /** Timestamp */
  timestamp: number
  /** Provider-specific message ID */
  providerMessageId?: string
  /** Tool call ID (for tool messages) */
  toolCallId?: string
}

/**
 * Session Record Interface
 * Represents a conversation session
 */
export interface SessionRecord {
  /** Session unique identifier */
  id: string
  /** Provider ID */
  providerId: string
  /** Account ID */
  accountId: string
  /** Session type */
  sessionType: 'chat' | 'agent'
  /** Message history */
  messages: ChatMessage[]
  /** Creation time (timestamp) */
  createdAt: number
  /** Last active time (timestamp) */
  lastActiveAt: number
  /** Session status */
  status: SessionStatus
  /** Model used */
  model?: string
  /** Session metadata */
  metadata?: {
    title?: string
    tokenCount?: number
  }
}

/**
 * Session Configuration Interface
 * Global session management settings
 */
export interface SessionConfig {
  /** Session timeout (minutes), default 30 */
  sessionTimeout: number
  /** Max messages per session, default 50 */
  maxMessagesPerSession: number
  /** Delete session after timeout */
  deleteAfterTimeout: boolean
  /** Max active sessions per account, default 3 */
  maxSessionsPerAccount: number
}

export type { LegacyToolPromptConfig, ToolCallingConfig }

/**
 * Management API Configuration Interface
 * Controls the management API server settings
 */
export interface ManagementApiConfig {
  /** Whether to enable the management API */
  enableManagementApi: boolean
  /** Secret key for management API authentication */
  managementApiSecret: string
  /** Management API port (optional, defaults to proxyPort) */
  managementApiPort?: number
}

/**
 * API Key Interface
 */
export interface ApiKey {
  /** API Key ID */
  id: string
  /** API Key name */
  name: string
  /** API Key value */
  key: string
  /** Whether enabled */
  enabled: boolean
  /** Created time */
  createdAt: number
  /** Last used time */
  lastUsedAt?: number
  /** Usage count */
  usageCount: number
  /** Description */
  description?: string
}

/**
 * Log Entry Interface
 */
export interface LogEntry {
  /** Log ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Log level */
  level: LogLevel
  /** Log message */
  message: string
  /** Related account ID */
  accountId?: string
  /** Related provider ID */
  providerId?: string
  /** Request ID */
  requestId?: string
  /** Extra data */
  data?: Record<string, unknown>
}

/**
 * Request Log Entry Interface
 * Detailed log for API request tracking
 */
export interface RequestLogEntry {
  /** Log ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Request status */
  status: 'success' | 'error'
  /** HTTP status code */
  statusCode: number

  /** HTTP method */
  method: string
  /** Request URL path */
  url: string
  /** Requested model name */
  model: string
  /** Actual model used (after mapping) */
  actualModel?: string

  /** Provider ID */
  providerId?: string
  /** Provider name */
  providerName?: string
  /** Account ID */
  accountId?: string
  /** Account name */
  accountName?: string

  /** Request body JSON string */
  requestBody?: string
  /** User input extracted from messages (truncated to 200 chars) */
  userInput?: string

  /** Web search enabled */
  webSearch?: boolean
  /** Reasoning effort level */
  reasoningEffort?: 'low' | 'medium' | 'high'

  /** Response status code */
  responseStatus: number
  /** Response preview (truncated) */
  responsePreview?: string
  /** Response body JSON string */
  responseBody?: string

  /** Request latency in milliseconds */
  latency: number
  /** Whether streaming request */
  isStream: boolean

  /** Error message */
  errorMessage?: string
  /** Error stack trace */
  errorStack?: string

  // ── 聊天流水线追踪字段 ──

  /** 用户在聊天窗口输入的原始文本 */
  chatUserInput?: string
  /** Engine 层接收到的文本（可能经过命令处理等变换） */
  chatEngineInput?: string
  /** Engine 实际请求的 URL（通常是 http://127.0.0.1:8080/v1/chat/completions） */
  chatEngineUrl?: string
  /** Engine 层使�的 provider 类型 (openai / anthropic / custom) */
  chatEngineProvider?: string
  /** Engine 层使用的 model */
  chatEngineModel?: string
  /** 代理层选中的 providerId */
  chatProxyProviderId?: string
  /** 代理层选中的 providerName */
  chatProxyProviderName?: string
  /** 代理层选中的 accountId */
  chatProxyAccountId?: string
  /** 代理层选中的 accountName */
  chatProxyAccountName?: string
  /** 代理层实际映射的 model */
  chatProxyActualModel?: string
  /** 上游 API 地址 */
  chatUpstreamUrl?: string
  /** 上游响应的状态码 */
  chatUpstreamStatus?: number
  /** 是否流式响应 */
  chatUpstreamIsStream?: boolean
  /** 响应摘要（非流式时完整 body，流式时前 500 字符） */
  chatUpstreamResponsePreview?: string
  /** 代理处理耗时 (ms)，不含网络传输 */
  chatProxyProcessLatency?: number
  /** 备注/处理摘要 */
  chatNotes?: string
}

export interface RequestLogConfig {
  /** Whether detailed request logs are persisted */
  enabled: boolean
  /** Whether request/response is logged to console */
  logToConsole: boolean
  /** Maximum persisted request log entries */
  maxEntries: number
  /** Whether request and response bodies are stored */
  includeBodies: boolean
  /** Maximum characters persisted for each body field */
  maxBodyChars: number
  /** Whether obvious sensitive values are redacted */
  redactSensitiveData: boolean
}

/**
 * Daily Statistics Interface
 * Statistics for a single day
 */
export interface DailyStatistics {
  /** Date string (YYYY-MM-DD) */
  date: string
  /** Total requests */
  totalRequests: number
  /** Successful requests */
  successRequests: number
  /** Failed requests */
  failedRequests: number
  /** Total latency (for average calculation) */
  totalLatency: number
  /** Model usage count */
  modelUsage: Record<string, number>
  /** Provider usage count */
  providerUsage: Record<string, number>
}

/**
 * Persistent Statistics Interface
 * Statistics that persist across app restarts
 */
export interface PersistentStatistics {
  /** Total requests (all time) */
  totalRequests: number
  /** Successful requests (all time) */
  successRequests: number
  /** Failed requests (all time) */
  failedRequests: number
  /** Total latency for average calculation */
  totalLatency: number
  /** Last updated timestamp */
  lastUpdated: number
  /** Model usage count */
  modelUsage: Record<string, number>
  /** Provider usage count */
  providerUsage: Record<string, number>
  /** Account usage count */
  accountUsage: Record<string, number>
  /** Daily statistics (keyed by date string) */
  dailyStats: Record<string, DailyStatistics>
}

/**
 * System Prompt Type Enum
 */
export type PromptType = 'general' | 'tool-use' | 'agent' | 'translation' | 'search'

/**
 * System Prompt Interface
 */
export interface SystemPrompt {
  /** Unique identifier */
  id: string
  /** Prompt name */
  name: string
  /** Prompt description */
  description: string
  /** Prompt content */
  prompt: string
  /** Prompt type */
  type: PromptType
  /** Whether built-in (built-in prompts cannot be edited/deleted) */
  isBuiltin: boolean
  /** Emoji icon */
  emoji?: string
  /** Group tags */
  groups?: string[]
  /** Creation time */
  createdAt: number
  /** Update time */
  updatedAt: number
}

/**
 * Credential Validation Result Interface
 */
export interface ValidationResult {
  /** Whether valid */
  valid: boolean
  /** Error message */
  error?: string
  /** Validation time */
  validatedAt: number
  /** Account info (returned when validation succeeds) */
  accountInfo?: {
    name?: string
    email?: string
    quota?: number
    used?: number
    expiresAt?: number
  }
}

/**
 * Custom Model Configuration
 * User-defined model with display name and actual API model ID
 */
export interface CustomModel {
  /** Model display name (used in AI client) */
  displayName: string
  /** Actual model ID (used in API call) */
  actualModelId: string
}

/**
 * User Model Overrides for a Provider
 * Stores user customizations to built-in provider models
 */
export interface ProviderModelOverrides {
  /** User added custom models */
  addedModels: CustomModel[]
  /** Excluded default model display names */
  excludedModels: string[]
}

/**
 * User Model Overrides
 * Maps provider IDs to their model customizations
 */
export type UserModelOverrides = Record<string, ProviderModelOverrides>

export const DEEPSEEK_PRIMARY_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro']

export const DEEPSEEK_LEGACY_MODEL_MAPPING_NAMES = [
  'deepseek-chat',
  'deepseek-reasoner',
  'DeepSeek-V3.2',
  'DeepSeek-Search',
  'DeepSeek-R1',
  'DeepSeek-R1-Search',
]

/**
 * Effective Model Information
 * Combined model info after merging defaults with user overrides
 */
export interface EffectiveModel {
  /** Model display name (used in AI client) */
  displayName: string
  /** Actual model ID (used in API call) */
  actualModelId: string
  /** Whether this is a user-added custom model */
  isCustom: boolean
}

/**
 * Storage Data Structure Interface
 */
export interface StoreSchema {
  /** Provider list */
  providers: Provider[]
  /** Account list */
  accounts: Account[]
  /** Application configuration */
  config: AppConfig
  /** Log entries */
  logs: LogEntry[]
  /** Request log entries */
  requestLogs: RequestLogEntry[]
  /** System prompts */
  systemPrompts: SystemPrompt[]
  /** Session records */
  sessions: SessionRecord[]
  /** Persistent statistics */
  statistics: PersistentStatistics
  /** User model overrides for built-in providers */
  userModelOverrides: UserModelOverrides
}

/**
 * Default Session Configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  sessionTimeout: 30,
  maxMessagesPerSession: 50,
  deleteAfterTimeout: false,
  maxSessionsPerAccount: 3,
}

/**
 * Default Persistent Statistics
 */
export const DEFAULT_STATISTICS: PersistentStatistics = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  lastUpdated: Date.now(),
  modelUsage: {},
  providerUsage: {},
  accountUsage: {},
  dailyStats: {},
}

/**
 * Default User Model Overrides
 */
export const DEFAULT_USER_MODEL_OVERRIDES: UserModelOverrides = {}

export const DEFAULT_TOOL_CALLING_CONFIG_VALUE = DEFAULT_TOOL_CALLING_CONFIG

/**
 * Default Management API Configuration
 */
export const DEFAULT_MANAGEMENT_API_CONFIG: ManagementApiConfig = {
  enableManagementApi: false,
  managementApiSecret: '',
}

/**
 * Default Context Management Configuration
 */
export const DEFAULT_CONTEXT_MANAGEMENT_CONFIG: ContextManagementConfig = {
  enabled: false,
  strategies: {
    slidingWindow: { enabled: true, maxMessages: 20 },
    tokenLimit: { enabled: false, maxTokens: 4000 },
    summary: { enabled: false, keepRecentMessages: 20 },
  },
  executionOrder: ['slidingWindow', 'tokenLimit', 'summary'],
}

export const DEFAULT_REQUEST_LOG_CONFIG: RequestLogConfig = {
  enabled: true,
  logToConsole: false,
  maxEntries: 200,
  includeBodies: true,
  maxBodyChars: 8000,
  redactSensitiveData: true,
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: false,
  rpm: 60,
  tpm: 100000,
  dailyLimit: 1000,
  ipRpm: 120,
  tokenLimit: 128000,
}

export const DEFAULT_ANNOUNCEMENT_CONFIG: AnnouncementConfig = {
  enabled: false,
  announcements: [],
}

export const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  enabled: false,
  defaultType: 'token',
  defaultValue: 1000000,
  deductOnFailure: false,
  allowRedemption: true,
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  enabled: false,
  currency: 'USD',
  exchangeRate: 1,
  defaultInputPrice: 0.001,
  defaultOutputPrice: 0.002,
  modelPricing: {},
}

export const DEFAULT_CHANNEL_GROUP_CONFIG: ChannelGroupConfig = {
  enabled: false,
  groups: [],
}

export const DEFAULT_USER_GROUP_CONFIG: UserGroupConfig = {
  enabled: false,
  groups: [],
}

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  accessLogEnabled: true,
  logRequestBody: false,
  logResponseBody: false,
  maxLogRetentionDays: 7,
  logToFile: true,
  logFilePath: '',
  debugModels: [],
}

export const DEFAULT_IMAGE_CONFIG: ImageConfig = {
  enabled: true,
  defaultSize: '1024x1024',
  supportedSizes: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
  defaultQuality: 'standard',
  defaultStyle: 'vivid',
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  inputFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'],
  outputFormats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
}

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  enabled: true,
  defaultTopK: 10,
}

export const DEFAULT_DEEPSEEK_MODEL_MAPPINGS: Record<string, ModelMapping> = {
  'deepseek-v4-flash-think': {
    requestModel: 'deepseek-v4-flash-think',
    actualModel: 'deepseek-v4-flash',
    preferredProviderId: 'deepseek',
  },
  'deepseek-v4-flash-search': {
    requestModel: 'deepseek-v4-flash-search',
    actualModel: 'deepseek-v4-flash',
    preferredProviderId: 'deepseek',
  },
  'deepseek-v4-flash-think-search': {
    requestModel: 'deepseek-v4-flash-think-search',
    actualModel: 'deepseek-v4-flash',
    preferredProviderId: 'deepseek',
  },
  'deepseek-v4-pro-think': {
    requestModel: 'deepseek-v4-pro-think',
    actualModel: 'deepseek-v4-pro',
    preferredProviderId: 'deepseek',
  },
  'deepseek-v4-pro-search': {
    requestModel: 'deepseek-v4-pro-search',
    actualModel: 'deepseek-v4-pro',
    preferredProviderId: 'deepseek',
  },
  'deepseek-v4-pro-think-search': {
    requestModel: 'deepseek-v4-pro-think-search',
    actualModel: 'deepseek-v4-pro',
    preferredProviderId: 'deepseek',
  },
}

export const DEFAULT_STEPFUN_MODEL_MAPPINGS: Record<string, ModelMapping> = {
  'gpt-4o': {
    requestModel: 'gpt-4o',
    actualModel: 'step-3.7-flash',
    preferredProviderId: 'stepfun',
  },
  'gpt-4o-mini': {
    requestModel: 'gpt-4o-mini',
    actualModel: 'step-3.7-flash',
    preferredProviderId: 'stepfun',
  },
  'claude-sonnet-4-20250514': {
    requestModel: 'claude-sonnet-4-20250514',
    actualModel: 'step-3.7-flash',
    preferredProviderId: 'stepfun',
  },
  'claude-3-5-haiku-20241022': {
    requestModel: 'claude-3-5-haiku-20241022',
    actualModel: 'step-3.7-flash',
    preferredProviderId: 'stepfun',
  },
}

export function createDefaultModelMappings(): Record<string, ModelMapping> {
  return Object.fromEntries([
    ...Object.entries(DEFAULT_DEEPSEEK_MODEL_MAPPINGS).map(([key, mapping]) => [key, { ...mapping }]),
    ...Object.entries(DEFAULT_STEPFUN_MODEL_MAPPINGS).map(([key, mapping]) => [key, { ...mapping }]),
  ])
}

export function isDefaultModelMapping(requestModel: string): boolean {
  return requestModel in DEFAULT_DEEPSEEK_MODEL_MAPPINGS || requestModel in DEFAULT_STEPFUN_MODEL_MAPPINGS
}

export function normalizeModelMappingsWithDefaults(
  mappings?: Record<string, ModelMapping>
): Record<string, ModelMapping> {
  const legacyModelNames = new Set(DEEPSEEK_LEGACY_MODEL_MAPPING_NAMES)
  const customMappings = Object.fromEntries(
    Object.entries(mappings || {}).filter(([requestModel]) =>
      !isDefaultModelMapping(requestModel) && !legacyModelNames.has(requestModel)
    ),
  )

  return {
    ...createDefaultModelMappings(),
    ...customMappings,
  }
}

export function sanitizeDeepSeekModelOverrides(
  overrides?: ProviderModelOverrides
): ProviderModelOverrides {
  const migratedModelNames = new Set([
    ...DEEPSEEK_PRIMARY_MODELS,
    ...DEEPSEEK_LEGACY_MODEL_MAPPING_NAMES,
    ...Object.keys(DEFAULT_DEEPSEEK_MODEL_MAPPINGS),
  ])

  return {
    addedModels: (overrides?.addedModels || []).filter(model =>
      !migratedModelNames.has(model.displayName)
    ),
    excludedModels: (overrides?.excludedModels || []).filter(model =>
      DEEPSEEK_PRIMARY_MODELS.includes(model)
    ),
  }
}

/**
 * Default Application Configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  proxyPort: 8080,
  proxyHost: '127.0.0.1',
  loadBalanceStrategy: 'round-robin',
  modelMappings: createDefaultModelMappings(),
  defaultModelMappingsSeeded: true,
  theme: 'system',
  autoStart: false,
  autoStartProxy: true,
  minimizeToTray: true,
  logLevel: 'info',
  logRetentionDays: 7,
  requestLogConfig: DEFAULT_REQUEST_LOG_CONFIG,
  requestTimeout: 60000,
  retryCount: 3,
  apiKeys: [],
  enableApiKey: false,
  oauthProxyMode: 'system',
  sessionConfig: DEFAULT_SESSION_CONFIG,
  toolCallingConfig: DEFAULT_TOOL_CALLING_CONFIG,
  toolPromptConfig: undefined,
  managementApi: DEFAULT_MANAGEMENT_API_CONFIG,
  contextManagement: DEFAULT_CONTEXT_MANAGEMENT_CONFIG,
  rateLimit: DEFAULT_RATE_LIMIT_CONFIG,
  announcementConfig: DEFAULT_ANNOUNCEMENT_CONFIG,
  quotaConfig: DEFAULT_QUOTA_CONFIG,
  billingConfig: DEFAULT_BILLING_CONFIG,
  channelGroupConfig: DEFAULT_CHANNEL_GROUP_CONFIG,
  userGroupConfig: DEFAULT_USER_GROUP_CONFIG,
  loggingConfig: DEFAULT_LOGGING_CONFIG,
  imageConfig: DEFAULT_IMAGE_CONFIG,
  audioConfig: DEFAULT_AUDIO_CONFIG,
  rerankConfig: DEFAULT_RERANK_CONFIG,
  enabledPlugins: ['read_file', 'write_file', 'edit', 'bash', 'glob', 'grep', 'web_search', 'web_fetch', 'git'],
  enabledToolGroups: [],
}

/**
 * Built-in Provider Configuration
 * Re-exported from providers/builtin/index.ts to avoid duplication
 */
export { builtinProviders as BUILTIN_PROVIDERS } from '../providers/builtin/index.ts'
