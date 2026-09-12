/**
 * UniversalRunner — 通用包装器
 *
 * 功能：把任意现有脚本包装成"可追踪进度 + 自动续跑 + 完成通知"的任务
 *
 * 用法：
 *   方式1：直接包装一个循环
 *   const runner = new UniversalRunner({ dir: "./output", total: 50000 });
 *   await runner.wrap(async (ctx) => {
 *     for (let i = ctx.lastIndex; i < 50000; i++) {
 *       await doWork(i);
 *       ctx.tick();
 *     }
 *   });
 *
 *   方式2：包装已有函数（自动续跑）
 *   const runner = new UniversalRunner({ dir: "./output", total: 50000 });
 *   const result = await runner.run("batch_job", async (ctx) => {
 *     // ctx.resume 返回上次断点位置
 *     const start = ctx.resume?.lastIndex ?? 0;
 *     for (let i = start; i < 50000; i++) {
 *       await doWork(i);
 *       ctx.tick();
 *       if (i % 1000 === 0) ctx.checkpoint(i, { batch: i / 1000 });
 *     }
 *   });
 *
 *   方式3：作为 CLI 包装外部命令
 *   npx tsx tools/progress/universal-runner.ts --command "python analyze.py" --total 50000
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { ProgressEngine, ProgressState } from "./progress-engine";

export interface UniversalRunnerOptions {
  /** 进度文件目录 */
  dir: string;
  /** 总处理量 */
  total: number;
  /** 任务标签 */
  label?: string;
  /** 心跳间隔 */
  heartbeatInterval?: number;
  /** 心跳超时 */
  heartbeatTimeout?: number;
  /** 完成通知 */
  notify?: boolean;
}

interface RunContext {
  /** 当前引擎 */
  engine: ProgressEngine;
  /** 当前状态 */
  state: ProgressState;
  /** 续跑信息（如果有） */
  resume: { shouldResume: boolean; lastIndex: number } | null;
  /** 上报进度 */
  tick: (count?: number) => void;
  /** 精确设置进度 */
  setProgress: (processed: number, total?: number) => void;
  /** 写入检查点 */
  checkpoint: (index: number, data?: unknown) => void;
}

export class UniversalRunner {
  private dir: string;
  private total: number;
  private label: string;
  private engine: ProgressEngine;

  constructor(opts: UniversalRunnerOptions) {
    this.dir = opts.dir;
    this.total = opts.total;
    this.label = opts.label ?? "task";
    this.engine = new ProgressEngine({
      dir: opts.dir,
      heartbeatInterval: opts.heartbeatInterval,
      heartbeatTimeout: opts.heartbeatTimeout,
      notifySound: opts.notify ?? true,
      notifyToast: opts.notify ?? true,
      notifyLog: true,
    });
  }

  /**
   * 包装一个异步任务函数
   * @param taskName 任务名称
   * @param fn 任务函数，接收 RunContext
   */
  async run(taskName: string, fn: (ctx: RunContext) => Promise<unknown>): Promise<unknown> {
    // 尝试续跑
    const resumed = this.engine.resume();

    let startIndex = 0;
    if (resumed) {
      startIndex = resumed.lastIndex;
      console.log(`[UniversalRunner] 续跑: ${resumed.session.label}, 从 index=${startIndex} 继续`);
    }

    const state = this.engine.start({ total: this.total, label: taskName });

    const ctx: RunContext = {
      engine: this.engine,
      state,
      resume: resumed ? { shouldResume: true, lastIndex: resumed.lastIndex } : null,
      tick: (count = 1) => this.engine.tick(count),
      setProgress: (processed, total) => this.engine.setProgress(processed, total),
      checkpoint: (index, data) => this.engine.checkpoint(index, data),
    };

    try {
      const result = await fn(ctx);
      this.engine.done(result);
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[UniversalRunner] 任务失败: ${reason}`);
      this.engine.fail(reason);
      throw err;
    }
  }

  /**
   * 简化版：包装一个循环
   */
  async wrap(fn: (ctx: RunContext) => Promise<void>): Promise<void> {
    return this.run(this.label, fn);
  }

  /**
   * 作为外部命令的包装器
   * 启动外部命令，监控其输出，完成后记录状态
   */
  async exec(command: string, args: string[] = []): Promise<{ exitCode: number }> {
    const resumed = this.engine.resume();

    if (resumed) {
      console.log(`[UniversalRunner] 检测到上次未完成的执行，重新运行`);
    }

    const state = this.engine.start({ total: 1, label: `exec: ${command}` });
    this.engine.setProgress(0, 1);

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d) => {
        stdout += d.toString();
        process.stdout.write(d);
      });

      child.stderr.on("data", (d) => {
        stderr += d.toString();
        process.stderr.write(d);
      });

      child.on("close", (code) => {
        this.engine.setProgress(1, 1);
        if (code === 0) {
          this.engine.done({ stdout, stderr });
        } else {
          this.engine.fail(`exit code ${code}: ${stderr.slice(0, 200)}`);
        }
        resolve({ exitCode: code ?? -1 });
      });

      child.on("error", (err) => {
        this.engine.fail(err.message);
        resolve({ exitCode: -1 });
      });
    });
  }

  /** 获取引擎实例 */
  getEngine(): ProgressEngine {
    return this.engine;
  }

  /** 查询当前进度 */
  static getProgress(dir: string) {
    const engine = new ProgressEngine({ dir });
    return engine.getProgress();
  }

  /** 检查是否有任务在运行 */
  static isRunning(dir: string): boolean {
    const engine = new ProgressEngine({ dir });
    return engine.isRunning();
  }
}

export default UniversalRunner;
