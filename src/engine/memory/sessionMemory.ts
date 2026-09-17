/**
 * engine/memory/sessionMemory.ts — 会话级滚动记忆
 *
 * 与 `memoryRecall`（跨对话的项目记忆）**不同层次**：
 * - `memoryRecall` 读的是磁盘上的长期记忆，跨会话持久；
 * - 本模块只管**单次对话内**的滚动要点，进程内维护，**只喂给压缩**。
 *
 * 解决的问题：长对话会被多次压缩。每次压缩都是"把当前消息摘要化"，
 * 而**上一次压缩产生的摘要本身就是二手的** —— 多轮压缩后，早期的关键信息
 * （用户的原始约束、纠正过的方向、踩过的坑）会逐轮衰减直至消失。
 *
 * 做法：每轮压缩后把"这一段发生了什么"追加进会话记忆，下次压缩时把
 * 已有记忆一并交给摘要器 —— 摘要器看到的是**累加的要点列表**，
 * 而不是只能从当前消息里重新推断。
 *
 * 设计取舍：
 * - **进程内、不落盘**：它的生命周期就是一次对话，落盘反而会在重启后
 *   把上一段对话的要点带进新对话（那是 memoryRecall 的职责）。
 * - **有上限**：单条与总量都设上限，避免记忆本身成为新的上下文负担。
 * - **逐条去重**：相同要点重复追加没有意义，且会挤占额度。
 */

/** 单条要点最大字符数（超出截断） */
export const MAX_ENTRY_CHARS = 500
/** 会话记忆总条目上限（超出丢弃最旧的） */
export const MAX_ENTRIES = 40

export interface SessionMemoryEntry {
  /** 要点正文 */
  text: string
  /** 写入时间戳 */
  at: number
  /** 该要点来自第几次压缩（从 1 开始） */
  round: number
}

/**
 * 会话记忆。
 *
 * 生命周期与一个会话绑定 —— 调用方在会话开始时 `create()`，
 * 压缩后 `add()`，下次压缩前 `formatForCompact()`。
 */
export class SessionMemory {
  private entries: SessionMemoryEntry[] = []

  /** 追加一条要点；空内容与重复内容会被忽略 */
  add(text: string, round: number): void {
    const trimmed = (text || '').trim()
    if (!trimmed) return

    // 逐条去重：同一要点反复追加没有意义，还会挤掉真正的新信息
    if (this.entries.some(e => e.text === trimmed)) return

    this.entries.push({
      text: trimmed.length > MAX_ENTRY_CHARS ? trimmed.slice(0, MAX_ENTRY_CHARS) : trimmed,
      at: Date.now(),
      round,
    })

    // 超出上限丢弃最旧的：最近的要点对当前决策更相关
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES)
    }
  }

  /** 批量追加（一次压缩通常产出多条要点） */
  addAll(texts: readonly string[], round: number): void {
    for (const t of texts) this.add(t, round)
  }

  /** 当前全部要点（副本） */
  list(): SessionMemoryEntry[] {
    return [...this.entries]
  }

  get size(): number {
    return this.entries.length
  }

  /** 清空（会话结束或用户手动清空上下文时调用） */
  clear(): void {
    this.entries = []
  }

  /**
   * 渲染成供压缩提示词使用的文本。
   *
   * 返回空字符串表示"还没有记忆" —— 调用方据此跳过注入，
   * 避免把空标题塞进提示词。
   */
  formatForCompact(): string {
    if (this.entries.length === 0) return ''
    const lines = this.entries.map(e => `- ${e.text}`)
    return [
      '【本会话此前的要点】（此前几轮压缩沉淀，可能包含更早的原始约束与已确认的决策）',
      ...lines,
      '',
      '请注意：上面这些是**已经确认过的事实**，摘要时不要与之矛盾；',
      '若本次消息与其中某条冲突，以本次消息为准并说明变化。',
    ].join('\n')
  }
}

/**
 * 从摘要文本中抽取「要点」。
 *
 * 摘要本身是 9 段式结构（见 `compactPrompt.ts`），这里只挑出**跨轮次仍有用**的段落，
 * 而不是把整篇摘要存进会话记忆 —— 整篇存会让记忆迅速膨胀，且后半段
 * （下一步、当前工作）在下一轮就过时了。
 *
 * 抽取策略：按 markdown 标题切段，保留与「约束/决策/错误」相关的段。
 */
export function extractKeyPoints(summary: string): string[] {
  if (!summary || !summary.trim()) return []

  const out: string[] = []
  // 按 `## 标题` 或 `### 标题` 切段
  const sections = summary.split(/\n(?=#{2,3}\s)/)

  /** 是否至少识别出一个 markdown 标题（用于区分"格式不符"与"格式对但内容都不该留"） */
  let sawAnyHeading = false

  for (const sec of sections) {
    const heading = /^#{2,3}\s*(.+)$/m.exec(sec)?.[1]?.trim()
    if (heading) sawAnyHeading = true

    const body = sec.replace(/^#{2,3}\s*.+$/m, '').trim()
    if (!body) continue

    // 只保留跨轮次仍有价值的类别。
    //
    // 关键词覆盖中英文（摘要提示词是中文的，但模型可能混用），且必须包含
    // **用户的原始请求** —— 多轮压缩后最容易丢的就是"最初要做什么"，
    // 而那恰恰是判断后续工作是否跑偏的基准。
    const keep =
      /约束|要求|请求|需求|决策|约定|纠正|错误|失败|坑|修复|背景|目标|意图|偏好|习惯|constraint|require|request|decision|error|fail|fix|goal|intent|prefer/i.test(
        heading ?? '',
      )
    if (!keep) continue

    // 每段压成一行，避免单条要点占满额度
    const oneLine = body.replace(/\s*\n\s*/g, ' ').trim()
    if (oneLine) out.push(oneLine.length > MAX_ENTRY_CHARS ? oneLine.slice(0, MAX_ENTRY_CHARS) : oneLine)
  }

  // 兜底**仅在完全没有 markdown 标题时**触发（模型没按 9 段式格式输出）。
  //
  // 早期实现是 "out 为空就兜底"，这是错的：格式正确但内容都不属保留类时
  // （如整篇只有「当前工作」「下一步」），兜底会把本就该丢弃的段落塞回来 ——
  // 正是本模块要避免的"存了下一轮就过时的信息"。
  if (!sawAnyHeading) {
    const first = summary.split(/\n\s*\n/)[0]?.replace(/\s*\n\s*/g, ' ').trim()
    if (first) out.push(first.length > MAX_ENTRY_CHARS ? first.slice(0, MAX_ENTRY_CHARS) : first)
  }

  return out
}
