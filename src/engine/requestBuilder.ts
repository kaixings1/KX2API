/**
 * engine/requestBuilder.ts — 请求构建器（文档 02 §4.3）
 *
 * 组装系统提示词、规范化消息、工具定义、模型参数，输出 Anthropic/OpenAI 请求。
 */
import { MessageNormalizer, type InternalMessage } from "./messageNormalizer.ts";
import { ensureToolResultPairing } from "./messageIntegrity.ts";
import {
  createContentReplacementState,
  enforceToolResultBudget,
  type ContentReplacementState,
} from "./toolResultStore.ts";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface RequestParams {
  messages: InternalMessage[];
  system: string;
  tools: ToolDefinition[];
  model: string;
  maxTokens: number;
  provider?: "anthropic" | "openai" | "google" | "azure" | "bedrock" | "vertexai" | "copilot" | "groq" | "openrouter" | "local" | "xai";
  temperature?: number;
  stream?: boolean;
  /** 预测性 AI 助手：当前文件的静态分析建议 */
  preAnalysis?: Array<{ type: string; message: string; line?: number }>;
}

export interface APIRequest {
  provider: "anthropic" | "openai" | "google" | "azure" | "bedrock" | "vertexai" | "copilot" | "groq" | "openrouter" | "local" | "xai";
  system?: string;
  messages: { role: string; content: unknown }[];
  tools?: unknown;
  model: string;
  max_tokens: number;
  temperature: number;
  stream: boolean;
  /**
   * Provider-specific extra fields (e.g. reasoning params for Google, deployment for Azure).
   * 对齐 OpenCode (Go) 的 Model.Provider 字段。
   */
  extra?: Record<string, unknown>;
}

/**
 * 模型元信息，对齐 OpenCode (Go) 的 models.Model 结构。
 * 用于成本追踪、上下文窗口管理、provider 自动识别。
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: APIRequest["provider"];
  contextWindow: number;
  defaultMaxTokens: number;
  supportsReasoning?: boolean;
  supportsAttachments?: boolean;
  /** USD per 1M input tokens, 0 if unknown */
  costPer1MIn?: number;
  /** USD per 1M output tokens, 0 if unknown */
  costPer1MOut?: number;
}

export class RequestBuilder {
  private normalizer = new MessageNormalizer();
  /**
   * 工具结果替换决策状态（跨轮次复用同一个实例）。
   *
   * 必须复用而非每轮新建：一旦某结果被决策为「替换」或「不替换」，
   * 后续轮次必须保持一致，否则替换集合每轮变化会导致 prompt cache 全量失效。
   */
  private replacementState: ContentReplacementState = createContentReplacementState();

  /** 重置替换状态（新会话/清空历史时调用） */
  resetReplacementState(): void {
    this.replacementState = createContentReplacementState();
  }

  async build(params: RequestParams): Promise<APIRequest> {
    const provider = params.provider ?? "openai";
    // 发请求前的最后一道防线：修复 tool_use / tool_result 配对。
    // 压缩、会话恢复、中断都可能留下孤立 tool_result 或缺失结果，
    // 这两种情况下 Anthropic / OpenAI 都会直接 400，整轮对话无法继续。
    const paired = ensureToolResultPairing(params.messages);
    // 单轮聚合预算：N 个并行工具各自未超单结果阈值，但总和仍可能挤爆上下文。
    // 放在配对修复之后 —— 它只替换内容不改结构，不会破坏配对。
    const budgeted = await enforceToolResultBudget(paired, this.replacementState);
    const messages = this.normalizer.normalize(budgeted, provider);

    // Phase 2: 注入 preAnalysis 建议到 system prompt
    let systemPrompt = params.system
    if (params.preAnalysis && params.preAnalysis.length > 0) {
      const suggestions = params.preAnalysis.map(s => `[${s.type}] L${s.line ?? '?'}: ${s.message}`).join('\n')
      systemPrompt = `${params.system}\n\n[预测性建议]\n${suggestions}\n`
    }

    const modelParams = {
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 0,
      stream: params.stream ?? true,
    };

    if (provider === "anthropic") {
      return {
        provider,
        system: systemPrompt,
        messages,
        tools: params.tools,
        ...modelParams,
      };
    }
    // 除 Anthropic 外，所有 provider 一律按 OpenAI 兼容格式发送。
    // 本项目接入的第三方网关（含 Gemini/Vertex 的兼容端点）均提供
    // OpenAI 兼容接口，无需为各家单独适配工具 schema。
    return {
      provider,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: this.convertToolsForOpenAI(params.tools),
      ...modelParams,
    };
  }

  private convertToolsForOpenAI(tools: ToolDefinition[]): unknown {
    return tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }
}