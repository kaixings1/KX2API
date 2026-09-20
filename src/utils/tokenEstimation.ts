/**
 * utils/tokenEstimation.ts — token 估算纯函数（移植自 D:\src\services\tokenEstimation.ts）
 *
 * 只保留不依赖任何外部 service（Anthropic/Bedrock SDK、provider 配置）的纯函数部分：
 * - roughTokenCountEstimation      按 bytes-per-token 粗略估算
 * - bytesPerTokenForFileType      按文件类型返回字节/令牌比
 * - roughTokenCountEstimationForFileType   已知文件类型时的估算
 * - roughTokenCountEstimationForBlock / Content / Messages  结构化块级估算
 *
 * API 级精确计费（countTokensWithAPI / countTokensWithBedrock / countTokensViaHaikuFallback）
 * 依赖 KX2API 不匹配的 provider 基础设施，不在此移植。
 */

/** 消息内容块的内部形状（无外部依赖的宽类型）。 */
export interface TextBlock {
  type: string
  text?: string
  name?: string
  thinking?: string
  data?: string
  input?: unknown
  content?: unknown
  [key: string]: unknown
}

/** 消息条目的宽类型（用于 messages 级估算）。 */
export interface EstimationMessage {
  type: string
  message?: { content?: unknown }
  attachment?: unknown
}

/**
 * 粗略估算 token 数：文本长度 / bytesPerToken（默认 4）。
 * 等价于上游 roughTokenCountEstimation。
 */
export function roughTokenCountEstimation(
  content: string,
  bytesPerToken: number = 4,
): number {
  return Math.round(content.length / bytesPerToken)
}

/**
 * 返回给定文件扩展名对应的字节/Token 比。
 * Dense JSON 充满单字符 token（`{` `}` `:` `,` `"`），真实比率接近 2 而非默认 4。
 */
export function bytesPerTokenForFileType(fileExtension: string): number {
  switch (fileExtension) {
    case 'json':
    case 'jsonl':
    case 'jsonc':
      return 2
    default:
      return 4
  }
}

/**
 * 已知文件类型下的更精确估算。当 API 计费不可用时（例如 Bedrock）回落至此，
 * 低估可能让超大工具结果混入对话——此函数正是为此而存在。
 */
export function roughTokenCountEstimationForFileType(
  content: string,
  fileExtension: string,
): number {
  return roughTokenCountEstimation(
    content,
    bytesPerTokenForFileType(fileExtension),
  )
}

/** 对字符串或块内容做估算（递归处理数组）。 */
function roughTokenCountEstimationForContent(
  content: unknown,
): number {
  if (!content) {
    return 0
  }
  if (typeof content === 'string') {
    return roughTokenCountEstimation(content)
  }
  if (!Array.isArray(content)) {
    return 0
  }
  let totalTokens = 0
  for (const block of content) {
    totalTokens += roughTokenCountEstimationForBlock(block)
  }
  return totalTokens
}

/** 对单个 content block 做估算。 */
function roughTokenCountEstimationForBlock(
  block: unknown,
): number {
  if (typeof block === 'string') {
    return roughTokenCountEstimation(block)
  }
  if (typeof block !== 'object' || block === null) {
    return 0
  }
  const b = block as TextBlock
  const type = b.type
  if (type === 'text') {
    return roughTokenCountEstimation(typeof b.text === 'string' ? b.text : '')
  }
  if (type === 'image' || type === 'document') {
    // token = (width*height)/750；图片最大 2000x2000≈5333 tokens。
    // 用保守估计避免低估而触发过早压缩。document 是 base64 PDF（source.data），
    // 绝不能让 jsonStringify 兜底 —— 1MB PDF≈1.33M base64 字符 ≈ 32.5 万估算 token，
    // 而 API 实际只收 ~2000。与此处 microCompact 的 IMAGE_MAX_TOKEN_SIZE 常量对齐。
    return 2000
  }
  if (type === 'tool_result') {
    return roughTokenCountEstimationForContent(b.content)
  }
  if (type === 'tool_use') {
    // input 是模型生成的 JSON——任意大（bash 命令、Edit diff、文件内容）。
    // 序列化一次取字符数即可，API 反正会重新序列化。
    return roughTokenCountEstimation(
      (typeof b.name === 'string' ? b.name : '') + safeStringify(b.input),
    )
  }
  if (type === 'thinking') {
    return roughTokenCountEstimation(b.thinking ?? '')
  }
  if (type === 'redacted_thinking') {
    return roughTokenCountEstimation(typeof b.data === 'string' ? b.data : '')
  }
  // server_tool_use / web_search_tool_result / mcp_tool_use 等——
  // 文本式 payload（工具输入、搜索结果，无 base64）。
  return roughTokenCountEstimation(safeStringify(b))
}

/** 对消息数组做粗略 token 估算。 */
export function roughTokenCountEstimationForMessages(
  messages: readonly EstimationMessage[],
): number {
  let totalTokens = 0
  for (const message of messages) {
    totalTokens += roughTokenCountEstimationForMessage(message)
  }
  return totalTokens
}

/** 对单条消息做粗略 token 估算。 */
export function roughTokenCountEstimationForMessage(
  message: EstimationMessage,
): number {
  if (
    (message.type === 'assistant' || message.type === 'user') &&
    message.message?.content
  ) {
    return roughTokenCountEstimationForContent(message.message.content)
  }
  // attachment 无 K 侧归一化实现，回到 0（避免低估时不会误触发压缩）。
  return 0
}

/** 安全的 JSON 字符串化（圆形引用→'{}'，Symbol/BigInt 容错）。 */
export function safeStringify(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}