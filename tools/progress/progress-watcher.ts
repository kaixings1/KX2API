/**
 * ProgressWatcher — 外部监控器
 *
 * 功能：
 *   1. 监控进度目录中的 latest.json，实时显示进度条
 *   2. 检测会话状态（running/done/failed/cancelled）
 *   3. 自动续跑检测（如果上次没完成，可触发续跑）
 *   4. 完成时弹窗通知
 *
 * 用法：
 *   npx tsx tools/progress/progress-watcher.ts --dir D:/KX2API/output
 *   或
 *   node dist/tools/progress/progress-watcher.js --dir D:/KX2API/output
 */

import * as fs from "fs";
import * as path from "path";

interface CliArgs {
  dir: string;
  interval: number;
  autoRestart: boolean;
  restartCommand: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const opts: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dir":
        opts.dir = args[++i];
        break;
      case "--interval":
        opts.interval = parseInt(args[++i], 10);
        break;
      case "--auto-restart":
        opts.autoRestart = true;
        break;
      case "--restart-cmd":
        opts.restartCommand = args[++i];
        break;
    }
  }

  return {
    dir: opts.dir ?? "./output",
    interval: opts.interval ?? 2,
    autoRestart: opts.autoRestart ?? false,
    restartCommand: opts.restartCommand ?? "",
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour12: false });
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function bar(pct: number, width = 40): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "[" + "=".repeat(filled) + " ".repeat(empty) + `] ${pct.toFixed(1)}%`;
}

function draw(state: Record<string, unknown> | null): void {
  console.clear();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║              ProgressWatcher — 进度监控                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  if (!state) {
    console.log("  无活跃会话 (latest.json 不存在或无效)");
    console.log("  等待任务启动...");
    console.log();
    console.log(`  刷新间隔: ${args.interval}秒 | 目录: ${args.dir}`);
    return;
  }

  const statusMap: Record<string, string> = {
    running: "▶ 运行中",
    done: "✓ 已完成",
    failed: "✗ 失败",
    cancelled: "⚠ 已取消",
  };

  const status = (state.status as string) ?? "unknown";
  const statusStr = statusMap[status] ?? status;
  const pct = (state.pct as number) ?? 0;
  const processed = (state.processed as number) ?? 0;
  const total = (state.total as number) ?? 0;
  const label = (state.label as string) ?? "";
  const startedAt = (state.startedAt as string) ?? "";
  const updatedAt = (state.updatedAt as string) ?? "";
  const heartbeatAt = (state.heartbeatAt as string) ?? "";
  const finishedAt = (state.finishedAt as string) ?? "";
  const exitCode = (state.exitCode as number) ?? undefined;
  const error = (state.error as string) ?? undefined;
  const sessionId = (state.sessionId as string) ?? "";

  console.log(`  标签:        ${label}`);
  console.log(`  会话ID:      ${sessionId}`);
  console.log(`  状态:        ${statusStr}`);
  console.log();
  console.log(`  进度:        ${bar(pct)}`);
  console.log(`  已处理:      ${processed} / ${total}`);
  console.log();
  console.log(`  启动时间:    ${formatTime(startedAt)}`);
  console.log(`  更新时间:    ${formatTime(updatedAt)}`);
  console.log(`  最后心跳:    ${formatTime(heartbeatAt)}`);

  if (finishedAt) {
    const dur = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    console.log(`  完成时间:    ${formatTime(finishedAt)} (耗时 ${formatDuration(dur)})`);
  }

  // 运行时长
  const elapsed = Date.now() - new Date(startedAt).getTime();
  console.log(`  已运行:      ${formatDuration(elapsed)}`);

  if (exitCode !== undefined) {
    console.log(`  退出码:      ${exitCode}`);
  }
  if (error) {
    console.log(`  错误:        ${error}`);
  }

  // 心跳检测
  if (status === "running") {
    const lastHb = new Date(heartbeatAt).getTime();
    const hbAge = Date.now() - lastHb;
    const hbTimeout = 120_000;
    if (hbAge > hbTimeout) {
      console.log();
      console.log(`  ⚠ 心跳超时! 最后心跳已 ${formatDuration(hbAge)}，可能已卡死`);
    }
  }

  // 检查点
  const checkpoints = (state.checkpoints as Array<{ index: number }>) ?? [];
  if (checkpoints.length > 0) {
    console.log();
    console.log(`  检查点:      ${checkpoints.length} 个 (最新: index=${checkpoints[checkpoints.length - 1].index})`);
  }

  console.log();
  console.log(`  刷新间隔: ${args.interval}秒 | 目录: ${args.dir}`);

  if (status === "done") {
    console.log();
    console.log("  ✓ 任务已完成！按 Ctrl+C 退出监控器");
  } else if (status === "failed") {
    console.log();
    console.log("  ✗ 任务失败！按 Ctrl+C 退出监控器");
  }
}

// ==================== 主循环 ====================

const args = parseArgs();
let lastState: Record<string, unknown> | null = null;
let notifiedDone = false;
let notifiedFailed = false;

console.log(`[ProgressWatcher] 启动监控: dir=${args.dir}, interval=${args.interval}s`);
if (args.autoRestart) {
  console.log(`[ProgressWatcher] 自动续跑: ${args.restartCommand || "(无命令)"}`);
}

function loadState(): Record<string, unknown> | null {
  const latestPath = path.join(args.dir, "latest.json");
  if (!fs.existsSync(latestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(latestPath, "utf-8"));
  } catch {
    return null;
  }
}

function checkAutoRestart(state: Record<string, unknown>): void {
  if (!args.autoRestart) return;
  if (!args.restartCommand) return;

  const status = state.status as string;
  if ((status === "failed" || status === "cancelled") && !notifiedDone) {
    notifiedDone = true;
    console.log(`\n[ProgressWatcher] 检测到异常退出，准备续跑...`);
    console.log(`[ProgressWatcher] 执行: ${args.restartCommand}`);
    try {
      const { execSync } = require("child_process");
      execSync(args.restartCommand, {
        stdio: "inherit",
        windowsHide: true,
        cwd: process.cwd(),
      });
    } catch (e) {
      console.error(`[ProgressWatcher] 续跑命令执行失败:`, e);
    }
  }
}

// 主循环
draw(loadState());

const timer = setInterval(() => {
  const state = loadState();

  // 状态变化时通知
  if (state) {
    const status = state.status as string;
    if (status === "done" && !notifiedDone) {
      notifiedDone = true;
      console.log("\a"); // ASCII bell
      console.log(`\n  ★ 任务完成！★\n`);
      try {
        const { execSync } = require("child_process");
        execSync(
          'powershell -Command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0); $textNodes = $template.GetElementsByTagName(\'text\'); $textNodes.Item(0).AppendChild($template.CreateTextNode(\'任务完成\')) | Out-Null; $textNodes.Item(1).AppendChild($template.CreateTextNode(\'' + ((state.label as string) || "task") + ' 已完成!\')) | Out-Null; $toast = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(\'KX2API\'); $toast.Show([Windows.UI.Notifications.ToastNotification]($template))"',
          { stdio: "ignore", windowsHide: true, timeout: 5000 }
        );
      } catch { /* ignore */ }
    }
    if ((status === "failed" || status === "cancelled") && !notifiedFailed) {
      notifiedFailed = true;
      console.log(`\n  ✗ 任务失败或取消: ${(state.error as string) || "unknown"}\n`);
    }

    checkAutoRestart(state);
  }

  draw(state);
  lastState = state;
}, args.interval * 1000);

// Ctrl+C 处理
process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\n[ProgressWatcher] 监控器退出");
  process.exit(0);
});
