/**
 * engine/messageNormalizer.ts — 消息规范化器（文档 02 §4.2）
 *
 * 将内部消息格式转换为 Anthropic / OpenAI 所需格式，合并连续相同角色消息。
 */
export type InternalRole = "system" | "user" | "assistant" | "tool";
export type InternalContent = string | Array<Record<string, unknown>>;

export interface InternalMessage {
  role: InternalRole;
  content: InternalContent;
  toolUseId?: string;
}

export type APIMessage = { role: string; content: unknown; [k: string]: unknown };

export class MessageNormalizer {
  normalize(messages: InternalMessage[], provider: "anthropic" | "openai" | "google" | "azure" | "bedrock" | "vertexai" | "copilot" | "groq" | "openrouter" | "local" | "xai"): APIMessage[] {
    return provider === "anthropic"
      ? this.normalizeForAnthropic(messages)
      : this.normalizeForOpenAI(messages);
  }

  private normalizeForAnthropic(messages: InternalMessage[]): APIMessage[] {
    const result: APIMessage[] = [];
    for (const msg of messages) {
      if (msg.role === "system") continue; // Anthropic system 单独处理
      if (msg.role === "user") {
        result.push({ role: "user", content: this.asStringOrArray(msg.content) });
      } else if (msg.role === "assistant") {
        result.push({ role: "assistant", content: this.asStringOrArray(msg.content) });
      } else if (msg.role === "tool" && msg.toolUseId) {
        result.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: msg.toolUseId, content: this.asString(msg.content) }],
        });
      }
    }
    // mergeConsecutive 是静态方法，必须经由类名调用。
    // 原代码写 `this.mergeConsecutive(...)`，实例上并不存在该属性，
    // 任何需要合并的消息序列都会抛 TypeError —— 这也是 Anthropic
    // 分支此前完全不工作的原因之一。
    return MessageNormalizer.mergeConsecutive(result);
  }

  private normalizeForOpenAI(messages: InternalMessage[]): APIMessage[] {
    const result: APIMessage[] = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        result.push({ role: "system", content: this.asString(msg.content) });
      } else if (msg.role === "user") {
        result.push({ role: "user", content: this.asString(msg.content) });
      } else if (msg.role === "assistant") {
        const blocks = Array.isArray(msg.content) ? (msg.content as Array<Record<string, unknown>>) : [];
        const textParts: string[] = [];
        const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
        for (const block of blocks) {
          if (block.type === "text" && typeof block.text === "string") {
            textParts.push(block.text);
          } else if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id as string,
              type: "function",
              function: {
                name: block.name as string,
                arguments: JSON.stringify(block.input ?? {}),
              },
            });
          }
        }
        const openAIMsg: APIMessage = {
          role: "assistant",
          content: textParts.length > 0 ? textParts.join("") : "",
        };
        if (toolCalls.length > 0) {
          openAIMsg.tool_calls = toolCalls;
        }
        result.push(openAIMsg);
      } else if (msg.role === "tool" && msg.toolUseId) {
        result.push({ role: "tool", tool_call_id: msg.toolUseId, content: this.asString(msg.content) });
      }
    }
    return result;
  }

  private asString(c: InternalContent): string {
    if (typeof c === "string") return c;
    try {
      return JSON.stringify(c);
    } catch {
      return String(c);
    }
  }

  private asStringOrArray(c: InternalContent): unknown {
    return typeof c === "string" ? c : c;
  }

  /**
   * 合并连续相同角色的消息（供 messages.ts 复用）。
   *
   * 关键约束：当两条消息的 content **都是内容块数组**（Anthropic 的
   * `tool_result` / `text` 块）时必须拼成数组，绝不能各自 JSON.stringify 后
   * 当字符串相接 —— 那会把 `tool_result` 结构降级为纯文本，Anthropic 收到后
   * 认为 assistant 的 `tool_use` 没有配对结果，直接返回 400
   * （"tool_use ids were found without tool_result blocks"）。
   *
   * 并行工具调用时每条 tool 消息各产出一条 role='user' 的消息，必然触发合并，
   * 所以这条路径是常态而非边界情况。
   */
  static mergeConsecutive(messages: APIMessage[]): APIMessage[] {
    if (messages.length <= 1) return messages;
    const out: APIMessage[] = [{ ...messages[0] }];
    for (let i = 1; i < messages.length; i++) {
      const prev = out[out.length - 1];
      const curr = messages[i];
      if (prev.role === curr.role) {
        // 数组 + 数组 → 数组合并（保结构）
        if (Array.isArray(prev.content) && Array.isArray(curr.content)) {
          prev.content = [...prev.content, ...curr.content];
          continue;
        }
        // 字符串 + 字符串 → 直接换行拼接
        if (typeof prev.content === 'string' && typeof curr.content === 'string') {
          prev.content = `${prev.content}\n${curr.content}`;
          continue;
        }
        // 类型不一致：把字符串一侧包成 text 块，仍保持数组形态，
        // 避免出现「数组被 stringify 成字符串」的降级。
        const toBlocks = (c: unknown): Array<Record<string, unknown>> => {
          if (Array.isArray(c)) return c as Array<Record<string, unknown>>;
          if (typeof c === 'string') return [{ type: 'text', text: c }];
          return [{ type: 'text', text: safeStringify(c) }];
        };
        prev.content = [...toBlocks(prev.content), ...toBlocks(curr.content)];
      } else {
        out.push({ ...curr });
      }
    }
    return out;
  }
}

function safeStringify(c: unknown): string {
  if (typeof c === 'string') return c;
  try {
    return JSON.stringify(c);
  } catch {
    return String(c);
  }
}