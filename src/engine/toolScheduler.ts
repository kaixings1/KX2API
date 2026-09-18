/**
 * engine/toolScheduler.ts — 工具调度器（文档 02 §6.1）
 *
 * 权限检查 → 分组（并行/串行）→ 执行 → 合并结果（保持顺序）。
 */
import type { ToolCall } from "./responseHandler.ts";
import { maybePersistToolResult } from "./toolResultStore.ts";
import { needsRepair, repairArgsBySchema } from "./tool-harness/jsonSchemaRepair.ts";
import { formatToolError, formatValidationError, issuesFromSimpleErrors } from "./errors/toolErrorFormat.ts";
import { evaluatePermission, explainRule, type PermissionRule } from "./permissions/permissionRules.ts";
import type { HookManager } from "./hooks/hookManager.ts";
import type { Tool, ToolResult } from "./tools/types.ts";

// Re-export for backward compatibility (other modules import Tool/ToolResult from here)
export type { Tool, ToolResult } from "./tools/types.ts"

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
  /** 参数级权限规则；默认空（不改变既有行为） */
  private permissionRules: PermissionRule[] = []
  private hookManager?: HookManager

  constructor(
    private registry: Map<string, Tool>,
    private permissionManager: PermissionManager,
    private executor: ToolExecutor,
  ) {}

  /** 注入钩子回调（主进程启动时调用） */
  setHooks(hooks: ToolHooks): void {
    this.hooks = hooks
  }

  /** 注入事件钩子管理器（启动时调用）；未注入时跳过，不影响既有行为 */
  setHookManager(hm?: HookManager): void {
    this.hookManager = hm
  }

  /**
   * 参数级权限规则（`Bash(git status)`、`Edit(src/**)` 等）。
   *
   * 规则优先于通用权限逻辑：命中 allow 直接放行、命中 deny 直接拒绝，
   * 未命中（passthrough）才交给 permissionManager。
   * 不配置任何规则时行为与改动前一致。
   */
  setPermissionRules(rules: PermissionRule[]): void {
    this.permissionRules = Array.isArray(rules) ? rules : []
  }

  /** 当前生效的权限规则（供 UI 回显） */
  getPermissionRules(): PermissionRule[] {
    return [...this.permissionRules]
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

      // 先走参数级权限规则（`Bash(git status)` 这类）。
      // 无规则配置时 evaluatePermission 返回 passthrough，行为与改动前完全一致。
      const decision = evaluatePermission(this.permissionRules, call.name, call.input);
      if (decision.behavior === 'deny') {
        console.warn(
          `[TOOL] 被权限规则拒绝: ${call.name}` +
            (decision.matchedRule ? `（${explainRule(decision.matchedRule)}）` : ''),
        );
        // 不加入 out —— merge 阶段会把它标记为失败
        continue;
      }
      if (decision.behavior === 'allow') {
        out.push(call);
        continue;
      }
      // ask / passthrough 交回通用权限逻辑（会触发用户确认）

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
        : { success: false, error: r.reason?.message ?? '未知错误', toolUseId: calls[i].id } as ToolResult,
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
      const available = Array.from(this.registry.keys());
      // 给模型可操作的反馈：列出最相近的名字（名字包含关系 / 前缀重叠），
      // 并指向 tool_search。只说 "not found" 会让模型盲目重试同名调用。
      const near = available
        .filter(n => {
          const a = n.toLowerCase()
          const b = call.name.toLowerCase()
          return a.includes(b) || b.includes(a) || a.startsWith(b.slice(0, 4))
        })
        .slice(0, 5);
      const hint = near.length > 0
        ? `你是不是想用：${near.join(', ')}？`
        : '可用 tool_search 检索工具名。';
      console.warn(`[TOOL] Tool not found: ${call.name}. 候选=${near.join(',') || '(无)'} 总数=${available.length}`);
      return {
        success: false,
        error: `工具 \`${call.name}\` 不存在。${hint}`,
        toolUseId: call.id,
        metadata: { toolNotFound: true, candidates: near },
      };
    }
    // 参数修复：模型给出的键名/类型常与 schema 有系统性偏差
    // （`filePath` vs `file_path`、布尔写成 "true"、数字写成 "42"、单值当数组）。
    // 这些**全都能在本地纠正**，不必让模型重试一次 —— 每次重试都是一轮 API 调用。
    //
    // 只在「预判需要修复」时才跑完整流程（`needsRepair` 很便宜），
    // 避免给每次正常的工具调用增加开销。
    let input = call.input;
    const schema = (tool as { parameters?: Record<string, unknown> }).parameters;
    if (schema && typeof schema === 'object' && needsRepair(input, schema)) {
      const repaired = repairArgsBySchema(input, schema);
      if (repaired.repairs.length > 0) {
        console.log(
          `[TOOL] 参数已修复 ${call.name}: ` +
            repaired.repairs.map(r => `${r.field}(${r.strategy})`).join(', '),
        );
        input = repaired.data;
      }
    }

    const validation = tool.validate(input);
    if (!validation.valid) {
      // 把原始校验错误整理成「缺少 / 多余 / 类型不符」三类陈述。
      // 模型看到「缺少必需参数 `path`」就能直接补上，而原始的自由文本
      // 校验错误它不知道要改哪个参数 —— 这直接影响下一次调用能否成功。
      const rawErrors = Array.isArray(validation.errors) ? validation.errors : [];
      return {
        success: false,
        error: formatValidationError(call.name, issuesFromSimpleErrors(rawErrors)),
        toolUseId: call.id,
        metadata: { validationFailed: true },
      };
    }

    // PreToolUse 钩子：可拒绝执行或补充上下文。
    // 钩子失败不阻断（异常被吞、按"无裁决"处理）—— 钩子是外部脚本，
    // 它的健壮性不该成为工具能否执行的前提。
    let hookContext = ''
    if (this.hooks.preToolUse) {
      try {
        const hr = await this.hooks.preToolUse(call.name, input);
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

    // 事件钩子：PreToolUse 可在执行前拦截（如密钥检测、文件类型警告）。
    if (this.hookManager) {
      try {
        const preResult = await this.hookManager.trigger({
          type: 'PreToolUse',
          toolName: call.name,
          input,
        })
        if (preResult.allow === false) {
          return {
            success: false,
            error: preResult.reason || '被事件钩子拒绝',
            toolUseId: call.id,
            metadata: { deniedByHook: true },
          };
        }
      } catch (e) {
        console.warn(`[TOOL] PreToolUse 事件钩子异常（已忽略）: ${(e as Error).message}`);
      }
    }

    try {
      const output = await this.executor.execute(tool, input, {
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
          await this.hooks.postToolUse(call.name, input, true, finalOutput);
        } catch (e) {
          console.warn(`[TOOL] PostToolUse 钩子异常（已忽略）: ${(e as Error).message}`);
        }
      }
      // 事件钩子：PostToolUse 记录审计日志、统计等
      if (this.hookManager) {
        try {
          await this.hookManager.trigger({
            type: 'PostToolUse',
            toolName: call.name,
            input,
            success: true,
            output: finalOutput,
          })
        } catch {
          /* 审计钩子异常不影响主流程 */
        }
      }
      return { success: true, output: finalOutput, toolUseId: call.id };
    } catch (e) {
      // 统一的错误格式化：合并 message / stderr / stdout，超长时**中间**截断
      // （构建与编译错误的关键信息常在末尾，切尾会丢）。
      const errMsg = formatToolError(e);
      if (this.hooks.postToolUse) {
        try {
          await this.hooks.postToolUse(call.name, input, false, errMsg);
        } catch {
          /* 钩子异常已在上方记录过，此处静默 */
        }
      }
      // 事件钩子：PostToolUseFailure 累计失败计数
      if (this.hookManager) {
        try {
          await this.hookManager.trigger({
            type: 'PostToolUseFailure',
            toolName: call.name,
            input,
            success: false,
            error: errMsg,
          })
        } catch {
          /* 审计钩子异常不影响主流程 */
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
