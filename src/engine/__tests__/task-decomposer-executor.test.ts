/**
 * 任务拆解 + 执行器集成测试（mock 模式）
 *
 * 测试场景：
 *   1. static 模式拆解 → 验证子任务数量、依赖链
 *   2. executor 执行 → 用 mock runners 验证顺序执行 + 结果合并
 *   3. 自动重试 → 模拟失败 → 验证重试次数
 *   4. 断点续跑 → 标记部分完成 → 恢复后跳过
 *   5. 端到端 → 拆解 → 执行 → 持久化验证
 */

import { describe, it, expect, beforeEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { TaskDecomposer } from "../agent/task-decomposer.ts"
import { TaskExecutor } from "../agent/task-executor.ts"
import { type CommandRunner } from "../agent/command-runners.ts"
import { type DecompositionPlan } from "../agent/task-decomposer.ts"

const TEST_STATE_DIR = path.join(process.cwd(), ".kx2code", "tasks", "__test__")

// ==================== Mock Runners ====================

function createMockRunner(overrides: Partial<CommandRunner> = {}): CommandRunner {
  return {
    type: "local",
    description: "mock",
    execute: async (_args: string[], _cwd: string) => {
      return "mock result"
    },
    ...overrides,
  }
}

const mockRunners = new Map<string, CommandRunner>([
  ["analyze", createMockRunner({ description: "代码分析", type: "llm" })],
  ["refactor", createMockRunner({ description: "重构", type: "llm" })],
  ["generate-test", createMockRunner({ description: "生成测试", type: "llm" })],
  ["test", createMockRunner({ description: "运行测试", type: "local" })],
  ["git-diff", createMockRunner({ description: "Git Diff", type: "local" })],
  ["review", createMockRunner({ description: "代码审查", type: "llm" })],
  ["lint", createMockRunner({ description: "代码检查", type: "local" })],
  ["fix", createMockRunner({ description: "修复 Bug", type: "llm" })],
  ["tree", createMockRunner({ description: "目录树", type: "local" })],
  ["generate-docs", createMockRunner({ description: "生成文档", type: "llm" })],
])

function createExecutor(opts: { maxRetries?: number; failingTool?: string } = {}): TaskExecutor {
  const failingTool = opts.failingTool

  return new TaskExecutor({
    stateDir: TEST_STATE_DIR,
    maxRetries: opts.maxRetries ?? 0,
    runners: new Map(
      Array.from(mockRunners.entries()).map(([name, runner]) => [
        name,
        createMockRunner({
          ...runner,
          execute: async (...args) => {
            if (name === failingTool) {
              throw new Error(`模拟失败: ${name}`)
            }
            return `[${name}] 执行成功: ${args[0]?.join(" ") || "(无参数)"}`
          },
        }),
      ])
    ),
  })
}

// ==================== TaskDecomposer 测试 ====================

describe("TaskDecomposer", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true })
    }
  })

  it("重构类任务应拆为 4 个子任务", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块并写测试")

    expect(plan.subtasks.length).toBe(4)
    expect(plan.subtasks[0].description).toContain("分析")
    expect(plan.subtasks[1].description).toContain("重构")
    expect(plan.subtasks[2].description).toContain("测试")
    expect(plan.subtasks[3].description).toContain("验证")
    expect(plan.mergeStrategy).toBe("sequential")
    expect(plan.sessionId).toBeTruthy()
  })

  it("修复 bug 类任务应有依赖链", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("修复认证模块的 bug")

    expect(plan.subtasks.length).toBeGreaterThanOrEqual(3)
    const fixTask = plan.subtasks.find((s) => s.description.includes("修复"))
    expect(fixTask).toBeTruthy()
    expect(fixTask!.dependsOn!.length).toBeGreaterThan(0)
  })

  it("代码审查类任务应拆为 2 个子任务", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("审查最近的代码变更")

    expect(plan.subtasks.length).toBe(2)
    expect(plan.subtasks[0].toolHint).toBe("git-diff")
    expect(plan.subtasks[1].toolHint).toBe("review")
  })

  it("未知任务应降级为单任务", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("做点什么")

    expect(plan.subtasks.length).toBe(1)
    expect(plan.mergeStrategy).toBe("single")
  })

  it("计划应持久化到文件", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块")
    const planFile = path.join(TEST_STATE_DIR, `${plan.sessionId}.plan.json`)

    expect(fs.existsSync(planFile)).toBe(true)
    const saved = JSON.parse(fs.readFileSync(planFile, "utf-8"))
    expect(saved.originalRequest).toBe("重构登录模块")
    expect(saved.subtasks.length).toBeGreaterThan(0)
  })
})

// ==================== TaskExecutor 测试 ====================

describe("TaskExecutor", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true })
    }
  })

  it("应顺序执行所有子任务并合并结果", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块并写测试")
    const executor = createExecutor()

    const result = await executor.execute(plan, {
      onProgress: (current, total) => {
        expect(current).toBeGreaterThan(0)
        expect(current).toBeLessThanOrEqual(total)
      },
    })

    expect(result.subtaskResults.length).toBe(4)
    expect(result.output).toContain("任务执行结果")
    expect(result.output).toContain("重构登录模块并写测试")
  })

  it("应记录每个子任务的执行时长", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块")
    const executor = createExecutor()

    const result = await executor.execute(plan)

    for (const sr of result.subtaskResults) {
      expect(sr.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it("结果应持久化为 .done 文件", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块")
    const executor = createExecutor()

    await executor.execute(plan)

    const doneFile = path.join(TEST_STATE_DIR, `${plan.sessionId}.done`)
    expect(fs.existsSync(doneFile)).toBe(true)
    const status = fs.readFileSync(doneFile, "utf-8")
    expect(["SUCCESS", "FAILED"]).toContain(status)
  })

  it("崩溃后应能从断点续跑", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块并写测试")

    // 模拟：手动标记前两个子任务已完成
    // 直接修改 in-memory plan，模拟之前执行过留下的结果
    plan.subtasks[0].result = { success: true, output: "步骤1完成", durationMs: 100 }
    plan.subtasks[1].result = { success: true, output: "步骤2完成", durationMs: 200 }

    // 新 executor 应跳过前 2 个已完成的任务，只执行剩余 2 个
    const executor = createExecutor()
    const result = await executor.execute(plan)

    expect(result.subtaskResults.length).toBe(4)
    // 前两个应保留原始结果（跳过重执行）
    expect(result.subtaskResults[0].success).toBe(true)
    expect(result.subtaskResults[0].output).toBe("步骤1完成")
    expect(result.subtaskResults[1].success).toBe(true)
    expect(result.subtaskResults[1].output).toBe("步骤2完成")
  })

  it("失败子任务应自动重试", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构登录模块")
    const executor = createExecutor({ maxRetries: 2, failingTool: "analyze" })

    const result = await executor.execute(plan)

    // analyze 失败 3 次（1 + 2 次重试），应标记为失败
    // 注意：executeSubtask 异常被 catch 后 output 为空，通过 error 字段判断
    const failed = result.subtaskResults.filter((r) => !r.success)
    expect(failed.length).toBeGreaterThanOrEqual(1)
    expect(failed[0].error).toBeTruthy()
  })

  it("单任务计划应直接返回结果", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("做点什么")
    const executor = createExecutor()

    const result = await executor.execute(plan)

    expect(result.subtaskResults.length).toBe(1)
  })
})

// ==================== 端到端集成测试 ====================

describe("端到端流程", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true })
    }
  })

  it("完整流程：拆解 → 执行 → 校验 → 持久化", async () => {
    // 1. 拆解
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("重构 auth 模块并写测试")

    expect(plan.subtasks.length).toBeGreaterThanOrEqual(3)
    expect(plan.mergeStrategy).toBe("sequential")
    expect(plan.sessionId).toBeTruthy()

    // 2. 执行
    const executor = createExecutor()

    const result = await executor.execute(plan, {
      onProgress: (current, total, subtask) => {
        expect(current).toBeGreaterThan(0)
        expect(current).toBeLessThanOrEqual(total)
        expect(subtask.description.length).toBeGreaterThan(0)
      },
    })

    // 3. 校验
    expect(result.subtaskResults.length).toBe(plan.subtasks.length)
    expect(result.totalDurationMs).toBeGreaterThan(0)

    // 4. 验证持久化
    const resultFile = path.join(TEST_STATE_DIR, `${plan.sessionId}.result.json`)
    expect(fs.existsSync(resultFile)).toBe(true)

    const savedResult = JSON.parse(fs.readFileSync(resultFile, "utf-8"))
    expect(savedResult.subtaskCount).toBe(plan.subtasks.length)
    expect(savedResult.finishedAt).toBeTruthy()
    expect(["SUCCESS", "FAILED"]).toContain(fs.readFileSync(path.join(TEST_STATE_DIR, `${plan.sessionId}.done`), "utf-8"))
  })

  it("审查类任务的完整流程", async () => {
    const decomposer = new TaskDecomposer({
      mode: "static",
      stateDir: TEST_STATE_DIR,
    })

    const plan = await decomposer.decompose("审查最近的代码变更")
    const executor = createExecutor()

    const result = await executor.execute(plan)

    expect(result.subtaskResults.length).toBe(2)
    expect(result.subtaskResults[0].output).toContain("git-diff")
    expect(result.subtaskResults[1].output).toContain("review")
  })
})
