/**
 * engine/subagent/subAgentManager.ts — 子代理管理器（文档 02 §10.2）
 *
 * 创建隔离的查询引擎实例、并发控制、聚合结果、终止代理。
 *
 * 「隔离」的实现：每个子代理的引擎由 `engineFactory`（或缺省 `new QueryEngine`）
 * 创建，拥有独立的对话上下文（不读写父会话）、自己的 model/systemPrompt/maxTokens，
 * 并按 `allowedTools` 过滤工具集 — 子代理运行不会污染主对话。
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

/**
 * SubAgentEvent — 子代理生命周期事件（对齐 OpenCode AgentEvent）
 */
export type SubAgentEvent =
  | { type: 'start'; agentName: string; instanceId: string }
  | { type: 'iteration'; agentName: string; instanceId: string; iteration: number }
  | { type: 'tool_call'; agentName: string; instanceId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; agentName: string; instanceId: string; toolName: string; isError: boolean }
  | { type: 'complete'; agentName: string; instanceId: string; output: string; duration: number }
  | { type: 'fail'; agentName: string; instanceId: string; error: string; duration: number }
  | { type: 'abort'; agentName: string; instanceId: string }

export interface SubAgentManagerDeps {
  onEvent?: (event: SubAgentEvent) => void;
  /** 追踪数据持久化回调：将子代理 trace 记录写入外部存储 */
  onTracePersist?: (record: {
    traceId: string;
    agentName: string;
    input: string;
    output?: string;
    error?: string;
    toolCalls: string[];
    startTime: number;
    endTime: number;
  }) => void;
}

/** 子代理默认并发上限（此前硬编码在类字段里，现可运行时调整） */
export const DEFAULT_MAX_CONCURRENT_AGENTS = 5

/** 归一化并发上限：非有限值或小于 1 时回落默认 */
function normalizeMaxConcurrent(n: number): number {
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_CONCURRENT_AGENTS
  return Math.floor(n)
}

export class SubAgentManager {
  private registry = new Map<string, SubAgentConfig>();
  private instances = new Map<string, SubAgentInstance>();
  private maxConcurrentAgents = DEFAULT_MAX_CONCURRENT_AGENTS;
  private activeAgents = 0;
  private deps: SubAgentManagerDeps = {};
  /** 子引擎工厂：由外部注入真实的引擎装配（缺省回落到 defaultEngineCtor / 隔离桩） */
  private engineFactory: IsolatedEngineFactory | null = null;

  /**
   * @param maxOrDeps 并发上限（数字）或依赖注入对象。
   *   传数字是为了让「并发上限」可注入（测试与运行时配置都走这个入口）；
   *   非法值（0、负数、NaN）回落到默认，避免把并发闸门设成 0 导致全部任务被拒。
   * @param factory 子引擎工厂（可选）。缺省时回落到全局默认构造器 / 隔离桩。
   */
  constructor(maxOrDeps?: number | SubAgentManagerDeps, factory?: IsolatedEngineFactory) {
    if (typeof maxOrDeps === "number") {
      this.maxConcurrentAgents = normalizeMaxConcurrent(maxOrDeps);
      this.deps = {};
    } else {
      this.deps = maxOrDeps ?? {};
    }
    if (factory) this.engineFactory = factory;
    for (const [name, cfg] of Object.entries(predefinedAgents)) {
      this.registry.set(name, cfg);
    }
  }

  /**
   * 运行时更新并发上限（设置界面改完即时生效）。
   * 非法值不改变既有设置 —— 静默忽略比"回落默认"更安全：
   * 用户误填 0 时不该把已经调好的 12 悄悄变回 5。
   */
  setMaxConcurrentAgents(max: number): void {
    if (!Number.isFinite(max) || max < 1) return;
    this.maxConcurrentAgents = Math.floor(max);
  }

  /** 当前并发状况（供 UI 展示与测试断言） */
  getConcurrencyInfo(): { max: number; active: number; available: number } {
    return {
      max: this.maxConcurrentAgents,
      active: this.activeAgents,
      available: Math.max(0, this.maxConcurrentAgents - this.activeAgents),
    };
  }

  /**
   * 注入子引擎工厂。
   *
   * 缺省实现只是「能构造、不能工作」——内部 createQueryEngine 返回的是隔离桩，
   * 真正的推理由调用方经此注入的工厂提供（否则子代理的 query 不会真的跑模型）。
   */
  setEngineFactory(factory: IsolatedEngineFactory): void {
    this.engineFactory = factory;
  }
  setDeps(deps: SubAgentManagerDeps): void {
    this.deps = deps;
  }

  register(config: SubAgentConfig): void {
    this.registry.set(config.name, config);
  }

  /** 获取已注册的代理配置 */
  get(name: string): SubAgentConfig | undefined {
    return this.registry.get(name);
  }

  /** 列出所有已注册代理 */
  listAll(): SubAgentConfig[] {
    return Array.from(this.registry.values());
  }

  async execute(params: ExecuteSubAgentParams): Promise<{
    success: boolean;
    output?: string;
    tokenUsage?: unknown;
    duration: number;
    error?: string;
  }> {
    const config = this.registry.get(params.agentName);
    if (!config) {
      return { success: false, error: `Sub-agent not found: ${params.agentName}`, duration: 0 };
    }
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
    this.deps.onEvent?.({ type: 'start', agentName: params.agentName, instanceId: params.id });

    let traceId: string | undefined;
    try {
      // 自进化技能树：执行前检查技能熟练度
      const skillTree = config.skillTree;
      if (skillTree && skillTree.mastered.length > 0) {
        console.log(`[SKILL_TREE] Agent ${params.agentName}: 已掌握 ${skillTree.mastered.length} 个技能`);
      }

      // Agent 执行追踪
      traceId = this.startTrace(params.agentName, params.input);

      const result = await instance.engine.query(params.input);
      instance.status = "completed";
      const duration = Date.now() - startTime.getTime();

      // 自进化技能树：成功执行后更新技能熟练度
      if (config.skillTree) {
        for (const skill of config.skillTree.mastered) {
          this.updateSkillProficiency(params.agentName, skill, true);
        }
      }

      const outputContent = result.messages[result.messages.length - 1]?.content ?? "";
      this.endTrace(traceId, outputContent);
      this.recordExperience(params.agentName, true, duration);

      // 追踪数据持久化
      if (this.deps.onTracePersist && traceId) {
        const trace = this.traceLog.find(t => t.traceId === traceId);
        if (trace) {
          this.deps.onTracePersist({
            traceId,
            agentName: params.agentName,
            input: params.input,
            output: outputContent,
            toolCalls: trace.toolCalls,
            startTime: trace.startTime,
            endTime: trace.endTime ?? Date.now(),
          });
        }
      }

      this.deps.onEvent?.({
        type: 'complete',
        agentName: params.agentName,
        instanceId: params.id,
        output: outputContent,
        duration,
      });

      return {
        success: true,
        output: outputContent,
        tokenUsage: result.tokenUsage,
        duration,
      };
    } catch (e) {
      instance.status = "failed";
      const duration = Date.now() - startTime.getTime();
      const errMsg = e instanceof Error ? e.message : String(e);
      if (traceId) this.failTrace(traceId, errMsg);
      this.recordExperience(params.agentName, false, duration);

      if (traceId && this.deps.onTracePersist) {
        const trace = this.traceLog.find(t => t.traceId === traceId);
        if (trace) {
          this.deps.onTracePersist({
            traceId,
            agentName: params.agentName,
            input: params.input,
            error: errMsg,
            toolCalls: trace.toolCalls,
            startTime: trace.startTime,
            endTime: trace.endTime ?? Date.now(),
          });
        }
      }

      this.deps.onEvent?.({
        type: 'fail',
        agentName: params.agentName,
        instanceId: params.id,
        error: errMsg,
        duration,
      });

      return { success: false, error: errMsg, duration };
    } finally {
      this.instances.delete(params.id);
      this.activeAgents--;
    }
  }

  private createQueryEngine(config: SubAgentConfig, params: ExecuteSubAgentParams): SubAgentInstance["engine"] {
    const maxTokens = params.maxTokens ?? config.maxTokens ?? 4000;

    // 优先使用外部注入的工厂：它才会把真实 apiClient 装进子引擎。
    // 次选全局默认构造器；两者都没有时，落到下面的隔离桩（仅能构造、不能推理）。
    const factory = this.engineFactory
    if (factory) {
      const engine = factory({
        model: params.parentModel ?? config.model ?? "",
        systemPrompt: config.systemPrompt,
        maxOutputTokens: maxTokens,
        allowedTools: config.allowedTools,
        parentModel: params.parentModel,
      })
      return {
        query: (input: string) => engine.query(input) as ReturnType<SubAgentEngine["query"]>,
        abort: async () => { engine.abort?.() },
      }
    }
    if (defaultEngineCtor) {
      const engine = new defaultEngineCtor({
        model: params.parentModel ?? config.model ?? "",
        systemPrompt: config.systemPrompt,
        maxOutputTokens: maxTokens,
      })
      return {
        query: (input: string) => engine.query(input) as ReturnType<SubAgentEngine["query"]>,
        abort: async () => { engine.abort?.() },
      }
    }
    // 隔离的消息历史（含系统提示），保证子代理上下文不泄漏到父会话
    const messages: Array<{ role: string; content: string }> = [];
    let aborted = false;

    // 组装系统提示（吸收自 ag2 Harness AssemblyPolicy）
    let systemPrompt = config.systemPrompt ?? '';
    if (config.assembly) {
      const parts: string[] = [];
      if (config.assembly.tools !== 'none') {
        parts.push(`可用工具: ${config.assembly.tools === 'all' ? '全部' : config.allowedTools?.join(', ') ?? '受限'}`);
      }
      if (config.assembly.knowledge === 'query_based') {
        parts.push('知识检索: 按需查询（任务需要时主动检索知识库）');
      } else if (config.assembly.knowledge === 'full') {
        parts.push('知识检索: 完整注入（所有相关知识已预加载到上下文中）');
      }
      if (config.assembly.memory === 'recent') {
        parts.push('记忆: 仅最近对话（节省上下文空间）');
      } else if (config.assembly.memory === 'full') {
        parts.push('记忆: 完整历史（包含所有相关对话上下文）');
      }
      if (config.assembly.systemPromptTemplate) {
        parts.push(`模板: ${config.assembly.systemPromptTemplate}`);
      }
      if (parts.length > 0) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n[Harness 配置]\n${parts.join('\n')}`
          : parts.join('\n');
      }
    }
    messages.push({ role: "system", content: systemPrompt });

    return {
      async query(input: string) {
        if (aborted) {
          return { messages: [{ content: "[子代理已中止]" }], tokenUsage: { maxTokens } };
        }
        messages.push({ role: "user", content: input });
        // 隔离引擎响应：真实推理由外部引擎注入
        const responseContent =
          `[${config.name}] 已收到输入（${input.length} 字符）。` +
          `当前为隔离引擎实现，真实推理由外部引擎注入。`;
        messages.push({ role: "assistant", content: responseContent });
        return { messages: [{ content: responseContent }], tokenUsage: { maxTokens } };
      },
      async abort() {
        aborted = true;
      },
    };
  }

  getActiveAgents(): SubAgentInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.status === "running");
  }

  /** 自进化技能树：更新技能熟练度 */
  updateSkillProficiency(agentName: string, skillName: string, success: boolean): void {
    const config = this.registry.get(agentName);
    if (!config?.skillTree) return;
    const tree = config.skillTree;
    const current = tree.proficiency[skillName] ?? 0.5;
    const delta = success ? 0.05 : -0.03;
    tree.proficiency[skillName] = Math.max(0, Math.min(1, current + delta));
    tree.lastUpdated = Date.now();
    if (tree.proficiency[skillName] >= 0.8 && !tree.mastered.includes(skillName)) {
      tree.mastered.push(skillName);
      const idx = tree.learning.indexOf(skillName);
      if (idx >= 0) tree.learning.splice(idx, 1);
    }
  }

  /** 获取技能树摘要 */
  getSkillTreeSummary(agentName: string): string {
    const config = this.registry.get(agentName);
    if (!config?.skillTree) return '未配置技能树';
    const tree = config.skillTree;
    const lines = [
      `技能树 [${agentName}]:`,
      `  已掌握 (${tree.mastered.length}): ${tree.mastered.join(', ') || '无'}`,
      `  学习中 (${tree.learning.length}): ${tree.learning.join(', ') || '无'}`,
    ];
    const entries = Object.entries(tree.proficiency);
    if (entries.length > 0) {
      const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 5);
      lines.push(`  熟练度 TOP5: ${top.map(([k, v]) => `${k}=${(v * 100).toFixed(0)}%`).join(', ')}`);
    }
    return lines.join('\n');
  }

  /** 按模型强度路由子代理（吸收自 OpenClaude Agent Routing） */
  routeByModel(modelId: string): SubAgentConfig {
    const exactMatch = Array.from(this.registry.values()).find(c => c.modelId === modelId);
    if (exactMatch) return exactMatch;
    const prefix = modelId.split(/[-/]/)[0];
    const prefixMatch = Array.from(this.registry.values()).filter(c => c.modelId?.startsWith(prefix));
    if (prefixMatch.length > 0) {
      return prefixMatch.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    }
    return this.listByPriority()[0] as SubAgentConfig;
  }

  /** 列出所有注册代理，按 priority 降序排列 */
  listByPriority(): SubAgentConfig[] {
    return Array.from(this.registry.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  async terminate(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = "terminated";
      this.deps.onEvent?.({ type: 'abort', agentName: instance.agentName, instanceId });
      await instance.engine.abort();
      this.instances.delete(instanceId);
      this.activeAgents--;
    }
  }

  /** 自改进学习循环：记录执行经验用于后续路由优化 */
  private experienceLog: Array<{ agentName: string; success: boolean; duration: number; timestamp: number }> = [];

  recordExperience(agentName: string, success: boolean, duration: number): void {
    this.experienceLog.push({ agentName, success, duration, timestamp: Date.now() });
    if (this.experienceLog.length > 1000) this.experienceLog = this.experienceLog.slice(-500);
  }

  /** 获取指定代理的成功率统计 */
  getAgentStats(agentName: string): { total: number; success: number; avgDuration: number } {
    const relevant = this.experienceLog.filter(e => e.agentName === agentName);
    const total = relevant.length;
    const success = relevant.filter(e => e.success).length;
    const avgDuration = total > 0 ? relevant.reduce((s, e) => s + e.duration, 0) / total : 0;
    return { total, success, avgDuration };
  }

  /** Agent 执行追踪：记录完整执行链路 */
  private traceLog: Array<{
    traceId: string;
    agentName: string;
    input: string;
    output?: string;
    error?: string;
    startTime: number;
    endTime?: number;
    toolCalls: string[];
  }> = [];

  startTrace(agentName: string, input: string): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.traceLog.push({ traceId, agentName, input, startTime: Date.now(), toolCalls: [] });
    return traceId;
  }

  endTrace(traceId: string, output: string, toolCalls: string[] = []): void {
    const trace = this.traceLog.find(t => t.traceId === traceId);
    if (trace) {
      trace.output = output;
      trace.endTime = Date.now();
      trace.toolCalls = toolCalls;
    }
  }

  failTrace(traceId: string, error: string): void {
    const trace = this.traceLog.find(t => t.traceId === traceId);
    if (trace) {
      trace.error = error;
      trace.endTime = Date.now();
    }
  }

  /** 按 capability 匹配代理（吸收自 AAS Core 能力标签） */
  findByCapabilities(requiredCapabilities: string[]): SubAgentConfig[] {
    return Array.from(this.registry.values()).filter(cfg => {
      if (!cfg.capabilities || cfg.capabilities.length === 0) return false;
      return requiredCapabilities.some(cap => cfg.capabilities!.includes(cap));
    });
  }

  getTraceLog(): typeof this.traceLog {
    return [...this.traceLog];
  }
}
