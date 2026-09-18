/**
 * engine/responseHandler.ts — 响应处理器（文档 02 §5.1）
 *
 * 解析流式响应、检测工具调用、聚合内容、判断是否需要用户输入。
 */
import { StreamProcessor, preAnalysis, type PreAnalysisSuggestion } from "./streaming/streamProcessor.ts";
import { extractPlainTextToolCalls, parsePlainTextToolCalls, stripPlainTextToolCalls, type PlainTextToolCallBlock } from "../utils/plainTextToolCallRepair.ts";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requiresAuthorization?: boolean;
}

export interface ProcessedResponse {
  content: unknown;
  toolCalls: ToolCall[];
  stopReason: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  needsUserInput: boolean;
}

export interface APIEvent {
  type: string;
  [k: string]: unknown;
}

export class ResponseHandler {
  private streamProcessor = new StreamProcessor();
  /** 暂存 content_block_start 中 tool_use 块的 id/name，等 content_block_stop 时消费 */
  private pendingToolStarts = new Map<string, { id: string; name: string }>();
  onChunk?: (chunk: { type: string; text?: string }) => void;
  onReasoning?: (text: string) => void;

  /**
   * 当前生效的工具名白名单。
   *
   * 纯文本工具调用修复必须以此为准 —— 仅靠「名字长得像命令」的形状校验，
   * 会把接口文档/示例代码里的 `<name>get_user</name>`、`[tool:bash]` 也
   * 当成工具调用，进而把这段正文整块剥离（内容静默消失，比误转换更隐蔽）。
   */
  allowedToolNames: ReadonlySet<string> | null = null

  async handle(stream: AsyncIterable<APIEvent>): Promise<ProcessedResponse> {
    const reqId = `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    console.log(`[RESP-HANDLER] handle START reqId=${reqId}`)
    const chunks: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] = [];
    const toolCalls: ToolCall[] = [];
    let stopReason: string | null = null;
    let model: string | null = null;
    let usage: { inputTokens: number; outputTokens: number } | null = null;

    for await (const event of stream) {
      const processed = this.streamProcessor.process(event);
      switch (processed.type) {
        case "content_block_start":
          // content_block_start 事件携带 tool_use 块的 id/name/input（一次性）；
          // 这些信息在后续 content_block_stop 时可能被清空（StreamProcessor 在 stop 时
          // 把 currentBlock 置 null），所以必须在 start 阶段就暂存下来。
          if (processed.block && processed.block.type === "tool_use") {
            const id = processed.block.id ?? '';
            const name = processed.block.name ?? '';
            if (id || name) {
              // 暂存到 pending 集合，等 content_block_stop 时消费
              this.pendingToolStarts.set(id, { id, name: name });
              console.log(`[RESP-HANDLER] content_block_start tool_use id=${id} name=${name}`);
            }
          }
          break;
        case "content_block_delta":
          if (processed.chunk) {
            chunks.push(processed.chunk);
            if (this.onChunk) this.onChunk(processed.chunk);
          }
          break;
        case "content_block_stop":
          if (processed.block && (processed.block.type === "thinking" || processed.block.type === "reasoning")) {
            // 推理块聚合后旁路透传，不进入 chunks（避免污染正文聚合）
            if (processed.block.text && this.onReasoning) {
              this.onReasoning(processed.block.text);
            }
          }
          if (processed.block && processed.block.type === "tool_use") {
            // 优先使用 content_block_start 时暂存的 id/name（start 事件携带的
            // 信息在 StreamProcessor 处理 stop 时 currentBlock 已被置 null，
            // 所以 block.id/block.name 可能为空）。
            const stored = processed.block.id ? this.pendingToolStarts.get(processed.block.id) : null;
            this.pendingToolStarts.delete(processed.block.id ?? '');
            const resolvedId = stored?.id ?? processed.block.id ?? '';
            const resolvedName = stored?.name ?? processed.block.name ?? '';
            toolCalls.push({
              id: resolvedId,
              name: resolvedName,
              input:
              processed.block.input != null &&
              typeof processed.block.input === 'object'
                ? processed.block.input
                : {},
            });
          }
          break;
        case "message_delta":
          if (processed.stopReason) stopReason = processed.stopReason;
          if (processed.usage) usage = processed.usage;
          break;
        case "message_start":
          if (processed.model) model = processed.model;
          break;
        case "error":
          throw new Error(`API error: ${JSON.stringify(processed.error)}`);
      }
    }

    let fullContent = this.aggregateContent(chunks);

    // 修复纯文本工具调用：某些模型将工具调用以 XML/纯文本形式写入响应内容
    // 而非使用结构化 tool_use block，此处检测并转换。
    // 支持两种形态：
    //   1) 整段文本 100% 是工具调用 -> parsePlainTextToolCalls，正文清空
    //   2) 工具调用与正文混杂 -> extractPlainTextToolCalls 提取 + strip 剥离
    if (toolCalls.length === 0) {
      console.log(`[RESP-HANDLER] no structured tool_calls, attempting plain-text repair. contentLen=${fullContent.length} preview="${fullContent.slice(0, 300)}"`)
      let converted = 0;
      const seen = new Set<string>();
      const pushBlocks = (blocks: PlainTextToolCallBlock[]) => {
        for (const block of blocks) {
          // 将参数值转换为字符串（工具执行器期望字符串类型）
          const stringArgs: Record<string, string> = {};
          for (const [key, val] of Object.entries(block.arguments)) {
            stringArgs[key] = typeof val === 'string' ? val : JSON.stringify(val);
          }
          // 去重：同一轮 text 里反复出现的「同名 + 同参数」调用（模型常把同一 JSON 重复写多遍）
          // 只保留第一个，避免同一次响应被拆成 N 个相同工具调用全部执行，造成重复执行 / 死循环。
          const sig = block.name + ':' + JSON.stringify(stringArgs);
          if (seen.has(sig)) {
            console.log(`[RESP-HANDLER] 去重纯文本工具调用: ${sig}`);
            continue;
          }
          seen.add(sig);
          toolCalls.push({
            id: `toolu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: block.name,
            input: stringArgs,
          });
          converted++;
        }
      };

      const allowed = this.allowedToolNames;
      if (allowed && allowed.size === 0) {
        // 白名单为空 = 本轮没有可用工具，不存在合法的纯文本工具调用，
        // 一律不修复，原样保留正文（避免把文档示例当工具吞掉）。
        console.log('[RESP-HANDLER] 生效工具集为空，跳过纯文本工具调用修复')
      } else {
        // 情形 1：整段纯工具调用
        const parsedBlocks = parsePlainTextToolCalls(fullContent, allowed);
        if (parsedBlocks && parsedBlocks.length > 0) {
          // 清空正文前把原文样本写进日志，便于事后追查「答复为什么是空的」
          console.log(
            `[RESP-HANDLER] 整段判定为纯工具调用，清空正文 ${fullContent.length} 字符 → ${parsedBlocks.length} 个调用 | ` +
            `原文样本: ${JSON.stringify(fullContent.slice(0, 300))}`,
          )
          pushBlocks(parsedBlocks);
          fullContent = "";
        } else {
          // 情形 2：与正文混杂，仅剥离工具块、保留说明文字
          const mixedBlocks = extractPlainTextToolCalls(fullContent, allowed);
          if (mixedBlocks.length > 0) {
            const stripped = stripPlainTextToolCalls(fullContent, allowed);
            // 剥离占比过高说明剥离范围可疑（正常混杂场景正文应占大头）。
            // 此时保留更保守的结果：只接受一次工具调用，正文用剥离后的内容；
            // 若剥离后正文完全为空，则丢弃本次提取并保留原文 —— 宁可少执行一次
            // 工具，也不能让用户看到空白答复。
            if (!stripped.trim()) {
              // 剥离后正文全空 → 判定为过宽剥离，本次不修复、原样保留正文
              console.warn(
                `[RESP-HANDLER] 剥离后正文为空（涉及 ${mixedBlocks.length} 个块），判定为过宽剥离，已回退保留原文`,
              );
            } else {
              const removedRatio = 1 - stripped.length / Math.max(fullContent.length, 1);
              if (removedRatio > 0.9) {
                console.warn(
                  `[RESP-HANDLER] 剥离占比 ${(removedRatio * 100).toFixed(1)}%，范围偏大，已记录待查`,
                );
              }
              pushBlocks(mixedBlocks);
              fullContent = stripped;
            }
          }
        }
      }

      if (converted > 0) {
        console.log(`[RESP-HANDLER] 修复了 ${converted} 个纯文本工具调用`);
      }
    }

    console.log(`[RESP-HANDLER] handle END reqId=${reqId} contentLen=${fullContent.length} toolCalls=${toolCalls.length} chunks=${chunks.length}`)
    return {
      content: fullContent,
      toolCalls,
      stopReason: stopReason ?? "end_turn",
      model: model ?? "unknown",
      usage: usage ?? { inputTokens: 0, outputTokens: 0 },
      needsUserInput: this.checkNeedsUserInput(fullContent, toolCalls),
    };
  }

  private aggregateContent(
    chunks: { type: string; text?: string }[],
  ): string {
    const textChunks = chunks.filter((c) => c.type === "text" && c.text != null)
    console.log(`[RESP-HANDLER] aggregateContent: totalChunks=${chunks.length} textChunks=${textChunks.length} totalLen=${textChunks.reduce((s, c) => s + (c.text?.length || 0), 0)}`)
    return textChunks.map((c) => c.text as string).join("")
  }

  private checkNeedsUserInput(content: unknown, toolCalls: ToolCall[]): boolean {
    if (toolCalls.some((c) => c.requiresAuthorization)) return true;
    if (typeof content !== "string") return false;
    const text = content.trim();
    if (!text) return false;
    // 双重收紧，避免把普通答复误判成「在等用户回答」：
    // 1. 必须是收尾提问（以问号结尾）。原实现用 \b 做锚定，但中文不属于 \w，
    //    词边界对 CJK 完全失效，等于无锚定的全文匹配。
    // 2. 且末段必须出现明确的征询措辞。像「继续」「确认」这类词在正常正文里
    //    极其常见（"接下来继续修改…"），命中即判会让引擎误以为在等用户输入。
    if (!/[？?]\s*$/.test(text)) return false;
    const tail = text.slice(-80);
    return /(请问|请确认|是否(要|需要|继续|可以)|需要我|要我|确认后|可以吗|要吗|好吗)/.test(tail);
  }
}