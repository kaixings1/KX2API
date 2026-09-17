/**
 * engine/compactPrompt.ts — 上下文压缩用的摘要提示词
 *
 * 移植自 D:\src\services\compact\prompt.ts。
 *
 * ─────────────────────────────────────────────────────────────
 * 三个关键设计（都不是"写好看点"，各有具体理由）
 * ─────────────────────────────────────────────────────────────
 *
 * 1. **首尾强制「不许调用工具」**
 *    压缩通常只给模型一轮机会（maxTurns: 1）。上游注记：在会思考的模型上
 *    有约 2.79% 的情况会尝试调工具（不用此约束时），而工具调用一旦被拒，
 *    这一轮就没有任何文本输出 → 整个压缩失败。首尾各说一次是因为
 *    模型对结尾的指令遵从度更高。
 *
 * 2. **`<analysis>` 草稿块 + 事后剥离**
 *    要求模型先在 `<analysis>` 里按时间顺序梳理，再给 `<summary>`。
 *    这个"先想后写"能显著提升摘要质量，但草稿本身不该进上下文
 *    —— 由 `formatCompactSummary` 剥掉。
 *
 * 3. **固定 9 段结构**
 *    自由格式的摘要会随机漏掉关键信息（尤其是"用户纠正过什么"
 *    这类最该保留的内容）。固定骨架强制覆盖这些维度。
 */

/** 摘要在压缩后重新注入时的包装标题 */
export const SUMMARY_HEADING = '摘要'

/**
 * 前置的强约束：不许调工具。
 * 放在最前面，因为部分模型对开头指令敏感。
 */
export const COMPACT_NO_TOOLS_PREAMBLE = `关键：此任务必须**不调用任何工具**。
- 不要使用 Read、Bash、Grep、Glob、Edit、Write 或任何其他工具。
- 工具调用会被拒绝，你会白白浪费掉唯一的一次机会。
- 你的输出必须是纯文本：一个 <analysis> 块，后跟一个 <summary> 块。`

/**
 * 后置的强约束。与前置内容重复是刻意的 —— 模型对结尾指令的遵从度更高。
 */
export const COMPACT_NO_TOOLS_TRAILER = `\n\n提醒：不要调用任何工具。你的回复必须是纯文本：一个 <analysis> 块，后跟一个 <summary> 块。工具调用会被拒绝。`

/**
 * 分析阶段的引导。
 *
 * 前两步（时间顺序遍历 + 逐条识别）是上游原文，实测能减少"只总结最后几轮"
 * 的倾向；后续步骤逐项对应下方的 9 段结构。
 */
const DETAILED_ANALYSIS_INSTRUCTION = `在给出摘要之前，请把你的分析过程放进 <analysis> 标签中，确保思路完整、覆盖所有必要要点。请按时间顺序遍历对话中的每条消息：
1. 识别用户明确提出的需求与意图
2. 识别涉及的技术概念、约束与关键决策
3. 记录检查、修改或创建的**具体**文件与代码片段，以及为什么读改它们
4. 记录遇到的错误以及修复方式
5. 特别注意**用户给出的纠正与反馈** —— 它们常与你的初始假设不同，是最该保留的信息
6. 记录用户的每一条非工具类消息（反映其意图变化）
7. 列出被明确要求但尚未完成的事项
8. 描述在本次摘要请求之前正在进行的工作
9. 判断下一步与哪些工作直接相关`

/**
 * 摘要主体：9 段固定结构。
 *
 * 第 4、6 段（错误与修复、所有用户消息）是**最有价值也最容易被自由摘要漏掉**的
 * 部分 —— 它们承载"已经踩过的坑"与"用户纠正过的方向"，
 * 丢掉之后模型会在同一个地方再错一次。
 */
export const COMPACT_SUMMARY_TEMPLATE = `你的任务是创建迄今为止对话的详细摘要，密切关注用户的明确请求以及你之前的操作。

${DETAILED_ANALYSIS_INSTRUCTION}

然后以 <summary> 块输出摘要，包含以下 9 个部分：

1. **主要需求与意图**：从对话中捕捉用户明确提出的需求与意图
2. **关键技术概念**：列出讨论过的主要技术概念、技术与框架
3. **文件与代码**：列举检查、修改或创建的具体文件与代码部分。特别关注最近的变更，并说明为什么这些读取或编辑是必要的
4. **错误与修复**：列出遇到的错误，以及如何修复它们。特别关注用户给出的纠正
5. **问题解决**：记录已解决的问题，以及任何正在进行中的工作
6. **所有用户消息**：列出所有非工具调用的用户消息。这些消息反映用户的反馈、意图变化与偏好
7. **待办任务**：列出被明确要求但尚未完成的任何任务
8. **当前工作**：精确描述在本次摘要请求之前正在进行的工作
9. **下一步（可选）**：列出与最近工作直接相关的下一步

输出格式：
<analysis>
[你的分析过程，将被程序剥离，不影响后续对话]
</analysis>

<summary>
[按上述 9 个部分组织的摘要]
</summary>`

/** 组合出完整的压缩提示词 */
export function buildCompactPrompt(customInstructions?: string): string {
  let prompt = `${COMPACT_NO_TOOLS_PREAMBLE}\n\n${COMPACT_SUMMARY_TEMPLATE}`

  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\n附加指令：\n${customInstructions.trim()}`
  }

  prompt += COMPACT_NO_TOOLS_TRAILER
  return prompt
}

/**
 * 清理模型返回的摘要文本。
 *
 * - 剥离 `<analysis>` 草稿块（它只是思考过程，不进上下文）
 * - 把 `<summary>` 包装换成可读标题
 * - 压缩多余空行
 *
 * 对**未闭合标签**做了容错：模型偶尔会漏写闭合标签或干脆不写标签，
 * 此时按"整段都是摘要"处理，而不是把内容丢掉。
 */
export function formatCompactSummary(summary: string): string {
  if (!summary) return ''

  let out = summary

  // 1. 剥离 analysis 草稿；未闭合时剥到结尾
  out = out.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
  out = out.replace(/<analysis>[\s\S]*$/i, '')

  // 2. summary 包装 → 可读标题
  const m = out.match(/<summary>([\s\S]*?)<\/summary>/i)
  if (m) {
    out = out.replace(/<summary>[\s\S]*?<\/summary>/i, `${SUMMARY_HEADING}：\n${(m[1] || '').trim()}`)
  } else {
    // 未闭合的 <summary>：去掉开始标签保留内容
    out = out.replace(/<\/?summary>/gi, '')
  }

  // 3. 清理：去掉残留标签、压空行
  out = out.replace(/<\/?analysis>/gi, '')
  out = out.replace(/[ \t]+$/gm, '')
  out = out.replace(/\n{3,}/g, '\n\n')

  return out.trim()
}

/**
 * 把摘要包成重新注入对话的消息文本。
 *
 * 明确标注「以下是此前对话的摘要」并附带"从摘要恢复上下文"的提示，
 * 让模型知道这段不是用户说的话。
 */
export function buildSummaryMessage(summary: string): string {
  const clean = formatCompactSummary(summary)
  return [
    '[上下文已压缩] 以下是此前对话的摘要，用于接续工作：',
    '',
    clean || '（摘要为空）',
    '',
    '请基于以上摘要继续，不要向用户复述摘要内容本身。',
  ].join('\n')
}
