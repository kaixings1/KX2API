/**
 * Coordinator 模块集成测试
 *
 * 策略：override Planner.callLLM 直接 mock LLM 响应
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { Orchestrator } from "../agent/coordinator/orchestrator.ts"
import type { Objective } from "../agent/coordinator/types.ts"

const TEST_PLANS_DIR = path.join(process.cwd(), ".kx2code", "plans", "__test__")

// ==================== LLM Mock ====================

const PLAN_RESPONSE = JSON.stringify({
  title: "测试计划",
  description: "测试描述",
  tasks: [
    { id: "task-1", description: "分析目标", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "输出分析结果" },
    { id: "task-2", description: "实施方案", command: "refactor", args: [], dependsOn: ["task-1"], strategy: "sequential", priority: 2, validate: "输出实施结果" },
  ],
})

const APPROVED_RESPONSE = "APPROVED"

// 直接 override Planner.prototype.callLLM（跳过 execSync）
import { Planner } from "../agent/coordinator/planner.ts"

const originalCallLLM = Planner.prototype.callLLM

beforeEach(() => {
  if (fs.existsSync(TEST_PLANS_DIR)) {
    fs.rmSync(TEST_PLANS_DIR, { recursive: true })
  }
  // 每个测试前重新应用 mock
  Planner.prototype.callLLM = async function (role: any, prompt: string): Promise<string> {
    if (prompt.includes("汇总为一份可执行的 Plan")) {
      return PLAN_RESPONSE
    }
    if (prompt.includes("审查以下计划")) {
      return APPROVED_RESPONSE
    }
    if (prompt.includes("请提出你的初步想法")) {
      if (role.id === "planner") {
        return "建议分三步：分析现状 → 实施方案 → 验证结果"
      }
      return "同意规划师思路，建议加入代码质量检查"
    }
    // debate 阶段
    return "补充意见：建议加入自动化测试环节"
  }
})

afterEach(() => {
  // 恢复原始方法
  Planner.prototype.callLLM = originalCallLLM
})

// ==================== 测试 ====================

describe("Orchestrator", () => {
  it("应执行单目标并返回报告", async () => {
    const orchestrator = new Orchestrator(
      {
        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
        maxDiscussionRounds: 1,
        maxRetries: 0,
        plansDir: TEST_PLANS_DIR,
        cwd: process.cwd(),
      },
      {
        onPhaseChange: (phase, detail) => console.log(`  [test] ${phase}: ${detail}`),
        onTaskStart: (task) => console.log(`  [test] start: ${task.description}`),
        onTaskComplete: (task, result) => console.log(`  [test] done: ${task.description} (${result.success})`),
      }
    )

    const report = await orchestrator.execute({ id: "obj-1", description: "重构登录模块" })

    expect(report.planId).toBe("obj-1")
    expect(report.finishedAt).toBeTruthy()
    expect(report.totalDurationMs).toBeGreaterThan(0)
    expect(report.taskResults.length).toBeGreaterThan(0)
  })

  it("应执行多子目标", async () => {
    const orchestrator = new Orchestrator({
      llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
      maxDiscussionRounds: 1,
      maxRetries: 0,
      plansDir: TEST_PLANS_DIR,
      cwd: process.cwd(),
    })

    const report = await orchestrator.execute({
      id: "obj-multi",
      description: "多目标测试",
      subObjectives: [
        { id: "sub-1", description: "子目标1" },
        { id: "sub-2", description: "子目标2" },
      ],
    })

    expect(report.taskResults.length).toBeGreaterThan(0)
  })

  it("报告应持久化到磁盘", async () => {
    const orchestrator = new Orchestrator({
      llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
      maxDiscussionRounds: 1,
      maxRetries: 0,
      plansDir: TEST_PLANS_DIR,
      cwd: process.cwd(),
    })

    const report = await orchestrator.execute({ id: "obj-persist", description: "测试持久化" })
    orchestrator.persistReport(report)

    const reportFile = path.join(TEST_PLANS_DIR, "obj-persist.report.json")
    expect(fs.existsSync(reportFile)).toBe(true)

    const saved = JSON.parse(fs.readFileSync(reportFile, "utf-8"))
    expect(saved.planId).toBe("obj-persist")
    expect(saved.finishedAt).toBeTruthy()
  })

  it("断点续跑应恢复未完成的计划", async () => {
    // 创建一个已执行了一部分的 plan
    const partialPlan = {
      id: "plan-resume",
      objectiveId: "obj-resume",
      title: "续跑测试",
      description: "测试续跑",
      tasks: [
        {
          id: "task-1",
          description: "已完成的任务",
          strategy: "sequential",
          priority: 1,
          dependsOn: [],
          result: { success: true, output: "已完成", durationMs: 100, executedAt: new Date().toISOString() },
        },
        {
          id: "task-2",
          description: "待执行的任务",
          strategy: "sequential",
          priority: 2,
          dependsOn: ["task-1"],
        },
      ],
      discussions: [],
      createdAt: new Date().toISOString(),
      status: "executing",
      version: 1,
    }

    fs.mkdirSync(TEST_PLANS_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_PLANS_DIR, "obj-resume.plan.json"), JSON.stringify(partialPlan))

    const orchestrator = new Orchestrator({
      llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
      maxDiscussionRounds: 1,
      maxRetries: 0,
      plansDir: TEST_PLANS_DIR,
      cwd: process.cwd(),
    })

    const report = await orchestrator.execute({ id: "obj-resume", description: "续跑测试" })

    expect(report.planId).toBe("obj-resume")
    expect(report.finishedAt).toBeTruthy()
    expect(report.taskResults.length).toBeGreaterThanOrEqual(1)
  })
})

describe("端到端集成", () => {
  it("完整流程：目标 → 规划 → 执行 → 报告", async () => {
    const orchestrator = new Orchestrator(
      {
        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
        maxDiscussionRounds: 1,
        maxRetries: 1,
        plansDir: TEST_PLANS_DIR,
        cwd: process.cwd(),
      },
      {
        onPhaseChange: (phase, detail) => console.log(`  [e2e] ${phase}: ${detail}`),
        onTaskStart: (task) => console.log(`  [e2e] start: ${task.description}`),
        onTaskComplete: (task, result) => console.log(`  [e2e] done: ${task.description} (${result.success})`),
      }
    )

    const report = await orchestrator.execute({
      id: "e2e-obj",
      description: "重构 auth 模块并写测试",
      priority: 1,
      subObjectives: [
        { id: "sub-analysis", description: "分析现有 auth 模块", priority: 1 },
        { id: "sub-refactor", description: "重构 auth 模块", priority: 2 },
      ],
    })

    expect(report.planId).toBe("e2e-obj")
    expect(report.finishedAt).toBeTruthy()
    expect(report.totalDurationMs).toBeGreaterThan(0)
    expect(report.taskResults.length).toBeGreaterThan(0)

    // 子目标各自生成 plan 文件
    const subPlanFile = path.join(TEST_PLANS_DIR, "sub-analysis.plan.json")
    expect(fs.existsSync(subPlanFile)).toBe(true)
  })
})
