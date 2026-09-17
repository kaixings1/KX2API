/**
 * engine/errors/toolErrorFormat.ts — 工具错误消息格式化
 *
 * 移植自 D:\src\utils\toolErrors.ts。
 *
 * 两条规则值得单独强调：
 *
 * 1. **超长错误中间截断**，而不是尾部截断。
 *    构建输出、编译错误的**关键信息常在末尾**（`error: ... at file.ts:12`），
 *    单纯切尾部会把最有用的部分丢掉。
 *
 * 2. **参数校验错误要说人话**。
 *    原始校验错误（"expected string, received undefined"）对模型不友好，
 *    模型看不出"我少传了哪个参数"。分成「缺少 / 多余 / 类型不符」三类陈述后，
 *    模型下一次调用就能改对 —— 这直接影响工具调用成功率。
 */

/** 错误消息超过此长度则中间截断 */
export const MAX_ERROR_MESSAGE_CHARS = 10_000
/** 截断时头尾各保留的字符数 */
export const ERROR_TRUNCATE_HALF = 5_000

/** 中断（用户主动取消）时的固定文案 */
export const INTERRUPT_MESSAGE = '操作已被用户中断'

/** 简单错误：带 stderr/stdout/code 的错误对象（child_process 等） */
export interface ErrorLike {
  message?: string
  stderr?: string
  stdout?: string
  code?: number | string
  interrupted?: boolean
}

/** 判断是否为「中断」类错误 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; code?: string; message?: string }
  if (e.name === 'AbortError') return true
  if (e.code === 'ABORT_ERR') return true
  // 部分运行时会用消息文本表达中断
  return typeof e.message === 'string' && /aborted|abort/i.test(e.message)
}

/**
 * 把错误拆成若干文本片段（消息、stderr、stdout）。
 *
 * 顺序很重要：**消息在前、stdout 在后** —— 读的人先看到结论，
 * 需要细节时再往下看。
 */
export function getErrorParts(error: ErrorLike): string[] {
  const parts: string[] = []
  if (error.message) parts.push(error.message)
  if (typeof error.interrupted === 'boolean' && error.interrupted) {
    parts.push(INTERRUPT_MESSAGE)
  }
  if (typeof error.stderr === 'string' && error.stderr.trim()) parts.push(error.stderr)
  if (typeof error.stdout === 'string' && error.stdout.trim()) parts.push(error.stdout)
  return parts
}

/**
 * 把任意错误对象转成给模型看的文本。
 *
 * 永远不会抛异常 —— 错误格式化本身失败时必须仍能返回点东西，
 * 否则会把"工具失败"升级成"整个循环崩掉"。
 */
export function formatToolError(error: unknown): string {
  if (error == null) return '命令执行失败，没有输出'

  if (isAbortError(error)) {
    const msg = (error as ErrorLike).message
    return msg && msg.trim() ? msg : INTERRUPT_MESSAGE
  }

  if (typeof error === 'string') return truncateMiddle(error)
  if (!(error instanceof Error) && typeof error !== 'object') return truncateMiddle(String(error))

  const e = error as ErrorLike
  const fullMessage = getErrorParts(e).filter(Boolean).join('\n').trim()
  return truncateMiddle(fullMessage || '命令执行失败，没有输出')
}

/**
 * 中间截断：头部 + 省略提示 + 尾部。
 *
 * 尾部保留量与头部相同 —— 错误的关键结论（退出码、失败原因、位置）
 * 通常在末尾。
 */
export function truncateMiddle(text: string, maxChars = MAX_ERROR_MESSAGE_CHARS): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  const start = text.slice(0, half)
  const end = text.slice(-half)
  const omitted = text.length - half * 2
  return `${start}\n\n... [中间 ${omitted} 字符被截断] ...\n\n${end}`
}

// ─────────────────────────────── 参数校验错误 ───────────────────────────────

/** 单个参数问题的分类 */
export type ValidationIssueKind = 'missing' | 'unexpected' | 'typeMismatch'

export interface ValidationIssue {
  kind: ValidationIssueKind
  param: string
  /** 期望类型（仅 typeMismatch） */
  expected?: string
  /** 实际类型（仅 typeMismatch） */
  received?: string
}

/**
 * 把点号/数组下标路径格式化成可读形式。
 * `['todos', 0, 'activeForm']` → `todos[0].activeForm`
 */
export function formatValidationPath(path: ReadonlyArray<string | number>): string {
  if (!path || path.length === 0) return ''
  let out = ''
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]
    if (typeof seg === 'number') out += `[${seg}]`
    else out += i === 0 ? seg : `.${seg}`
  }
  return out
}

/**
 * 把参数校验问题格式化成模型能直接照着改的文本。
 *
 * 三类分开陈述是关键：模型看到「缺少必需参数 `path`」就能立刻补上，
 * 看到「提供了意外参数 `filePath`」就知道要改名 —— 比原始错误有效得多。
 */
export function formatValidationError(
  toolName: string,
  issues: readonly ValidationIssue[],
): string {
  if (!issues || issues.length === 0) {
    return `${toolName} 的参数校验未通过`
  }

  const missing = issues.filter(i => i.kind === 'missing')
  const unexpected = issues.filter(i => i.kind === 'unexpected')
  const mismatch = issues.filter(i => i.kind === 'typeMismatch')

  const lines: string[] = []
  for (const i of missing) lines.push(`缺少必需参数 \`${i.param}\``)
  for (const i of unexpected) lines.push(`提供了意外参数 \`${i.param}\``)
  for (const i of mismatch) {
    lines.push(
      `参数 \`${i.param}\` 的类型应为 \`${i.expected ?? '?'}\`，但提供的是 \`${i.received ?? '?'}\``,
    )
  }

  return `${toolName} 因以下问题而失败：\n${lines.join('\n')}`
}

/**
 * 从「简单校验结果」构造 ValidationIssue 列表。
 *
 * KX2API 的工具接口是 `validate(params) => { valid, errors?: string[] }`，
 * 只给出自由文本错误。这里做一次尽力而为的分类：能从文本里认出
 * 「缺少/未提供」「多余/未知」「类型」就归类，认不出就作为类型不符处理
 * （至少能保证参数名被提取出来）。
 */
export function issuesFromSimpleErrors(errors: readonly string[]): ValidationIssue[] {
  const out: ValidationIssue[] = []
  for (const raw of errors) {
    const text = String(raw ?? '').trim()
    if (!text) continue

    // 提取被反引号、单引号或双引号包起来的参数名，取第一个
    const nameMatch = text.match(/[`'"]([^`'"]+)[`'"]/)
    const param = nameMatch ? nameMatch[1] : text.split(/\s+/)[0]

    if (/缺少|未提供|missing|required|undefined/i.test(text)) {
      out.push({ kind: 'missing', param })
    } else if (/意外|多余|未知|unexpected|unknown|unrecognized/i.test(text)) {
      out.push({ kind: 'unexpected', param })
    } else {
      // 尽力提取 "expected X" / "应为 X"
      const exp = text.match(/expected\s+(\w+)|应为\s*`?(\w+)`?/i)
      const rec = text.match(/received\s+(\w+)|实际\s*`?(\w+)`?/i)
      out.push({
        kind: 'typeMismatch',
        param,
        expected: exp ? (exp[1] || exp[2]) : undefined,
        received: rec ? (rec[1] || rec[2]) : undefined,
      })
    }
  }
  return out
}

/**
 * 一步到位：工具执行失败时的统一错误文本入口。
 *
 * @param toolName 工具名
 * @param error    抛出的错误
 * @param validationIssues 若是参数校验失败，传入结构化问题（优先于 error）
 */
export function describeToolFailure(
  toolName: string,
  error: unknown,
  validationIssues?: readonly ValidationIssue[],
): string {
  if (validationIssues && validationIssues.length > 0) {
    return formatValidationError(toolName, validationIssues)
  }
  return `${toolName} 执行失败：${formatToolError(error)}`
}
