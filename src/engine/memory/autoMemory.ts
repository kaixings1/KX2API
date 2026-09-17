/**
 * engine/memory/autoMemory.ts — 回合结束后的自动记忆提取
 *
 * 记忆系统此前只有读取侧在跑（engine-bridge 每轮召回注入），
 * 写入侧 memoryWriter 零调用 —— 记忆目录永远是空的，
 * 模型每轮都召回到「没有记忆」，整个机制形同虚设。
 *
 * 本模块把写入侧接上，流程：
 *   回合结束 → looksWorthRemembering 预筛（零成本）
 *            → 命中才调模型提炼成结构化记忆
 *            → writeMemory 落盘（含黑名单/密钥/体积校验）
 *
 * 设计取舍：
 * - **预筛前置**：绝大多数回合不值得记，先过廉价规则再决定要不要花模型调用。
 * - **异步不阻塞**：提取在后台进行，绝不让用户等它。失败静默（记忆是增强项）。
 * - **默认关闭**：会额外消耗模型额度，需用户显式开启。
 */

import { writeMemory, looksWorthRemembering, MAX_MEMORY_BODY_CHARS } from './memoryWriter.ts'
import type { MemoryType } from './memoryRecall.ts'

export interface AutoMemoryConfig {
  /** 是否启用自动记忆提取 */
  enabled: boolean
  /** 提炼用的 API 配置；缺省时退化为「原文截断存档」 */
  api?: {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
  }
  /** 单次提取的最大输入字符数（控制成本） */
  maxInputChars?: number
  /**
   * 记忆目录覆盖。缺省写入用户真实记忆目录；
   * 测试必须显式指定，否则会污染用户的记忆。
   */
  memoryDir?: string
}

export interface AutoMemoryResult {
  /** 是否真的写入了一条记忆 */
  written: boolean
  /** 未写入的原因（便于诊断为何「开了但没记」） */
  skipped?: string
  /** 写入的文件名 */
  file?: string
}

const DEFAULT_MAX_INPUT_CHARS = 8000

/** 提炼提示词：要求模型输出严格的三段结构，便于解析 */
const EXTRACT_PROMPT = `你是一个记忆提炼器。请从下面这段对话中提取**值得跨对话保留**的信息。

只提取这类内容：
- 用户的偏好、习惯、明确要求（"以后都这样"）
- 项目背景、架构约定、外部资源地址
- 踩过的坑与对应的规避方式

不要提取：代码结构、git 历史、本次任务的临时细节、任何密钥/口令。

若无值得保留的内容，只输出：NONE

若有，严格按以下格式输出三行（不要加任何其它文字）：
TITLE: <不超过 30 字的标题>
DESC: <一句话描述，用于未来判断相关性，要具体>
BODY: <正文，可用多行，但总长不超过 1500 字>`

/**
 * 从对话文本中提取记忆。
 *
 * @param conversation 本轮对话的合并文本
 * @param config 配置；enabled 为 false 时立即返回
 */
export async function extractMemoryFromTurn(
  conversation: string,
  config: AutoMemoryConfig,
): Promise<AutoMemoryResult> {
  if (!config.enabled) return { written: false, skipped: '未启用' }

  const text = (conversation || '').trim()
  if (!text) return { written: false, skipped: '对话为空' }

  // 廉价预筛：明显不值得记的直接跳过，不花模型调用
  if (!looksWorthRemembering(text)) {
    return { written: false, skipped: '未命中「值得记」的信号词' }
  }

  const maxChars = config.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS
  const input = text.length > maxChars ? text.slice(-maxChars) : text

  let raw: string
  if (config.api?.apiKey) {
    try {
      raw = await callExtractor(input, config.api)
    } catch (e) {
      return { written: false, skipped: `提炼调用失败: ${(e as Error).message}` }
    }
  } else {
    // 无 API 时退化：直接把预筛命中的原文存档，保证功能可用
    raw = `TITLE: 自动记录\nDESC: 回合内容命中「值得记」信号但未配置提炼模型，存原文\nBODY: ${input.slice(0, 1500)}`
  }

  const parsed = parseExtraction(raw)
  if (!parsed) return { written: false, skipped: '模型判定无值得保留的内容' }

  const result = await writeMemory(
    {
      name: parsed.title,
      description: parsed.desc,
      type: 'project' as MemoryType,
      body: parsed.body.slice(0, MAX_MEMORY_BODY_CHARS),
    },
    config.memoryDir ? { memoryDir: config.memoryDir } : {},
  )

  return result.ok
    ? { written: true, file: result.file }
    : { written: false, skipped: result.reason }
}

/** 调模型提炼 */
async function callExtractor(
  input: string,
  api: NonNullable<AutoMemoryConfig['api']>,
): Promise<string> {
  const baseUrl = (api.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
  const endpoint = baseUrl.includes('/chat/completions')
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${api.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: api.model,
      max_tokens: 800,
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: input },
      ],
    }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content || ''
}

/** 解析三段结构；返回 null 表示模型认为无可记内容 */
export function parseExtraction(
  raw: string,
): { title: string; desc: string; body: string } | null {
  const t = (raw || '').trim()
  if (!t || /^NONE\b/i.test(t)) return null

  const title = /^TITLE:\s*(.+)$/m.exec(t)?.[1]?.trim()
  const desc = /^DESC:\s*(.+)$/m.exec(t)?.[1]?.trim()
  // BODY 可跨行：取 BODY: 之后到结尾
  const bodyMatch = /^BODY:\s*([\s\S]+)$/m.exec(t)
  const body = bodyMatch?.[1]?.trim()

  if (!title || !desc || !body) return null
  return { title, desc, body }
}
