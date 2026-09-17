/**
 * engine/imageBudget.ts — 图片令牌预算
 *
 * 解决的真实问题：**base64 图片会永久驻留在对话历史里**。
 * 一张 1MB 的截图经 base64 编码后约 1.37MB 文本，按主流厂商口径
 * 折合约 1000-1600 token；而用户贴几张图聊几轮，历史里就堆了几十万 token ——
 * 远超文本消息，且**图片不像文本那样能被摘要压缩**（摘要是把消息换成文字描述，
 * 图片本身一旦进历史就只能整条丢弃或保留）。
 *
 * 本模块在**发请求前**处理历史图片：
 * - 超过阈值的老图片替换为占位文本（模型知道这里曾有图，但不再占用视觉 token）
 * - 单条消息内的图片总量超限时同样处理
 * - **最近一轮的图片永远保留** —— 用户刚发的图正在被讨论，替换掉等于答非所问
 *
 * 设计取舍：
 * - 纯函数、不改入参：返回新数组，便于在 RequestBuilder 里无副作用地串联。
 * - 只认已知的图片形态；不认识的块原样保留（宁可多占 token，不要误删内容）。
 * - 替换是**幂等**的：已替换过的占位文本再次处理不会被重复替换。
 */

/** 图片占位文本：让模型知道此处曾有图，但不再消耗视觉 token */
export const IMAGE_ELIDED_PLACEHOLDER =
  '[图片已移除以节省上下文：该图较早前发送，如需重新查看请用户再发一次]'

/** 单张图片折算的 token 估算（保守值，与 Anthropic 的 (w×h)/750 同量级） */
export const TOKENS_PER_IMAGE_ESTIMATE = 1600

/** 中文语境下 base64 文本的 token 密度：约 2.5 字符/token */
const CHARS_PER_TOKEN_BASE64 = 2.5

export interface ImageBudgetOptions {
  /**
   * 历史中 base64 图片的 token 阈值。
   * 所有「非最后一轮」的图片合计超过它时，从**最旧的开始**替换为占位文本。
   * 0 或未给表示不限制。
   */
  historyBase64TokenThreshold?: number
  /**
   * 单条消息内图片的 token 上限。
   * 单条超限时，保留该条**最后**若干张图（用户最后发的更可能相关）。
   * 0 或未给表示不限制。
   */
  maxImageTokensPerMessage?: number
  /**
   * 最近多少条消息内的图片永不替换。
   * 默认 2（对应"最后一轮 user + 上一条 assistant"），保证正在讨论的图不被丢。
   */
  keepRecentMessages?: number
}

export interface ImageBudgetResult<T> {
  messages: T[]
  /** 被替换掉的图片数量（诊断/日志用） */
  elidedImages: number
  /** 被替换掉的图片估算 token 总量 */
  elidedTokens: number
}

/** 判断内容块是否为图片（覆盖 OpenAI / Anthropic / 通用 data-URL 三种形态） */
export function isImageBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  const b = block as Record<string, unknown>

  // OpenAI: { type: 'image_url', image_url: { url } }
  if (b.type === 'image_url') return true
  // Anthropic: { type: 'image', source: { type: 'base64', data } }
  if (b.type === 'image' && b.source && typeof b.source === 'object') return true
  // 通用：{ type: 'image', data / base64 }
  if (b.type === 'image') return true
  return false
}

/** 估算单个图片块的 token 占用 */
export function estimateImageTokens(block: unknown): number {
  if (!block || typeof block !== 'object') return 0
  const b = block as Record<string, unknown>

  // 优先按 base64 文本长度算（更贴近实际传输量）
  let payload = ''
  const imageUrl = b.image_url as { url?: string } | undefined
  if (imageUrl && typeof imageUrl.url === 'string') payload = imageUrl.url
  else {
    const source = b.source as { data?: string } | undefined
    if (source && typeof source.data === 'string') payload = source.data
    else if (typeof b.data === 'string') payload = b.data
  }

  if (payload) {
    // data URL 前缀不算 token
    const comma = payload.indexOf(',')
    const body = comma >= 0 ? payload.slice(comma + 1) : payload
    return Math.ceil(body.length / CHARS_PER_TOKEN_BASE64)
  }
  // 只有 URL（无内联数据）时按一张图的固定估算
  return TOKENS_PER_IMAGE_ESTIMATE
}

/** 是否为已替换过的占位块（幂等保护） */
function isPlaceholderBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  const b = block as Record<string, unknown>
  return (
    b.type === 'text' &&
    typeof b.text === 'string' &&
    b.text.includes('图片已移除')
  )
}

/**
 * 按预算裁掉历史图片。
 *
 * @param messages 消息数组（不修改入参，返回新数组）
 * @param opts     预算配置；全部为 0/未给时不做事，原样返回
 */
export function applyImageBudget<T extends { role?: string; content?: unknown }>(
  messages: readonly T[],
  opts: ImageBudgetOptions = {},
): ImageBudgetResult<T> {
  const historyThreshold = opts.historyBase64TokenThreshold ?? 0
  const perMessageLimit = opts.maxImageTokensPerMessage ?? 0

  // 两个预算都没配 → 不做事（保证未配置时行为与改动前完全一致）
  if (historyThreshold <= 0 && perMessageLimit <= 0) {
    return { messages: [...messages], elidedImages: 0, elidedTokens: 0 }
  }

  const keepRecent = opts.keepRecentMessages ?? 2
  const protectFrom = Math.max(0, messages.length - keepRecent)

  let elidedImages = 0
  let elidedTokens = 0

  // ── Pass 1：逐条消息，执行单条上限 ──
  const perMessageProcessed = messages.map((msg, idx) => {
    if (!Array.isArray(msg.content)) return msg
    const blocks = msg.content as unknown[]
    const imageIdx = blocks
      .map((b, i) => (isImageBlock(b) && !isPlaceholderBlock(b) ? i : -1))
      .filter(i => i >= 0)
    if (imageIdx.length === 0) return msg

    // 最近的消息受保护，不动
    const protectedMsg = idx >= protectFrom

    let tokens = imageIdx.reduce((n, i) => n + estimateImageTokens(blocks[i]), 0)
    if (perMessageLimit <= 0 || tokens <= perMessageLimit) return msg

    // 超限：从**最旧**的图开始替换，保留最后的（用户最后发的更可能相关）
    const next = [...blocks]
    for (const i of imageIdx) {
      if (tokens <= perMessageLimit) break
      // 受保护消息也不动，避免把正在讨论的图丢掉
      if (protectedMsg) break
      const t = estimateImageTokens(blocks[i])
      next[i] = { type: 'text', text: IMAGE_ELIDED_PLACEHOLDER }
      tokens -= t
      elidedImages++
      elidedTokens += t
    }
    return next === blocks ? msg : ({ ...msg, content: next } as T)
  })

  // ── Pass 2：全局历史预算（只算受保护范围之外的图片） ──
  if (historyThreshold > 0) {
    let total = 0
    const imageLocations: Array<{ msgIdx: number; blockIdx: number; tokens: number }> = []

    for (let i = 0; i < perMessageProcessed.length; i++) {
      if (i >= protectFrom) continue
      const content = perMessageProcessed[i].content
      if (!Array.isArray(content)) continue
      const blocks = content as unknown[]
      for (let j = 0; j < blocks.length; j++) {
        if (!isImageBlock(blocks[j]) || isPlaceholderBlock(blocks[j])) continue
        const tokens = estimateImageTokens(blocks[j])
        total += tokens
        imageLocations.push({ msgIdx: i, blockIdx: j, tokens })
      }
    }

    if (total > historyThreshold) {
      // 从最旧的开始替换，直到降到阈值内
      const result = [...perMessageProcessed]
      for (const loc of imageLocations) {
        if (total <= historyThreshold) break
        const msg = result[loc.msgIdx]
        const blocks = [...(msg.content as unknown[])]
        blocks[loc.blockIdx] = { type: 'text', text: IMAGE_ELIDED_PLACEHOLDER }
        result[loc.msgIdx] = { ...msg, content: blocks } as T
        total -= loc.tokens
        elidedImages++
        elidedTokens += loc.tokens
      }
      return { messages: result, elidedImages, elidedTokens }
    }
  }

  return { messages: perMessageProcessed, elidedImages, elidedTokens }
}

/** 统计消息中图片的估算 token 总量（诊断/UI 展示用） */
export function countImageTokens(messages: readonly { content?: unknown }[]): number {
  let total = 0
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue
    for (const block of msg.content as unknown[]) {
      if (isImageBlock(block) && !isPlaceholderBlock(block)) {
        total += estimateImageTokens(block)
      }
    }
  }
  return total
}
