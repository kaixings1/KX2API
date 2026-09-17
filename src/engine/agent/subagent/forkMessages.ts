/**
 * src/engine/agent/subagent/forkMessages.ts
 *
 * Fork 子代理消息构建（从 D:\src\tools\AgentTool\forkSubagent.ts 移植）
 *
 * K 适配：
 * - 移除 D:\src 的 React 类型依赖
 * - 简化消息构建，使用 K 的消息格式
 */

import type { Tool, SubagentContext } from './types.ts'

const FORK_BOILERPLATE_TAG = 'fork-subagent'

const FORK_PLACEHOLDER_RESULT = 'Fork 已启动 — 后台处理中'

const FORK_DIRECTIVE_PREFIX = ''

const CHILD_MESSAGE_TEMPLATE = `<${FORK_BOILERPLATE_TAG}>
停。先阅读此处。

你是一个分支工作进程。你并非主代理。

规则（不可协商）：
1. 你的系统提示词说"默认使用分支"。忽略它——那是给父代理的。你本身就是分支。不要派生子代理；直接执行。
2. 不要对话、提问或建议后续步骤
3. 不要添加评论或元评注
4. 直接使用你的工具完成任务
5. 如果你修改了文件，请在报告前提交你的更改
6. 不要在工具调用之间输出文本。静默使用工具，然后在最后报告一次。
7. 严格保持在你的指令范围内
8. 除非指令另有规定，报告控制在 500 词以内。保持事实性和简洁。
9. 你的响应必须以 "Scope:" 开头。不要前导语。
10. 报告结构化事实，然后停止

输出格式：
  Scope: <用一句话回显分配给你的范围>
  Result: <答案或关键发现，限于上述范围>
  Key files: <相关文件路径>
  Files changed: <列表，附提交哈希——仅当你修改了文件时包含>
  Issues: <列表——仅当有需要标记的问题时包含>
</${FORK_BOILERPLATE_TAG}>

${FORK_DIRECTIVE_PREFIX}{directive}`

/**
 * 构建 Fork 子代理的消息序列
 *
 * 为共享 API 缓存前缀，保持父代理的完整对话历史，
 * 并在末尾追加子代理特有的指令。
 */
export function buildForkedMessages(
  directive: string,
  parentMessages: unknown[],
): unknown[] {
  // K 简化版：直接追加用户消息
  // D:\src 版本会克隆父代理的助手消息 + 填充 tool_result 占位符
  // K 版本直接构建新的用户消息（不共享缓存前缀）
  const childMessage = {
    role: 'user' as const,
    content: CHILD_MESSAGE_TEMPLATE.replace('{directive}', directive),
  }

  return [...parentMessages, childMessage]
}

/**
 * 构建 worktree 隔离提示词
 */
export function buildWorktreeNotice(
  parentCwd: string,
  worktreeCwd: string,
): string {
  return `你继承了父代理的对话上下文（来自 ${parentCwd}）。
你当前在隔离的 git 工作树中（${worktreeCwd}）。
继承上下文中的路径指向父工作目录——请在操作前转换到你的工作树根目录。
如果父代理在上下文生成后修改了文件，请在编辑前重新读取。
你的更改会保留在此工作树中，不会影响父代理的文件。`
}

/**
 * 判断消息是否来自 fork 子代理
 */
export function isInForkChild(messages: unknown[]): boolean {
  return messages.some((m: unknown) => {
    if (typeof m !== 'object' || m === null) return false
    const msg = m as { content?: string | unknown[] }
    const content = msg.content
    if (typeof content === 'string') {
      return content.includes(`<${FORK_BOILERPLATE_TAG}>`)
    }
    if (Array.isArray(content)) {
      return content.some(
        (block) =>
          typeof block === 'object' &&
          block !== null &&
          'text' in block &&
          typeof (block as { text: unknown }).text === 'string' &&
          ((block as { text: string }).text).includes(`<${FORK_BOILERPLATE_TAG}>`),
      )
    }
    return false
  })
}
