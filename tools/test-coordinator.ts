/**
 * 最简单的功能验证脚本
 * 直接运行：npx tsx tools/test-coordinator.ts
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { TaskDecomposer } from "../src/engine/agent/task-decomposer.ts"
import { TaskExecutor } from "../src/engine/agent/task-executor.ts"
import { Planner, BUILTIN_ROLES } from "../src/engine/agent/coordinator/planner.ts"
import { Orchestrator } from "../src/engine/agent/coordinator/orchestrator.ts"

const TEST_DIR = path.join(process.cwd(), ".kx2code", "tasks", "__simple-test__")

// 清理
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true })
fs.mkdirSync(TEST_DIR, { recursive: true })

let pass = 0
let fail = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    pass++
  } else {
    console.log(`  ✗ ${msg}`)
    fail++
  }
}

// ==================== 测试 1: 任务拆解 ====================

console.log("\n[测试 1] TaskDecomposer — 拆解复杂任务")

const decomposer = new TaskDecomposer({
  mode: "static",
  stateDir: TEST_DIR,
})

const plan = await decomposer.decompose("重构登录模块并写测试")
assert(plan.subtasks.length === 4, `拆出 4 个子任务（实际: ${plan.subtasks.length}）`)
assert(plan.subtasks[0].description.includes("分析"), "第1步: 分析")
assert(plan.subtasks[1].description.includes("重构"), "第2步: 重构")
assert(plan.subtasks[2].description.includes("测试"), "第3步: 测试")
assert(plan.subtasks[3].description.includes("验证"), "第4步: 验证")
assert(plan.mergeStrategy === "sequential", "合并策略: sequential")
assert(plan.sessionId.length > 0, "有 sessionId")

// 验证 plan 文件已写入
const planFile = path.join(TEST_DIR, `${plan.sessionId}.plan.json`)
assert(fs.existsSync(planFile), `plan.json 已写入磁盘`)

// ==================== 测试 2: 任务执行 ====================

console.log("\n[测试 2] TaskExecutor — 执行子任务")

const executor = new TaskExecutor({
  stateDir: TEST_DIR,
  maxRetries: 1,
  validators: new Map(),
})

const result = await executor.execute(plan, {
  onProgress: (current, total) => {
    process.stdout.write(`\r  进度: ${current}/${total}`)
  },
})
console.log() // 换行

assert(result.subtaskResults.length === 4, `执行了 4 个子任务（实际: ${result.subtaskResults.length}）`)
assert(result.totalDurationMs >= 0, `有总耗时: ${result.totalDurationMs}ms`)
assert(result.output.includes("任务执行结果"), "输出包含合并报告")

// 验证 done 文件
const doneFile = path.join(TEST_DIR, `${plan.sessionId}.done`)
assert(fs.existsSync(doneFile), `.done 文件存在`)
const doneStatus = fs.readFileSync(doneFile, "utf-8")
assert(["SUCCESS", "FAILED"].includes(doneStatus), `done 状态: ${doneStatus}`)

// ==================== 测试 3: 断点续跑 ====================

console.log("\n[测试 3] 断点续跑 — 模拟崩溃后恢复")

// 清理
fs.rmSync(TEST_DIR, { recursive: true })
fs.mkdirSync(TEST_DIR, { recursive: true })

// 创建新计划
const decomposer2 = new TaskDecomposer({ mode: "static", stateDir: TEST_DIR })
const plan2 = await decomposer2.decompose("修复认证模块的 bug")

// 模拟：手动标记前 2 个子任务已完成
plan2.subtasks[0].result = { success: true, output: "lint 通过", durationMs: 50 }
plan2.subtasks[1].result = { success: true, output: "测试运行完毕", durationMs: 100 }

// 保存修改后的 plan
const plan2File = path.join(TEST_DIR, `${plan2.sessionId}.plan.json`)
fs.writeFileSync(plan2File, JSON.stringify(plan2, null, 2))

// 新 executor 应跳过前 2 个已完成的任务
const executor2 = new TaskExecutor({ stateDir: TEST_DIR, maxRetries: 0 })
const result2 = await executor2.execute(plan2)

assert(result2.subtaskResults.length === plan2.subtasks.length, "总任务数不变")
assert(result2.subtaskResults[0].success === true, "任务1 跳过（保留原结果）")
assert(result2.subtaskResults[0].output === "lint 通过", "任务1 输出正确")
assert(result2.subtaskResults[1].success === true, "任务2 跳过（保留原结果）")
assert(result2.subtaskResults[1].output === "测试运行完毕", "任务2 输出正确")

// ==================== 测试 4: 规划器生成 Plan ====================

console.log("\n[测试 4] Planner — 多角色讨论生成 Plan")

// 直接 mock callLLM
const { Planner } = await import("../src/engine/agent/coordinator/planner.ts")
const originalCallLLM = Planner.prototype.callLLM
Planner.prototype.callLLM = async function (_role: any, prompt: string): Promise<string> {
  if (prompt.includes("汇总为一份可执行的 Plan")) {
    return JSON.stringify({
      title: "集成测试计划",
      description: "验证 planner",
      tasks: [
        { id: "t1", description: "分析代码", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "输出分析" },
        { id: "t2", description: "实施重构", command: "refactor", args: [], dependsOn: ["t1"], strategy: "sequential", priority: 2, validate: "输出重构结果" },
      ],
    })
  }
  if (prompt.includes("审查以下计划")) return "APPROVED"
  return "讨论意见"
}

const planner = new Planner({
  config: {
    llm: { provider: "openai", apiKey: "test", model: "gpt-4" },
    maxDiscussionRounds: 1,
    plansDir: TEST_DIR,
  },
  roles: BUILTIN_ROLES,
})

const generatedPlan = await planner.generatePlan({ id: "test-plan", description: "测试规划" })
assert(generatedPlan.status === "approved", "计划状态: approved")
assert(generatedPlan.tasks.length === 2, `计划有 2 个任务（实际: ${generatedPlan.tasks.length}）`)
assert(generatedPlan.tasks[0].id === "t1", "任务1 id 正确")
assert(generatedPlan.tasks[1].dependsOn.includes("t1"), "任务2 依赖任务1")
assert(generatedPlan.discussions.length > 0, "有讨论记录")

Planner.prototype.callLLM = originalCallLLM

// ==================== 测试 5: 端到端 ====================

console.log("\n[测试 5] Orchestrator — 端到端完整流程")

// 重新 mock
Planner.prototype.callLLM = async function (_role: any, prompt: string): Promise<string> {
  if (prompt.includes("汇总为一份可执行的 Plan")) {
    return JSON.stringify({
      title: "E2E 测试",
      tasks: [
        { id: "t1", description: "分析", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "ok" },
      ],
    })
  }
  if (prompt.includes("审查以下计划")) return "APPROVED"
  return "ok"
}

const orchestrator = new Orchestrator(
  {
    llm: { provider: "openai", apiKey: "test", model: "gpt-4" },
    maxDiscussionRounds: 1,
    maxRetries: 0,
    plansDir: TEST_DIR,
    cwd: process.cwd(),
  },
  {
    onPhaseChange: (p) => console.log(`    阶段: ${p}`),
  }
)

const report = await orchestrator.execute({ id: "e2e-test", description: "端到端测试" })
assert(report.planId === "e2e-test", `report.planId = ${report.planId}`)
assert(report.finishedAt.length > 0, "有 finishedAt")
assert(report.totalDurationMs >= 0, `耗时: ${report.totalDurationMs}ms`)
assert(report.taskResults.length > 0, `有 ${report.taskResults.length} 个任务结果`)

Planner.prototype.callLLM = originalCallLLM

// ==================== 结果 ====================

console.log(`\n${"=".repeat(50)}`)
console.log(`  结果: ${pass} 通过, ${fail} 失败, 共 ${pass + fail} 项`)
console.log(`${"=".repeat(50)}\n`)

if (fail > 0) {
  process.exit(1)
}

// 清理
fs.rmSync(TEST_DIR, { recursive: true })
console.log("✓ 所有功能验证通过\n")
