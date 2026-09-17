/**
 * engine/promptSections.ts — 系统提示分片与缓存
 *
 * 移植自 D:\src\constants\systemPromptSections.ts（上游仅 70 行，零依赖）。
 *
 * 解决两个问题：
 *
 * 1. **重复计算**。工具循环每一轮都要重新构建 system 消息，而其中不乏
 *    昂贵片段（记忆召回要扫目录 + 读文件、工具上下文要算 token 预算）。
 *    同一轮对话内这些值本不该重算 —— 分片缓存把它们压成一次。
 *
 * 2. **缓存前缀稳定性**。主流网关（OpenAI 兼容的自动前缀缓存、Anthropic 的
 *    显式 cache_control）都要求**前缀逐字节稳定**才命中。若易变内容插在中间，
 *    它之后的所有内容都会失去缓存。因此约定：静态段在前、易变段在后，
 *    由 `composeSections` 保证排列，并由 `volatileSection` 把"必须每轮重算"
 *    显式标注出来（附理由，强制自证，避免图省事滥用）。
 */

/** 分片计算函数；返回 null 表示该分片本轮无内容（会被自动跳过） */
export type SectionCompute = () => string | null | Promise<string | null>

export interface PromptSection {
  name: string
  compute: SectionCompute
  /** true = 每轮重算，不写缓存。仅易变段应为 true */
  volatile: boolean
  /** volatile 为 true 时必填：为何必须破坏缓存前缀 */
  volatileReason?: string
}

/**
 * 创建一个**记忆化**分片：首次计算后缓存，直到显式失效或清空。
 *
 * `name` 同时用作缓存键，因此凡是会影响输出的输入都必须体现在 name 里
 * （例如把工具组的签名拼进来），否则会读到上一个输入的陈旧结果。
 */
export function section(name: string, compute: SectionCompute): PromptSection {
  return { name, compute, volatile: false }
}

/**
 * 创建一个**每轮重算**的易变分片。
 *
 * 上游把 `reason` 作为必填参数，用意是让"破坏缓存"成为一个需要说明理由的动作。
 * 这里保留该约束 —— 若你无法给出理由，说明这个分片其实应该被记忆化。
 */
export function volatileSection(
  name: string,
  compute: SectionCompute,
  reason: string,
): PromptSection {
  return { name, compute, volatile: true, volatileReason: reason }
}

/** 是否开启分片缓存（调试时可关掉以获得最新值） */
export const SECTION_CACHE_ENV = 'KX2_PROMPT_SECTION_CACHE'

export function isSectionCacheEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env[SECTION_CACHE_ENV] || '').trim().toLowerCase()
  return !(v === '0' || v === 'false' || v === 'off')
}

/**
 * 生成短指纹，用作缓存键的一部分。
 *
 * 直接把长文本（用户输入可能有几千字）当 Map 键会让缓存常驻大量字符串；
 * djb2 哈希后长度固定，碰撞概率对"同一输入复用"这个用途足够低。
 */
export function fingerprint(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return `${(h >>> 0).toString(36)}-${text.length}`
}

/** 分片缓存默认条目上限（防长会话无限增长） */
export const DEFAULT_MAX_CACHE_ENTRIES = 200

let maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES

/**
 * 设置分片缓存条目上限（设置界面改完即时生效）。
 *
 * 上限越大，长会话中可复用的分片越多、重复计算越少，但常驻内存也越多。
 * 缩小上限会立即淘汰最旧条目。
 */
export function setSectionCacheLimit(n?: number | void): void {
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
    maxCacheEntries = Math.floor(n)
    // 上限调小后立即裁剪，避免旧条目继续驻留
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
  }
}

/** 当前生效的缓存条目上限 */
export function getSectionCacheLimit(): number {
  return maxCacheEntries
}

const cache = new Map<string, string | null>()

/** 读取缓存的当前条目数（诊断/测试用） */
export function getSectionCacheSize(): number {
  return cache.size
}

/** 使某个分片失效（其依赖发生变化时调用） */
export function invalidateSection(name: string): void {
  cache.delete(name)
}

/** 按前缀使一批分片失效（例：工具组变了，作废所有 `toolHint:*`） */
export function invalidateSectionsByPrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/** 清空全部分片缓存（会话清空、压缩后、配置变更时调用） */
export function clearSectionCache(): void {
  cache.clear()
}

function setCacheEntry(name: string, value: string | null): void {
  // 覆写已存在的键不会改变 Map 的插入顺序，会导致该键停留在最旧位置、
  // 下次淘汰时被误踢。先删再写，保证"最近写入"排到队尾。
  if (cache.has(name)) cache.delete(name)
  if (cache.size >= maxCacheEntries) {
    // 淘汰最旧条目（Map 保持插入顺序，第一个键即最久未使用）
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(name, value)
}

/**
 * 命中缓存时刷新其位置，实现真正的 LRU。
 *
 * Map 的 `set` 对**已存在**的键不会改变插入顺序，因此若只读不重排，
 * 高频使用的热键会永远停在最旧位置、在下一次淘汰时被踢掉。
 * 必须先 delete 再重新 set 才能把它移到队尾。
 */
function touchEntry(name: string, value: string | null): void {
  cache.delete(name)
  cache.set(name, value)
}

/** 并行求值一个分片 */
async function resolveOne(s: PromptSection, useCache: boolean): Promise<string | null> {
  if (useCache && !s.volatile && cache.has(s.name)) {
    const cached = cache.get(s.name) ?? null
    touchEntry(s.name, cached)
    return cached
  }
  let value: string | null
  try {
    value = await s.compute()
  } catch {
    // 单个分片失败不应拖垮整个提示词组装；记忆召回、token 统计这类
    // 都属于增强项，拿不到就退化为"本轮无此段"。
    value = null
  }
  const normalized = typeof value === 'string' && value.trim() ? value : null
  if (!s.volatile) setCacheEntry(s.name, normalized)
  return normalized
}

/**
 * 解析全部分片，返回非空片段数组（保持传入顺序）。
 * volatile 分片每轮重算；其余命中缓存。
 */
export async function resolveSections(sections: PromptSection[]): Promise<string[]> {
  const useCache = isSectionCacheEnabled()
  const resolved = await Promise.all(sections.map(s => resolveOne(s, useCache)))
  return resolved.filter((v): v is string => v != null)
}

/**
 * 组装为最终文本。
 *
 * **顺序即缓存边界**：调用方必须把稳定片段放前面、易变片段放后面。
 * 这里不做重排（重排会掩盖调用方的顺序错误），但在开发模式下对
 * "易变在前、稳定在后"的明显错误给出告警。
 */
export function composeSections(parts: string[], separator = '\n\n'): string {
  return parts.filter(p => p && p.trim()).join(separator)
}

/**
 * 校验分片顺序是否符合缓存友好约定。
 * 返回违规的分片名（稳定段出现在易变段之后），不抛错 —— 仅用于开发期诊断。
 */
export function checkSectionOrder(sections: PromptSection[]): string[] {
  const bad: string[] = []
  let seenVolatile = false
  for (const s of sections) {
    if (s.volatile) {
      seenVolatile = true
    } else if (seenVolatile) {
      // 稳定段排在易变段之后 → 它前面的易变内容一变，它也跟着失去缓存
      bad.push(s.name)
    }
  }
  return bad
}

/**
 * 一步到位：解析 + 组装，并在顺序不当时告警。
 * 这是接入方通常唯一需要调用的函数。
 */
export async function buildPromptFromSections(
  sections: PromptSection[],
  separator = '\n\n',
): Promise<string> {
  const bad = checkSectionOrder(sections)
  if (bad.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[PromptSections] 以下稳定分片排在易变分片之后，会失去缓存前缀：${bad.join(', ')}`,
    )
  }
  return composeSections(await resolveSections(sections), separator)
}
