/**
 * Demo: 长时间运行任务 — 展示进度引擎的所有功能
 *
 * 这个脚本模拟一个需要长时间运行的任务（处理 100000 条数据）
 * 展示：
 *   1. 进度实时写入文件
 *   2. 心跳机制
 *   3. 检查点（断点续跑）
 *   4. 完成通知
 *
 * 测试自动续跑：
 *   1. 运行这个脚本
 *   2. 在 Ctrl+C 中断它（模拟崩溃）
 *   3. 再次运行，看它从上次断点自动续跑
 *
 * 测试监控器：
 *   npx tsx tools/progress/progress-watcher.ts --dir D:\KX2API\output\progress --interval 1
 */

import * as fs from "fs";
import * as path from "path";
import { ProgressEngine } from "./progress-engine";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const progressDir = "D:\\KX2API\\output\\progress";

  const engine = new ProgressEngine({
    dir: progressDir,
    heartbeatInterval: 5_000,  // 5 秒心跳
    heartbeatTimeout: 30_000,  // 30 秒超时
    notifySound: true,
    notifyToast: true,
    notifyLog: true,
  });

  console.log(`[Demo] 进度目录: ${progressDir}`);
  console.log(`[Demo] 检查历史会话...`);

  // 尝试续跑
  const resumed = engine.resume();
  let startIndex = 0;
  let totalItems = 100_000;

  if (resumed && resumed.shouldResume) {
    console.log(`[Demo] ✓ 检测到未完成会话！自动续跑:`);
    console.log(`  label:       ${resumed.session.label}`);
    console.log(`  progress:    ${resumed.session.processed}/${resumed.session.total} (${resumed.session.pct}%)`);
    console.log(`  checkpoints: ${resumed.session.checkpoints.length} 个`);
    console.log(`  上次断点:    index=${resumed.lastIndex}`);
    console.log();
    startIndex = resumed.lastIndex;
    totalItems = resumed.session.total;
  } else {
    console.log(`[Demo] 没有未完成的会话，开始新任务`);
    console.log();
  }

  const state = engine.start({ total: totalItems, label: "demo-long-task" });

  console.log(`[Demo] 开始处理 ${totalItems} 条数据...`);
  console.log(`[Demo] 从 index=${startIndex} 开始`);
  console.log(`[Demo] 每处理 1000 条写入一次检查点`);
  console.log(`[Demo] 按 Ctrl+C 中断测试自动续跑`);
  console.log();

  const batchSize = 100;

  for (let i = startIndex; i < totalItems; i++) {
    // 模拟处理
    await sleep(1);

    // 每 batchSize 条上报一次
    if (i % batchSize === 0) {
      engine.tick(batchSize);
      const s = engine.getCurrentState();
      if (s) {
        process.stdout.write(
          `\r[Demo] 处理中... ${s.processed}/${s.total} (${s.pct.toFixed(1)}%) `
        );
      }
    }

    // 每 1000 条写入检查点
    if (i % 1000 === 0 && i > 0) {
      engine.checkpoint(i, { batch: i / 1000, timestamp: new Date().toISOString() });
    }
  }

  // 确保最后一 tick
  engine.tick(totalItems - (totalItems % batchSize));

  console.log();
  console.log(`[Demo] 所有数据处理完成！`);
  console.log();

  const result = {
    totalProcessed: totalItems,
    checkpoints: engine.getCurrentState()?.checkpoints?.length ?? 0,
    finishedAt: new Date().toISOString(),
  };

  engine.done(result);
  console.log(`[Demo] 结果已写入: ${progressDir}\\latest.json`);
}

main().catch((err) => {
  console.error("[Demo] 错误:", err);
  process.exit(1);
});
