/**
 * engine/subagent/subAgentManager.ts — 子代理管理器（文档 02 §10.2）
 *
 * 创建**隔离**的查询引擎实例、并发控制、聚合结果、终止代理。
 *
 * 「隔离」的实现：每个子代理的引擎由 `engineFactory`（或缺省 `new QueryEngine`）
 * 创建，拥有**独立的对话上下文**（不读写父会话）、自己的 model/systemPrompt/maxTokens，
 * 并按 `allowedTools` 过滤工具集 —— 子代理运行不会污染主对话。
 */
import { predefinedAgents, type SubAgentConfig } from "./config.ts";
// 仅类型引用，避免与 index.ts 形成运行时循环（index.ts import 本模块）。
import type { QueryEngine, EngineOptions } from "../index.ts";

/** QueryEngine 构造器签名（由 index.ts 通过 provideEngineConstructor 注入默认实现） */
export type QueryEngineConstructor = new (opts: EngineOptions) => QueryEngine;

/** 全局默认引擎构造器；由 index.ts 装配时注入（延迟注入避免循环） */
let defaultEngineCtor: QueryEngineConstructor | null = null;
export function provideEngineConstructor(ctor: QueryEngineConstructor): void {
  defaultEngineCtor = ctor;
}

export interface SubAgentEngine {
  query: (input: string) => Promise<{ messages: { content?: string }[]; tokenUsage: unknown }>;
  abort: () => Promise<void>;
}

export type IsolatedEngineFactory = (opts: {
  model: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  allowedTools?: string[];
  parentModel?: string;
}) => QueryEngine;

export interface SubAgentInstance {
  id: string;
  agentName: string;
  engine: SubAgentEngine;
  startTime: Date;
  status: "running" | "completed" | "failed" | "terminated";
}

export interface ExecuteSubAgentParams {
  id: string;
  agentName: string;
  input: string;
  context?: string;
  maxTokens?: number;
  parentModel?: string;
}

/** 子代理默认最大并发数 */
export const DEFAULT_MAX_CONCURRENT_AGENTS = 5

export class SubAgentManager {
  private registry = new Map<string, SubAgentConfig>();
  private instances = new Map<string, SubAgentInstance>();
  private maxConcurrentAgents = DEFAULT_MAX_CONCURRENT_AGENTS;
  private activeAgents = 0;
  /** 隔离引擎工厂；缺省用 `new QueryEngine`（无 apiClient 时仅可构造） */
  private engineFactory: IsolatedEngineFactory | null = null;

  constructor(maxConcurrent?: number, engineFactory?: IsolatedEngineFactory) {
    for (const [name, cfg] of Object.entries(predefinedAgents)) this.registry.set(name, cfg);
    this.setMaxConcurrentAgents(maxConcurrent);
    if (engineFactory) this.engineFactory = engineFactory;
  }

  /**
   * 注入隔离引擎工厂。
   *
   * 上层（拥有真实模型 apiClient 的地方）用它创建带 apiClient 的真隔离引擎；
   * 缺省内部用 `new QueryEngine`（可用于纯构造/离线测试）。缺省生成 + 未注入
   * apiClient 时，子引擎 query 不会真的跑模型 —— 调用方需保证注入后再 execute。
   */
  setEngineFactory(factory: IsolatedEngineFactory): void {
    this.engineFactory = factory;
  }

  /**
   * 设置最大并发子代理数（设置界面改完即时生效）。
   * 超过上限的请求会被直接拒绝并返回错误，因此该值直接决定
   * 「并发任务能否启动」，属于影响走向的关键参数。
   */
  setMaxConcurrentAgents(n?: number | void): void {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
      this.maxConcurrentAgents = Math.floor(n);
    }
  }

  /** 当前最大并发数与运行中数量（供 UI 展示与诊断） */
  getConcurrencyInfo(): { max: number; active: number } {
    return { max: this.maxConcurrentAgents, active: this.activeAgents };
  }

  register(config: SubAgentConfig): void {
    this.registry.set(config.name, config);
  }

  async execute(params: ExecuteSubAgentParams): Promise<{
    success: boolean;
    output?: string;
    tokenUsage?: unknown;
    duration: number;
    error?: string;
  }> {
    const config = this.registry.get(params.agentName);
    if (!config) return { success: false, error: `Sub-agent not found: ${params.agentName}`, duration: 0 };
    if (this.activeAgents >= this.maxConcurrentAgents) {
      return { success: false, error: "Maximum concurrent agents reached", duration: 0 };
    }
    this.activeAgents++;
    const startTime = new Date();
    const instance: SubAgentInstance = {
      id: params.id,
      agentName: params.agentName,
      engine: this.createQueryEngine(config, params),
      startTime,
      status: "running",
    };
    this.instances.set(params.id, instance);
    try {
      const result = await instance.engine.query(params.input);
      instance.status = "completed";
      return {
        success: true,
        output: result.messages[result.messages.length - 1]?.content ?? "",
        tokenUsage: result.tokenUsage,
        duration: Date.now() - startTime.getTime(),
      };
    } catch (e) {
      instance.status = "failed";
      return { success: false, error: e instanceof Error ? e.message : String(e), duration: Date.now() - startTime.getTime() };
    } finally {
      this.activeAgents--;
      this.instances.delete(params.id);
    }
  }

  private createQueryEngine(
    config: SubAgentConfig,
    params: ExecuteSubAgentParams,
  ): SubAgentInstance["engine"] {
    const model = config.model ?? params.parentModel ?? "default-subagent-model";
    const maxTokens = params.maxTokens ?? config.maxTokens ?? 4000;
    // 引擎工厂：缺省用注入的 QueryEngine 构造器（index.ts 装配时 provideEngineConstructor）；
    // 上层也可 setEngineFactory 注入带真实 apiClient 的工厂。allowedTools 透传给工厂，
    // 工具集过滤是隔离上下文的一部分，由工厂按它裁剪。
    const factory =
      this.engineFactory ??
      ((o) => {
        if (!defaultEngineCtor) {
          throw new Error(
            "SubAgentManager: 未注入 QueryEngine 构造器（需先 provideEngineConstructor 或 setEngineFactory）",
          );
        }
        return new defaultEngineCtor({ model: o.model, systemPrompt: o.systemPrompt, maxOutputTokens: o.maxOutputTokens });
      });
    const engine = factory({
      model,
      systemPrompt: config.systemPrompt,
      maxOutputTokens: maxTokens,
      allowedTools: config.allowedTools,
      parentModel: params.parentModel,
    });
    return {
      async query(input: string) {
        const result = await engine.query(input);
        return {
          messages: result.messages.map(m => ({
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
          })) as { content?: string }[],
          tokenUsage: result.tokenUsage,
        };
      },
      async abort() {
        try { await engine.abort(); } catch { /* 终止失败忽略 */ }
      },
    };
  }

  getActiveAgents(): SubAgentInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.status === "running");
  }

  async terminate(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = "terminated";
      await instance.engine.abort();
      this.instances.delete(instanceId);
      this.activeAgents--;
    }
  }
}