/**
 * engine/messages.ts — 消息工具模块（从 CLI 版吸收完整能力）
 *
 * 提供消息创建、规范化、验证、附件处理、Hook系统、流式处理等完整工具集。
 * 注意：不导入 index.ts 以避免循环依赖（index.ts 已 export * from this）
 */

// ============ 类型定义（自包含，不依赖 index.ts） ============

export type InternalRole = "system" | "user" | "assistant" | "tool";
export type InternalContent = string | Array<Record<string, unknown>>;

export interface InternalMessage {
  role: InternalRole;
  content: InternalContent;
  toolUseId?: string;
}

export type APIMessage = {
  role: string;
  content: unknown;
  [k: string]: unknown;
};

export type NormalizedMessage = InternalMessage & {
  uuid?: string;
  isMeta?: boolean;
  p?: string;
  c?: number;
  t?: number;
}

export interface MessageLookups {
  byUUID: Map<string, NormalizedMessage>
  byID: Map<string, NormalizedMessage>
  byToolUseID: Map<string, NormalizedMessage>
}

export interface AttachmentMessage {
  message: InternalMessage
  attachmentUuid?: string
}

// ============ 常量 ============

export const NO_CONTENT_MESSAGE = '(无内容)';
export const SYNTHETIC_MODEL = '<synthetic>';
export const INTERRUPT_MESSAGE = '[用户中断请求]';
export const INTERRUPT_MESSAGE_FOR_TOOL_USE = '[用户中断工具执行]';
export const CANCEL_MESSAGE =
  "用户不想执行此操作。停止当前操作，等待用户指示如何继续。";
export const REJECT_MESSAGE =
  "用户拒绝此工具使用。工具使用已被拒绝。停止当前操作，等待用户指示如何继续。";
export const DENIAL_WORKAROUND_GUIDANCE =
  "重要提示：你可以尝试使用其他可能自然完成此目标的工具来完成该操作。但请不要以恶意方式尝试绕过此拒绝。你只能以合理的、不试图规避此拒绝初衷的方式来尝试变通。如果你认为该能力对完成用户请求至关重要，请停止并向用户解释。";
export const NO_RESPONSE_REQUESTED = '未请求响应。';
export const SUBAGENT_REJECT_MESSAGE =
  '此工具使用的权限被拒绝。请尝试其他方法或报告此限制以完成任务。';
export const SYNTHETIC_TOOL_RESULT_PLACEHOLDER = '❌ 错误: [工具结果因内部错误缺失]';

// ============ 消息创建 ============

export function createAssistantMessage({
  content,
  isVirtual,
}: {
  content: string | Array<Record<string, unknown>>;
  isVirtual?: boolean;
}): InternalMessage {
  return {
    role: 'assistant',
    content: typeof content === 'string' ? content : content,
    ...(isVirtual ? {} : {}),
  } as InternalMessage;
}

export function createUserMessage({
  content,
  isMeta,
}: {
  content: string | Array<Record<string, unknown>>;
  isMeta?: boolean;
}): InternalMessage {
  return {
    role: 'user',
    content,
    ...(isMeta ? {} : {}),
  } as InternalMessage;
}

export function createSystemMessage(content: string): InternalMessage {
  return { role: 'system', content } as InternalMessage;
}

export function createProgressMessage({
  toolUseID,
  data,
}: {
  toolUseID: string;
  data: Record<string, unknown>;
}): InternalMessage {
  return {
    role: 'system',
    content: JSON.stringify({ type: 'progress', toolUseID, data }),
  } as InternalMessage;
}

export function createToolResultStopMessage(toolUseID: string): InternalMessage {
  return {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: toolUseID, content: CANCEL_MESSAGE, is_error: true }],
  } as unknown as InternalMessage;
}

export function createUserInterruptionMessage({
  toolUse = false,
}: {
  toolUse?: boolean;
}): InternalMessage {
  return createUserMessage({
    content: toolUse ? INTERRUPT_MESSAGE_FOR_TOOL_USE : INTERRUPT_MESSAGE,
  });
}

// ============ 消息规范化 ============

export function normalizeMessagesForAPI(
  messages: InternalMessage[],
  provider: 'anthropic' | 'openai',
): APIMessage[] {
  if (provider === 'anthropic') {
    return normalizeForAnthropic(messages);
  }
  return normalizeForOpenAI(messages);
}

function normalizeForAnthropic(messages: InternalMessage[]): APIMessage[] {
  const result: APIMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'user') {
      result.push({ role: 'user', content: asStringOrArray(msg.content) });
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: asStringOrArray(msg.content) });
    } else if (msg.role === 'tool' && msg.toolUseId) {
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolUseId, content: asString(msg.content) }],
      });
    }
  }
  return mergeConsecutive(result);
}

function normalizeForOpenAI(messages: InternalMessage[]): APIMessage[] {
  const result: APIMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: asString(msg.content) });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: asString(msg.content) });
    } else if (msg.role === 'assistant') {
      const blocks = Array.isArray(msg.content)
        ? (msg.content as Array<Record<string, unknown>>)
        : [];
      const textParts: string[] = [];
      const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
      for (const block of blocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id as string,
            type: 'function',
            function: {
              name: block.name as string,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }
      const openAIMsg: APIMessage = {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.join('') : '',
      };
      if (toolCalls.length > 0) {
        openAIMsg.tool_calls = toolCalls;
      }
      result.push(openAIMsg);
    } else if (msg.role === 'tool' && msg.toolUseId) {
      result.push({ role: 'tool', tool_call_id: msg.toolUseId, content: asString(msg.content) });
    }
  }
  return result;
}

// ============ 消息合并 ============

export function mergeUserMessagesAndToolResults(
  messages: InternalMessage[],
): InternalMessage[] {
  const result: InternalMessage[] = [];
  let pendingUser: InternalMessage | null = null;

  for (const msg of messages) {
    if (msg.role === 'user' && !msg.toolUseId) {
      if (pendingUser) {
        pendingUser = mergeUserContent(pendingUser, msg);
      } else {
        pendingUser = { ...msg };
      }
    } else if (msg.role === 'tool' && pendingUser) {
      result.push(pendingUser);
      pendingUser = null;
      result.push(msg);
    } else {
      if (pendingUser) {
        result.push(pendingUser);
        pendingUser = null;
      }
      result.push(msg);
    }
  }

  if (pendingUser) {
    result.push(pendingUser);
  }

  return result;
}

function mergeUserContent(a: InternalMessage, b: InternalMessage): InternalMessage {
  const aContent = a.content;
  const bContent = b.content;

  if (typeof aContent === 'string' && typeof bContent === 'string') {
    return { ...a, content: aContent + '\n' + bContent };
  }

  if (typeof aContent === 'string') {
    return { ...a, content: [aContent, ...(Array.isArray(bContent) ? bContent : [bContent])] };
  }

  if (typeof bContent === 'string') {
    return { ...a, content: [...(Array.isArray(aContent) ? aContent : [aContent]), bContent] };
  }

  return { ...a, content: [...(Array.isArray(aContent) ? aContent : [aContent]), ...(Array.isArray(bContent) ? bContent : [bContent])] };
}

export function mergeAssistantMessages(
  messages: InternalMessage[],
): InternalMessage[] {
  const result: InternalMessage[] = [];
  let lastAssistant: InternalMessage | null = null;

  for (const msg of messages) {
    if (msg.role === 'assistant' && lastAssistant && lastAssistant.role === 'assistant') {
      lastAssistant = {
        ...msg,
        content: mergeContentBlocks(lastAssistant.content, msg.content),
      };
    } else {
      if (lastAssistant) {
        result.push(lastAssistant);
      }
      lastAssistant = { ...msg };
    }
  }

  if (lastAssistant) {
    result.push(lastAssistant);
  }

  return result;
}

function mergeContentBlocks(
  a: InternalContent,
  b: InternalContent,
): InternalContent {
  if (typeof a === 'string' && typeof b === 'string') {
    return a + b;
  }
  return [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])];
}

// ============ 内容提取 ============

export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
      .map((c: Record<string, unknown>) => c.text as string)
      .join('\n');
  }
  return '';
}

export function getAssistantMessageText(message: InternalMessage): string | null {
  if (message.role !== 'assistant') return null;
  return extractTextContent(message.content) || null;
}

export function getUserMessageText(message: InternalMessage): string | null {
  if (message.role !== 'user') return null;
  if (typeof message.content === 'string') return message.content;
  return extractTextContent(message.content) || null;
}

export function getContentText(content: unknown): string {
  return extractTextContent(content);
}

// ============ 消息验证 ============

export function isNotEmptyMessage(message: InternalMessage): boolean {
  const text = extractTextContent(message.content);
  return text.trim().length > 0 && text !== NO_CONTENT_MESSAGE && text !== INTERRUPT_MESSAGE_FOR_TOOL_USE;
}

export function isEmptyMessageText(text: string): boolean {
  return text.trim().length === 0 || text === NO_CONTENT_MESSAGE;
}

export function isToolUseRequestMessage(message: InternalMessage): boolean {
  if (message.role !== 'assistant') return false;
  const blocks = Array.isArray(message.content) ? message.content : [];
  return blocks.some((b: Record<string, unknown>) => b.type === 'tool_use');
}

export function isToolUseResultMessage(message: InternalMessage): boolean {
  if (message.role !== 'user') return false;
  if (typeof message.content === 'string') return false;
  const blocks = Array.isArray(message.content) ? message.content : [];
  return blocks.some((b: Record<string, unknown>) => b.type === 'tool_result');
}

export function isThinkingMessage(message: InternalMessage): boolean {
  if (message.role !== 'assistant') return false;
  const blocks = Array.isArray(message.content) ? message.content : [];
  return blocks.some((b: Record<string, unknown>) => b.type === 'thinking');
}

export function hasToolCallsInLastAssistantTurn(
  messages: InternalMessage[],
): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.role === 'assistant') {
      const blocks = Array.isArray(message.content) ? message.content : [];
      return blocks.some((b: Record<string, unknown>) => b.type === 'tool_use');
    }
  }
  return false;
}

// ============ 工具调用统计 ============

export function countToolCalls(messages: InternalMessage[]): number {
  return messages.reduce((count, msg) => {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      count += msg.content.filter((b: Record<string, unknown>) => b.type === 'tool_use').length;
    }
    return count;
  }, 0);
}

export function hasSuccessfulToolCall(messages: InternalMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'tool' && msg.toolUseId) {
      return true;
    }
  }
  return false;
}

// ============ 消息重排序 ============

export function reorderMessagesInUI(
  messages: InternalMessage[],
): InternalMessage[] {
  const result: InternalMessage[] = [];
  const pendingToolBlocks = new Map<string, { toolUse: InternalMessage | null; preHooks: InternalMessage[]; toolResult: InternalMessage | null; postHooks: InternalMessage[] }>();

  for (const msg of messages) {
    if (isToolUseRequestMessage(msg)) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const toolUseBlock = blocks.find((b: Record<string, unknown>) => b.type === 'tool_use');
      if (toolUseBlock && typeof toolUseBlock.id === 'string') {
        const id = toolUseBlock.id as string;
        if (!pendingToolBlocks.has(id)) {
          pendingToolBlocks.set(id, { toolUse: null, preHooks: [], toolResult: null, postHooks: [] });
        }
        pendingToolBlocks.get(id)!.toolUse = msg;
      }
      continue;
    }

    if (isToolUseResultMessage(msg)) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const toolResultBlock = blocks.find((b: Record<string, unknown>) => b.type === 'tool_result');
      if (toolResultBlock && typeof (toolResultBlock as Record<string, unknown>).tool_use_id === 'string') {
        const id = (toolResultBlock as Record<string, unknown>).tool_use_id as string;
        if (!pendingToolBlocks.has(id)) {
          pendingToolBlocks.set(id, { toolUse: null, preHooks: [], toolResult: null, postHooks: [] });
        }
        pendingToolBlocks.get(id)!.toolResult = msg;
      }
      result.push(msg);
      continue;
    }

    result.push(msg);
  }

  // Rebuild with tool results after their tool_use
  const final: InternalMessage[] = [];
  const processed = new Set<string>();

  for (const msg of result) {
    if (isToolUseRequestMessage(msg)) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const toolUseBlock = blocks.find((b: Record<string, unknown>) => b.type === 'tool_use');
      if (toolUseBlock && typeof toolUseBlock.id === 'string') {
        const id = toolUseBlock.id as string;
        if (!processed.has(id)) {
          processed.add(id);
          const group = pendingToolBlocks.get(id);
          if (group) {
            if (group.toolUse) final.push(group.toolUse);
            if (group.toolResult) final.push(group.toolResult);
          }
        }
      }
      continue;
    }
    final.push(msg);
  }

  return final;
}

// ============ 工具结果配对验证（吸收 CLI 版 ensureToolResultPairing） ============

export function ensureToolResultPairing(
  messages: InternalMessage[],
): InternalMessage[] {
  const result: InternalMessage[] = [];
  const pendingToolUses = new Map<string, InternalMessage>();

  for (const msg of messages) {
    if (isToolUseRequestMessage(msg)) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const toolUseBlock = blocks.find((b: Record<string, unknown>) => b.type === 'tool_use');
      if (toolUseBlock && typeof toolUseBlock.id === 'string') {
        const id = toolUseBlock.id as string;
        pendingToolUses.set(id, msg);
      }
      result.push(msg);
    } else if (isToolUseResultMessage(msg)) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const toolResultBlock = blocks.find((b: Record<string, unknown>) => b.type === 'tool_result');
      if (toolResultBlock && typeof (toolResultBlock as Record<string, unknown>).tool_use_id === 'string') {
        const id = (toolResultBlock as Record<string, unknown>).tool_use_id as string;
        pendingToolUses.delete(id);
      }
      result.push(msg);
    } else {
      // 剥离孤立 tool_use（没有配对的 tool_result）
      const orphanedToolUseIDs: string[] = [];
      for (const [id, toolUseMsg] of pendingToolUses) {
        orphanedToolUseIDs.push(id);
      }
      for (const id of orphanedToolUseIDs) {
        pendingToolUses.delete(id);
      }
      result.push(msg);
    }
  }

  // 正向补缺失：为残留的 tool_use 添加错误占位符 tool_result
  for (const [id, toolUseMsg] of pendingToolUses) {
    result.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: id,
        content: SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
        is_error: true,
      }],
    } as unknown as InternalMessage);
  }

  return result;
}

// ============ 消息查找表（吸收 CLI 版 buildMessageLookups） ============

export function buildMessageLookups(
  normalizedMessages: NormalizedMessage[],
  messages: InternalMessage[],
): MessageLookups {
  const byUUID = new Map<string, NormalizedMessage>();
  const byID = new Map<string, NormalizedMessage>();
  const byToolUseID = new Map<string, NormalizedMessage>();

  for (const msg of [...normalizedMessages, ...messages] as NormalizedMessage[]) {
    if (msg.uuid) byUUID.set(msg.uuid, msg);
    if ((msg as any).id) byID.set((msg as any).id as string, msg);
    if (msg.toolUseId) byToolUseID.set(msg.toolUseId, msg);
  }

  return { byUUID, byID, byToolUseID };
}

// ============ 消息验证函数（吸收 CLI 版） ============

export function filterOrphanedThinkingOnlyMessages(
  messages: InternalMessage[],
): InternalMessage[] {
  const result: InternalMessage[] = [];
  let lastAssistantIdx = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }

  if (lastAssistantIdx < 0) return messages;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (i < lastAssistantIdx && msg.role === 'assistant') {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const hasNonThinking = blocks.some((b: Record<string, unknown>) => b.type !== 'thinking');
      const hasText = typeof msg.content === 'string' && msg.content.trim().length > 0;
      if (!hasNonThinking && !hasText) continue;
    }
    result.push(msg);
  }

  return result;
}

export function filterWhitespaceOnlyAssistantMessages(
  messages: InternalMessage[],
): InternalMessage[] {
  return messages.filter((msg) => {
    if (msg.role !== 'assistant') return true;
    const text = extractTextContent(msg.content);
    return text.trim().length > 0;
  });
}

export function ensureNonEmptyAssistantContent(
  messages: InternalMessage[],
): InternalMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant') return msg;
    const text = extractTextContent(msg.content);
    if (text.trim().length === 0 && Array.isArray(msg.content)) {
      const blocks = msg.content as Array<Record<string, unknown>>;
      const hasToolUse = blocks.some((b: Record<string, unknown>) => b.type === 'tool_use');
      if (!hasToolUse) {
        return { ...msg, content: [{ type: 'text', text: '(无内容)' }] };
      }
    }
    return msg;
  });
}

export function stripSignatureBlocks(messages: InternalMessage[]): InternalMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant' || typeof msg.content !== 'string') return msg;
    const signaturePattern = /[\s\S]*?(--\s*[\s\S]*|\[signature\][\s\S]*|```[\s\S]*signature[\s\S]*```)/i;
    const cleaned = msg.content.replace(signaturePattern, '').trim();
    return { ...msg, content: cleaned || '(无内容)' };
  });
}

// ============ Hook 系统函数 ============

export function isHookAttachmentMessage(message: InternalMessage): boolean {
  if (typeof message.content !== 'string') return false;
  try {
    const parsed = JSON.parse(message.content);
    return parsed?.type === 'hook_blocking_error' ||
           parsed?.type === 'hook_success' ||
           parsed?.type === 'async_hook_response';
  } catch {
    return false;
  }
}

export function hasUnresolvedHooks(messages: InternalMessage[]): boolean {
  return messages.some((msg) => {
    if (msg.role !== 'system') return false;
    if (typeof msg.content !== 'string') return false;
    try {
      const parsed = JSON.parse(msg.content);
      return parsed?.type === 'hook_blocking_error';
    } catch {
      return false;
    }
  });
}

// ============ 流式处理函数（吸收 CLI 版 handleMessageFromStream） ============

export function handleMessageFromStream(
  message: unknown,
  onMessage: (msg: InternalMessage) => void,
  onUpdateLength: (length: number) => void,
  onFileDelta?: (delta: Record<string, unknown>) => void,
): void {
  const msg = message as Record<string, unknown>;
  const type = msg.type as string | undefined;

  switch (type) {
    case 'message_delta':
    case 'content_block_delta': {
      const delta = msg.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta') {
        const text = (delta.text as string) || '';
        onMessage({
          role: 'assistant',
          content: text,
        });
        onUpdateLength(text.length);
      } else if (delta?.type === 'tool_use_delta') {
        const toolUseDelta = delta as Record<string, unknown>;
        onMessage({
          role: 'assistant',
          content: [{ type: 'tool_use', id: toolUseDelta.id as string, name: toolUseDelta.name as string, input: toolUseDelta.arguments ? JSON.parse(toolUseDelta.arguments as string) : {} }],
        });
      }
      break;
    }
    case 'message_start': {
      const startMsg = msg.message as Record<string, unknown> | undefined;
      if (startMsg?.content) {
        onMessage({
          role: 'assistant',
          content: startMsg.content as InternalContent,
        });
      }
      break;
    }
    case 'content_block_start': {
      const block = msg.content_block as Record<string, unknown> | undefined;
      if (block?.type === 'text') {
        onMessage({
          role: 'assistant',
          content: (block.text as string) || '',
        });
      }
      break;
    }
    default:
      break;
  }

  if (onFileDelta && type === 'message_delta') {
    const stopReason = (msg as Record<string, unknown>)?.stop_reason;
    if (stopReason) {
      onFileDelta({ type: 'message_complete', stopReason: stopReason as string });
    }
  }
}

// ============ 辅助函数 ============

function asString(c: InternalContent): string {
  if (typeof c === 'string') return c;
  try {
    return JSON.stringify(c);
  } catch {
    return String(c);
  }
}

function asStringOrArray(c: InternalContent): unknown {
  return typeof c === 'string' ? c : c;
}

function mergeConsecutive(messages: APIMessage[]): APIMessage[] {
  if (messages.length <= 1) return messages;
  const out: APIMessage[] = [messages[0]];
  for (let i = 1; i < messages.length; i++) {
    const prev = out[out.length - 1];
    const curr = messages[i];
    if (prev.role === curr.role) {
      prev.content = `${asString(prev.content as InternalContent)}\n${asString(curr.content as InternalContent)}`;
    } else {
      out.push(curr);
    }
  }
  return out;
}

// ============ 系统提示词构建（吸收 CLI 版 buildSystemPrompt） ============

export function buildSystemPrompt({
  basePrompt,
  toolDefinitions,
  skills = [],
  agents = [],
  subagents = [],
}: {
  basePrompt?: string;
  toolDefinitions: Array<{ name: string; description: string }>;
  skills?: Array<{ name: string; description: string; category?: string }>;
  agents?: Array<{ name: string; description: string; model?: string }>;
  subagents?: Array<{ name: string; description: string }>;
}): string {
  const parts: string[] = [];

  // 基础系统提示词
  if (basePrompt && basePrompt.trim().length > 0) {
    parts.push(basePrompt.trim());
  }

  // 工具列表
  if (toolDefinitions.length > 0) {
    parts.push('\n## 可用工具\n');
    const grouped = new Map<string, typeof toolDefinitions>();
    for (const tool of toolDefinitions) {
      const category = categorizeTool(tool.name);
      const key = category || '通用';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tool);
    }
    for (const [category, tools] of grouped) {
      parts.push(`### ${category}\n`);
      for (const tool of tools) {
        parts.push(`- **${tool.name}**: ${tool.description || '无描述'}\n`);
      }
    }
  }

  // 技能分组
  if (skills.length > 0) {
    parts.push('\n## 可用技能（Skills）\n');
    const grouped = new Map<string, typeof skills>();
    for (const skill of skills) {
      const key = skill.category || '通用';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(skill);
    }
    for (const [category, skillList] of grouped) {
      parts.push(`### ${category}\n`);
      for (const skill of skillList) {
        parts.push(`- **${skill.name}**: ${skill.description || '无描述'}\n`);
      }
    }
  }

  // 智能体配置
  if (agents.length > 0) {
    parts.push('\n## 智能体配置（Agents）\n');
    for (const agent of agents) {
      parts.push(`- **${agent.name}**: ${agent.description || '无描述'}${agent.model ? ` (模型: ${agent.model})` : ''}\n`);
    }
  }

  // 子代理配置
  if (subagents.length > 0) {
    parts.push('\n## 子代理配置（Subagents）\n');
    for (const sub of subagents) {
      parts.push(`- **${sub.name}**: ${sub.description || '无描述'}\n`);
    }
  }

  // 通用行为准则
  parts.push('\n## 行为准则\n');
  parts.push('1. 始终使用中文回复，除非用户明确要求使用其他语言。\n');
  parts.push('2. 所有工具执行结果、代码注释和解释都应为中文。\n');
  parts.push('3. 当遇到不确定的情况时，请向用户询问确认。\n');
  parts.push('4. 工具调用失败时，请分析错误原因并尝试替代方案。\n');

  return parts.join('');
}

function categorizeTool(toolName: string): string {
  const fileTools = ['read_file', 'write_file', 'edit', 'glob', 'grep', 'ls', 'dir', 'find', 'findstr'];
  const shellTools = ['bash', 'shell', 'command', 'terminal', 'powershell'];
  const webTools = ['web_search', 'web_fetch', 'http'];
  const gitTools = ['git', 'branch', 'commit', 'diff', 'log'];
  const systemTools = ['system', 'process', 'env', 'config'];

  const lower = toolName.toLowerCase();
  if (fileTools.some(t => lower.includes(t))) return '文件操作';
  if (shellTools.some(t => lower.includes(t))) return '终端命令';
  if (webTools.some(t => lower.includes(t))) return '网络工具';
  if (gitTools.some(t => lower.includes(t))) return '版本控制';
  if (systemTools.some(t => lower.includes(t))) return '系统管理';
  return '通用工具';
}
