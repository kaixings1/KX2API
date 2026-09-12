/**
 * ProgressEngine — 长时运行任务的进度追踪 + 自动续跑引擎
 *
 * 核心功能：
 *   1. 实时进度写入进度文件（JSON）
 *   2. 心跳机制（定时更新时间戳）
 *   3. 会话结束检测（进程退出时自动记录状态）
 *   4. 自动续跑（启动时检测上次未完成的会话，自动继续）
 *   5. 完成通知（Windows Toast + 声音 + 日志标记）
 *
 * 用法：
 *   const engine = new ProgressEngine("D:/KX2API/output");
 *   engine.start({ total: 50000, label: "batch_process" });
 *   for (...) {
 *     engine.tick(1);            // 每处理一个 item
 *     // 或 engine.setProgress(1200, 50000);
 *   }
 *   engine.done(resultData);     // 完成
 *   // 或 engine.fail("reason"); // 失败
 *
 * 启动时自动检测：
 *   const engine = new ProgressEngine("D:/KX2API/output");
 *   const resumed = engine.resume();  // 如果有未完成的会话，返回 { shouldResume, session, lastIndex }
 *   if (resumed.shouldResume) {
 *     // 从 resumed.lastIndex 继续
 *   }
 */

import * as fs from "fs";
import * as path from "path";

export interface ProgressState {
  sessionId: string;
  label: string;
  status: "running" | "done" | "failed" | "cancelled";
  total: number;
  processed: number;
  pct: number;
  startedAt: string;
  updatedAt: string;
  heartbeatAt: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
  result?: unknown;
  checkpoints: Checkpoint[];
}

export interface Checkpoint {
  index: number;
  timestamp: string;
  data?: unknown;
}

export interface ProgressEngineOptions {
  /** 进度文件存放目录 */
  dir: string;
  /** 心跳间隔（毫秒），默认 30000（30秒） */
  heartbeatInterval?: number;
  /** 心跳超时（毫秒），超过此时间没心跳视为卡死，默认 120000（2分钟） */
  heartbeatTimeout?: number;
  /** 完成时是否播放提示音 */
  notifySound?: boolean;
  /** 完成时是否弹出 Windows Toast */
  notifyToast?: boolean;
  /** 完成时是否在日志打印 DONE 标记 */
  notifyLog?: boolean;
}

interface ActiveSession {
  state: ProgressState;
  heartbeatTimer: NodeJS.Timeout;
  stateFile: string;
}

export class ProgressEngine {
  private dir: string;
  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private notifySound: boolean;
  private notifyToast: boolean;
  private notifyLog: boolean;
  private activeSession: ActiveSession | null = null;

  constructor(opts: ProgressEngineOptions) {
    this.dir = opts.dir;
    this.heartbeatInterval = opts.heartbeatInterval ?? 30_000;
    this.heartbeatTimeout = opts.heartbeatTimeout ?? 120_000;
    this.notifySound = opts.notifySound ?? true;
    this.notifyToast = opts.notifyToast ?? true;
    this.notifyLog = opts.notifyLog ?? true;

    fs.mkdirSync(this.dir, { recursive: true });
  }

  // ==================== 启动 ====================

  /** 开始一个新会话，或恢复未完成的会话 */
  start(opts: { total: number; label?: string }): ProgressState {
    // 先检查是否有未完成的会话
    const existing = this.findIncompleteSession();
    if (existing) {
      return existing.state;
    }

    const sessionId = this.generateSessionId();
    const state: ProgressState = {
      sessionId,
      label: opts.label ?? "task",
      status: "running",
      total: opts.total,
      processed: 0,
      pct: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      checkpoints: [],
    };

    const stateFile = this.getStateFile(sessionId);
    this.writeState(stateFile, state);

    // 启动心跳定时器
    const timer = setInterval(() => {
      this.updateHeartbeat(stateFile);
    }, this.heartbeatInterval);

    // 进程退出时清理
    process.on("exit", () => this.onExit(state, stateFile));
    process.on("SIGINT", () => {
      this.markCancelled(state, stateFile);
      process.exit(130);
    });

    this.activeSession = { state, heartbeatTimer: timer, stateFile };

    // 写一个 latest.json 指针，方便外部快速找到当前会话
    this.writeState(path.join(this.dir, "latest.json"), {
      ...state,
      _resolvedPath: stateFile,
    } as any);

    return state;
  }

  // ==================== 进度更新 ====================

  /** 每处理一个 item 调用 */
  tick(count = 1): ProgressState | null {
    if (!this.activeSession) return null;
    this.activeSession.state.processed += count;
    this.activeSession.state.pct =
      this.activeSession.state.total > 0
        ? Math.round((this.activeSession.state.processed / this.activeSession.state.total) * 1000) / 10
        : 0;
    this.activeSession.state.updatedAt = new Date().toISOString();
    this.persist(this.activeSession);
    return this.activeSession.state;
  }

  /** 精确设置进度 */
  setProgress(processed: number, total?: number): ProgressState | null {
    if (!this.activeSession) return null;
    this.activeSession.state.processed = processed;
    if (total !== undefined) this.activeSession.state.total = total;
    this.activeSession.state.pct =
      this.activeSession.state.total > 0
        ? Math.round((processed / this.activeSession.state.total) * 1000) / 10
        : 0;
    this.activeSession.state.updatedAt = new Date().toISOString();
    this.persist(this.activeSession);
    return this.activeSession.state;
  }

  /** 写入检查点（用于断点续跑） */
  checkpoint(index: number, data?: unknown): ProgressState | null {
    if (!this.activeSession) return null;
    this.activeSession.state.checkpoints.push({
      index,
      timestamp: new Date().toISOString(),
      data,
    });
    this.persist(this.activeSession);
    return this.activeSession.state;
  }

  // ==================== 结束 ====================

  /** 正常完成 */
  done(resultData?: unknown): void {
    if (!this.activeSession) return;
    const now = new Date().toISOString();
    this.activeSession.state.status = "done";
    this.activeSession.state.finishedAt = now;
    this.activeSession.state.exitCode = 0;
    this.activeSession.state.result = resultData;
    this.persist(this.activeSession);

    // 完成通知
    if (this.notifyLog) this.logDone(this.activeSession.state);
    if (this.notifySound) this.playDoneSound();
    if (this.notifyToast) this.showToast("任务完成", this.activeSession.state.label);

    this.cleanup(this.activeSession);
  }

  /** 失败退出 */
  fail(reason: string): void {
    if (!this.activeSession) return;
    const now = new Date().toISOString();
    this.activeSession.state.status = "failed";
    this.activeSession.state.finishedAt = now;
    this.activeSession.state.exitCode = 1;
    this.activeSession.state.error = reason;
    this.persist(this.activeSession);

    if (this.notifyToast) this.showToast("任务失败", `${this.activeSession.state.label}: ${reason}`);

    this.cleanup(this.activeSession);
  }

  // ==================== 续跑检测 ====================

  /**
   * 检测是否有未完成的会话需要续跑
   * @returns { shouldResume, session, lastIndex }
   */
  resume(): { shouldResume: boolean; session: ProgressState; lastIndex: number } | null {
    const existing = this.findIncompleteSession();
    if (!existing) return null;

    const state = existing.state;

    // 如果心跳超时，标记为失败
    const lastHeartbeat = new Date(state.heartbeatAt).getTime();
    if (Date.now() - lastHeartbeat > this.heartbeatTimeout) {
      state.status = "failed";
      state.error = "heartbeat_timeout: last heartbeat exceeded timeout";
      state.finishedAt = new Date().toISOString();
      this.writeState(existing.file, state);
      return null;
    }

    // 继续当前会话（不清零 processed）
    const timer = setInterval(() => {
      this.updateHeartbeat(existing.file);
    }, this.heartbeatInterval);

    process.on("exit", () => this.onExit(state, existing.file));
    process.on("SIGINT", () => {
      this.markCancelled(state, existing.file);
      process.exit(130);
    });

    const lastIndex = state.checkpoints.length > 0
      ? state.checkpoints[state.checkpoints.length - 1].index
      : state.processed;

    this.activeSession = { state, heartbeatTimer: timer, stateFile: existing.file };

    // 打印续跑信息
    console.log(`[ProgressEngine] 检测到未完成会话，自动续跑:`);
    console.log(`  label:      ${state.label}`);
    console.log(`  sessionId:  ${state.sessionId}`);
    console.log(`  progress:   ${state.processed}/${state.total} (${state.pct}%)`);
    console.log(`  checkpoints: ${state.checkpoints.length} 个`);
    if (state.checkpoints.length > 0) {
      console.log(`  上次断点:    index=${lastIndex}`);
    }

    return { shouldResume: true, session: state, lastIndex };
  }

  // ==================== 外部查询 ====================

  /** 获取当前活跃会话状态（外部调用） */
  getCurrentState(): ProgressState | null {
    const latestPath = path.join(this.dir, "latest.json");
    if (!fs.existsSync(latestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(latestPath, "utf-8"));
    } catch {
      return null;
    }
  }

  /** 列出所有历史会话 */
  listSessions(): ProgressState[] {
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".state.json"));
    const sessions: ProgressState[] = [];
    for (const file of files) {
      try {
        sessions.push(JSON.parse(fs.readFileSync(path.join(this.dir, file), "utf-8")));
      } catch { /* skip */ }
    }
    return sessions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /** 检查是否有会话正在运行 */
  isRunning(): boolean {
    const current = this.getCurrentState();
    if (!current) return false;
    if (current.status !== "running") return false;
    // 检查心跳是否超时
    const lastHeartbeat = new Date(current.heartbeatAt).getTime();
    return Date.now() - lastHeartbeat < this.heartbeatTimeout;
  }

  /** 获取进度百分比（外部调用） */
  getProgress(): { running: boolean; pct: number; label: string; processed: number; total: number } | null {
    const state = this.getCurrentState();
    if (!state || state.status !== "running") return null;
    return {
      running: true,
      pct: state.pct,
      label: state.label,
      processed: state.processed,
      total: state.total,
    };
  }

  // ==================== 内部方法 ====================

  private persist(session: ActiveSession): void {
    this.writeState(session.stateFile, session.state);

    // 同时更新 latest.json
    const latestPath = path.join(this.dir, "latest.json");
    if (fs.existsSync(latestPath)) {
      this.writeState(latestPath, { ...session.state, _resolvedPath: session.stateFile } as any);
    }
  }

  private updateHeartbeat(stateFile: string): void {
    const data = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    data.heartbeatAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
    this.writeState(stateFile, data);
  }

  private markCancelled(state: ProgressState, stateFile: string): void {
    state.status = "cancelled";
    state.finishedAt = new Date().toISOString();
    this.writeState(stateFile, state);
  }

  private onExit(state: ProgressState, stateFile: string): void {
    if (state.status === "running") {
      // 进程正常退出但没调用 done()/fail() → 标记为异常退出
      state.status = "cancelled";
      state.finishedAt = new Date().toISOString();
      state.error = "process_exited_without_finalizing";
      this.writeState(stateFile, state);
    }
    if (this.activeSession) {
      clearInterval(this.activeSession.heartbeatTimer);
      this.activeSession = null;
    }
  }

  private cleanup(session: ActiveSession): void {
    clearInterval(session.heartbeatTimer);
    this.activeSession = null;
  }

  private writeState(file: string, state: unknown): void {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmp, file); // 原子写入
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getStateFile(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.state.json`);
  }

  private findIncompleteSession(): { state: ProgressState; file: string } | null {
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".state.json"));
    // 优先找 latest.json 指向的
    const latestPath = path.join(this.dir, "latest.json");
    if (fs.existsSync(latestPath)) {
      try {
        const latest = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
        const resolved = (latest as any)._resolvedPath;
        if (resolved && fs.existsSync(resolved)) {
          const state = JSON.parse(fs.readFileSync(resolved, "utf-8"));
          if (state.status === "running") return { state, file: resolved };
        }
      } catch { /* skip */ }
    }
    // 降级：找最近的一个 running 状态
    for (const file of files.reverse()) {
      try {
        const state = JSON.parse(fs.readFileSync(path.join(this.dir, file), "utf-8"));
        if (state.status === "running") return { state, file: path.join(this.dir, file) };
      } catch { /* skip */ }
    }
    return null;
  }

  // ==================== 通知 ====================

  private logDone(state: ProgressState): void {
    const marker = `__PROGRESSENGINE_DONE__ session=${state.sessionId} label=${state.label} processed=${state.processed}/${state.total} pct=${state.pct}% exitCode=${state.exitCode}__`;
    console.log(marker);
  }

  private playDoneSound(): void {
    try {
      const { execSync } = require("child_process");
      // 用 PowerShell 播放系统提示音
      execSync(
        'powershell -Command "[System.Media.SystemSounds]::Beep.Play()"',
        { stdio: "ignore", windowsHide: true }
      );
    } catch { /* ignore */ }
  }

  private showToast(title: string, message: string): void {
    try {
      const { execSync } = require("child_process");
      // Windows 10/11 Toast 通知（无需 extra DLL）
      execSync(
        `powershell -Command "$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0); $textNodes = $template.GetElementsByTagName('text'); $textNodes.Item(0).AppendChild($template.CreateTextNode('${title}')) | Out-Null; $textNodes.Item(1).AppendChild($template.CreateTextNode('${message}')) | Out-Null; $toast = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('KX2API'); $toast.Show([Windows.UI.Notifications.ToastNotification]($template))"`,
        { stdio: "ignore", windowsHide: true, timeout: 5000 }
      );
    } catch {
      // Toast 失败降级到 msg 命令
      try {
        const { execSync } = require("child_process");
        execSync(`msg * "${title}: ${message}"`, { stdio: "ignore", windowsHide: true });
      } catch { /* ignore */ }
    }
  }
}

export default ProgressEngine;

// ==================== CLI 模式 ====================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === "--check" && args[1]) {
    // 检查未完成会话
    const engine = new ProgressEngine({ dir: args[1] });
    const resumed = engine.resume();
    if (resumed) {
      console.log(`[FOUND] 未完成会话: ${resumed.session.label}`);
      console.log(`  progress:  ${resumed.session.processed}/${resumed.session.total} (${resumed.session.pct}%)`);
      console.log(`  checkpoints: ${resumed.session.checkpoints.length}`);
      process.exit(0);
    } else {
      console.log(`[OK] 没有未完成的会话`);
      process.exit(0);
    }
  }

  if (args[0] === "--query" && args[1]) {
    // 查询当前状态
    const engine = new ProgressEngine({ dir: args[1] });
    const state = engine.getCurrentState();
    if (!state) {
      console.log(`[NONE] 无活跃任务`);
      process.exit(0);
    }
    const progress = engine.getProgress();
    if (progress && progress.running) {
      console.log(`[RUNNING] ${progress.label}`);
      console.log(`  progress:  ${progress.processed}/${progress.total} (${progress.pct}%)`);
    } else {
      console.log(`[${state.status.toUpperCase()}] ${state.label}`);
      console.log(`  progress:  ${state.processed}/${state.total} (${state.pct}%)`);
      if (state.error) console.log(`  error:     ${state.error}`);
    }
    process.exit(0);
  }

  if (args[0] === "--list" && args[1]) {
    // 列出所有历史会话
    const engine = new ProgressEngine({ dir: args[1] });
    const sessions = engine.listSessions();
    console.log(`[SESSIONS] 共 ${sessions.length} 个:`);
    for (const s of sessions.slice(0, 20)) {
      console.log(`  [${s.status}] ${s.label} | ${s.processed}/${s.total} (${s.pct}%) | ${s.startedAt}`);
    }
    process.exit(0);
  }

  // 默认用法提示
  console.log(`ProgressEngine CLI`);
  console.log(`  用法: progress-engine.ts --check <dir>    检查未完成会话`);
  console.log(`        progress-engine.ts --query <dir>    查询当前状态`);
  console.log(`        progress-engine.ts --list <dir>     列出所有会话`);
}
