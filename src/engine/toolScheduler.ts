/**
 * engine/toolScheduler.ts — 工具调度器（文档 02 §6.1）
 *
 * 权限检查 → 分组（并行/串行）→ 执行 → 合并结果（保持顺序）。
 */
import type { ToolCall } from "./responseHandler.ts";
import { maybePersistToolResult } from "./toolResultStore.ts";

// [LOCAL] 本地定义工具类型，适配 D:\doge-code\src\ 架构
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  canRunInParallel?: boolean;
  validate(params: unknown): { valid: boolean; errors?: string[] };
  execute(params: unknown, context?: { timeout?: number; onProgress?: (p: unknown) => void }): Promise<{ content: unknown }>;
}

export interface ToolResult {
  toolUseId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionManager {
  check(tool: Tool, input: Record<string, unknown>): Promise<boolean>;
  requestAuthorization(tool: Tool, input: Record<string, unknown>): Promise<boolean>;
  /**
   * 异步权限请求：通过事件通道等待 UI 层的 grant/deny 响应。
   * 对齐 OpenCode (Go) 的 PermissionService.Request() 模式。
   */
  requestPermission?(tool: Tool, input: Record<string, unknown>): Promise<boolean>;
}

export interface ToolExecutor {
  execute(
    tool: Tool,
    input: Record<string, unknown>,
    opts: { timeout: number; onProgress?: (p: unknown) => void },
  ): Promise<string>;
}

/**
 * 钩子回调。
 *
 * 刻意用**注入**而非直接 import —— 钩子实现放在 main 层
 * （需要 child_process / userData 路径），engine 层不应反向依赖它。
 * 未注入时全部跳过，不影响既有行为。
 */
export interface ToolHooks {
  /** 工具执行前；返回 { deny } 时跳过执行 */
  preToolUse?: (toolName: string, input: Record<string, unknown>) => Promise<{
    deny?: boolean
    reason?: string
    /** 追加进结果的上下文（钩子想告诉模型的话） */
    additionalContext?: string
  } | void>
  /** 工具执行后（成功/失败都会调），返回值不影响结果 */
  postToolUse?: (toolName: string, input: Record<string, unknown>, success: boolean, output: string) => Promise<void>
}

export class ToolScheduler {
  /** 单次工具执行的默认超时（毫秒）；由上层注入，缺省 10 分钟 */
  private defaultToolTimeoutMs?: number
  private hooks: ToolHooks = {}

  constructor(
    private registry: Map<string, Tool>,
    private permissionManager: PermissionManager,
    private executor: ToolExecutor,
  ) {}

  /** 注入钩子回调（主进程启动时调用） */
  setHooks(hooks: ToolHooks): void {
    this.hooks = hooks
  }

  /** 设置默认工具超时（设置界面改完即时生效） */
  setDefaultToolTimeout(ms?: number): void {
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
      this.defaultToolTimeoutMs = Math.floor(ms)
    }
  }

  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const authorized = await this.checkPermissions(toolCalls);
    const { parallel, serial } = this.categorize(authorized);
    const parallelResults = await this.executeParallel(parallel);
    const serialResults = await this.executeSerial(serial);
    return this.merge(toolCalls, [...parallelResults, ...serialResults]);
  }

  private async checkPermissions(calls: ToolCall[]): Promise<ToolCall[]> {
    const out: ToolCall[] = [];
    for (const call of calls) {
      const tool = this.registry.get(call.name);
      if (!tool) {
        out.push(call);
        continue;
      }
      const has = await this.permissionManager.check(tool, call.input);
      if (has) {
        out.push(call);
        continue;
      }
      // 尝试自动授权（工具自身规则）
      const autoAuth = await this.permissionManager.requestAuthorization(tool, call.input);
      if (autoAuth) {
        out.push(call);
        continue;
      }
      // 异步权限请求：通过事件通道等待 UI 响应（对齐 OpenCode Request()）
      if (this.permissionManager.requestPermission) {
        const granted = await this.permissionManager.requestPermission(tool, call.input);
        if (granted) {
          out.push(call);
          continue;
        }
      }
      // 拒绝：不加入 out，merge 会标记为失败
    }
    return out;
  }

  private categorize(calls: ToolCall[]): { parallel: ToolCall[]; serial: ToolCall[] } {
    const parallel: ToolCall[] = [];
    const serial: ToolCall[] = [];
    for (const call of calls) {
      const tool = this.registry.get(call.name);
      if (tool && (tool as { canRunInParallel?: boolean }).canRunInParallel) parallel.push(call);
      else serial.push(call);
    }
    return { parallel, serial };
  }

  private async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    if (calls.length === 0) return [];
    const results = await Promise.allSettled(calls.map((c) => this.executeSingle(c)));
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { success: false, error: r.reason?.message ?? "Unknown error", toolUseId: calls[i].id } as ToolResult,
    );
  }

  private async executeSerial(calls: ToolCall[]): Promise<ToolResult[]> {
    const out: ToolResult[] = [];
    for (const call of calls) out.push(await this.executeSingle(call));
    return out;
  }

  private async executeSingle(call: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(call.name);
    if (!tool) {
      console.warn(`[TOOL] Tool not found: ${call.name}. Available tools: ${Array.from(this.registry.keys()).join(', ')}`);
      return { success: false, error: `Tool not found: ${call.name}`, toolUseId: call.id };
    }
    const validation = tool.validate(call.input);
    if (!validation.valid) {
      return { success: false, error: `Invalid: ${validation.errors.join(", ")}`, toolUseId: call.id };
    }

    // PreToolUse 钩子：可拒绝执行或补充上下文。
    // 钩子失败不阻断（异常被吞、按"无裁决"处理）—— 钩子是外部脚本，
    // 它的健壮性不该成为工具能否执行的前提。
    let hookContext = ''
    if (this.hooks.preToolUse) {
      try {
        const hr = await this.hooks.preToolUse(call.name, call.input);
        if (hr?.deny) {
          return {
            success: false,
            error: hr.reason || "被 PreToolUse 钩子拒绝",
            toolUseId: call.id,
            metadata: { deniedByHook: true },
          };
        }
        if (hr?.additionalContext) hookContext = hr.additionalContext;
      } catch (e) {
        console.warn(`[TOOL] PreToolUse 钩子异常（已忽略）: ${(e as Error).message}`);
      }
    }

    try {
      const output = await this.executor.execute(tool, call.input, {
        // 工具自带 timeout 优先；否则用注入的默认值，最后回落到 10 分钟
        timeout:
          (tool as { timeout?: number }).timeout ??
          this.defaultToolTimeoutMs ??
          600_000,
      });
      // 超大结果落盘，上下文里只留预览 + 文件路径（模型可用 Read 读全文）。
      // 这样「读日志/跑构建/列大目录」这类工具不会一次吃光上下文窗口。
      const persisted = await maybePersistToolResult(String(output ?? ""), call.id);
      const finalOutput = hookContext ? `${hookContext}\n\n${persisted}` : persisted;

      if (this.hooks.postToolUse) {
        try {
          await this.hooks.postToolUse(call.name, call.input, true, finalOutput);
        } catch (e) {
          console.warn(`[TOOL] PostToolUse 钩子异常（已忽略）: ${(e as Error).message}`);
        }
      }
      return { success: true, output: finalOutput, toolUseId: call.id };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (this.hooks.postToolUse) {
        try {
          await this.hooks.postToolUse(call.name, call.input, false, errMsg);
        } catch {
          /* 钩子异常已在上方记录过，此处静默 */
        }
      }
      return { success: false, error: errMsg, toolUseId: call.id };
    }
  }

  private merge(original: ToolCall[], results: ToolResult[]): ToolResult[] {
    const map = new Map(results.map((r) => [r.toolUseId, r]));
    return original.map((c) => map.get(c.id) ?? { success: false, error: "未找到结果", toolUseId: c.id });
  }

  onProgress?: (toolUseId: string, progress: unknown) => void;
}
