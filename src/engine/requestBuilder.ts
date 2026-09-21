/**
 * engine/requestBuilder.ts — 请求构建器（文档 02 §4.3）
 *
 * 组装系统提示词、规范化消息、工具定义、模型参数，输出 Anthropic/OpenAI 请求。
 */
import { MessageNormalizer, type InternalMessage } from "./messageNormalizer.ts";
import { ensureToolResultPairing } from "./messageIntegrity.ts";
import { applyImageBudget, type ImageBudgetOptions } from "./imageBudget.ts";
import {
  createContentReplacementState,
  enforceToolResultBudget,
  type ContentReplacementState,
} from "./toolResultStore.ts";
import { HarnessRouter, type HarnessAdapter, type HarnessConfig } from "./harnessAdapter.ts";
export type { HarnessConfig } from "./harnessAdapter.ts";

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
  /** Harness 模型适配配置 */
  harness?: HarnessConfig;
  /** 图片预算：超限的历史图片会被替换为占位文本 */
  imageBudget?: ImageBudgetOptions;
  /**
   * 会话 id。**不随请求发给模型**，只在本进程内向下游透传：
   * 工具分层暴露（buildToolContext）按会话维护活跃集与 LRU，
   * 缺了它就只能退化成全局 'default'，多会话会互相污染。
   */
  sessionId?: string;
}

/**
 * 旧版 CLI 兼容的「工具集合」类型。
 *
 * `engine/index.ts` 里有一处 `tools: [] as Tools`，而 `Tools` 从未定义。
 * 保留该名字以兼容既有写法：它表示「工具名到工具实现的映射」的宽松形态。
 * 注：这是**遗留兼容类型**，新代码请用 `Map<string, Tool>`。
 */
export type Tools = Map<string, unknown> | unknown[]

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
  /**
   * 会话 id，仅供本进程内的下游（工具分层暴露）使用，
   * **发送请求前必须剔除**（它不是任何 API 的合法字段）。
   */
  sessionId?: string;
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
  /** Harness 路由器（吸收自 open-interpreter harness 系统） */
  private harnessRouter = new HarnessRouter();

  /**
   * 注入自定义 Harness 适配器（供插件/技能扩展 provider 格式转换）。
   */
  registerHarnessAdapter(adapter: HarnessAdapter): void {
    this.harnessRouter.register(adapter)
  }

  /**
   * 列出所有已注册的 Harness provider。
   */
  listHarnessProviders(): string[] {
    return this.harnessRouter.listProviders()
  }
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

    // 配对修复后的**诊断**（只报告、不修改消息）。
    //
    // `ensureToolResultPairing` 的策略是「剥离 / 补占位」，它**不检测也不处理
    // 顺序类问题**：result 出现在 call 之前、result 未紧跟 call、重复 result。
    // 这些情况经修复后通常能发出请求，但模型看到的历史顺序是乱的，
    // 表现为"工具结果对不上号"，很难从现象反推原因。
    //
    // 刻意不自动修：顺序修复靠**重排消息**，会打乱对话时序，风险高于收益。
    // 先把问题暴露出来（需 KX2_DEBUG_INTEGRITY=1），需要时再决定是否动手。
    if (process.env.KX2_DEBUG_INTEGRITY === '1') {
      void import('./tool-history-guard/validate.ts')
        .then(({ validateToolHistory }) => {
          // 必须传自定义 adapter：项目**内部**统一用 `toolUseId`
          // （见 messageNormalizer.ts:32），而默认 adapter 期望的是**外部格式**
          // `tool_call_id` / `tool_use_id`。不传会把每条正常的工具结果都误报成
          // malformed —— 诊断本身必须对准项目方言，否则产生的全是噪声。
          const internalAdapter = {
            getToolCalls: (m: { content?: unknown }) => {
              const out: Array<{ id: string | null; rawId: unknown }> = []
              if (Array.isArray(m?.content)) {
                for (const b of m.content as Array<Record<string, unknown>>) {
                  if (b && b.type === 'tool_use' && typeof b.id === 'string') {
                    out.push({ id: b.id, rawId: b.id })
                  }
                }
              }
              return out
            },
            getToolResults: (m: { role?: string; toolUseId?: unknown }) => {
              if (m?.role !== 'tool') return []
              const id = typeof m.toolUseId === 'string' ? m.toolUseId : null
              return [{ id, rawId: m.toolUseId }]
            },
          }
          const res = validateToolHistory(paired as never, {
            adapter: internalAdapter as never,
          })
          if (!res.valid && res.errors.length > 0) {
            console.warn(
              `[RequestBuilder] 工具历史校验发现 ${res.errors.length} 处问题：` +
                res.errors.map(e => `${e.code}@${e.index}`).join(', '),
            )
          }
        })
        .catch(() => {
          /* 诊断失败不影响请求 */
        })
    }

    // 单轮聚合预算：N 个并行工具各自未超单结果阈值，但总和仍可能挤爆上下文。
    // 放在配对修复之后 —— 它只替换内容不改结构，不会破坏配对。
    const budgeted = await enforceToolResultBudget(paired, this.replacementState);
    // 图片预算：base64 图片会永久驻留历史且无法被摘要压缩，
    // 几张截图就能堆出几十万 token。在发请求前把超预算的老图替换为占位文本。
    // 同样放在配对修复之后 —— 它只替换块内容，不改消息结构。
    const imageBudgeted = params.imageBudget
      ? applyImageBudget(budgeted, params.imageBudget)
      : { messages: budgeted, elidedImages: 0, elidedTokens: 0 };
    if (imageBudgeted.elidedImages > 0) {
      console.log(
        `[RequestBuilder] 图片预算：移除 ${imageBudgeted.elidedImages} 张历史图片（约 ${imageBudgeted.elidedTokens} tokens）`,
      );
    }
    const messages = this.normalizer.normalize(imageBudgeted.messages, provider);

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

    // 构建基础请求
    let request: APIRequest
    if (provider === "anthropic") {
      request = {
        provider,
        system: systemPrompt,
        messages,
        tools: params.tools,
        ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        ...modelParams,
      };
    } else {
      // 除 Anthropic 外，所有 provider 一律按 OpenAI 兼容格式发送。
      // 本项目接入的第三方网关（含 Gemini/Vertex 的兼容端点）均提供
      // OpenAI 兼容接口，无需为各家单独适配工具 schema。
      request = {
        provider,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: this.convertToolsForOpenAI(params.tools),
        ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        ...modelParams,
      };
    }

    // Harness 适配：通过 provider-specific adapter 转换请求格式（吸收自 open-interpreter harness）
    if (params.harness) {
      const adapter = this.harnessRouter.getAdapter(params.harness)
      request = adapter.adaptRequest(request)
    }

    return request
  }

  private convertToolsForOpenAI(tools: ToolDefinition[]): unknown {
    return tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }
}