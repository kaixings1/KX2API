/**
 * 多角色协调器 — 完整验证脚本（Mock + 真实 LLM 双模式）
 *
 * 用法：
 *   1. Mock 模式（无需网络，直接运行）：
 *        npx tsx tools/test-multiagent-complete.ts
 *
 *   2. 真实 LLM 模式（需要有效 API key + 网络）：
 *        LLM_API_KEY=sk-xxx LLM_MODEL=deepseek-chat LLM_BASE_URL=https://api.deepseek.com npx tsx tools/test-multiagent-complete.ts
 *
 * 输出：
 *   - 控制台详细调试信息
 *   - .kx2code/plans/ 下的 .plan.json 和 .report.json 文件
 *
 * 测试覆盖：
 *   [1] 任务拆解 TaskDecomposer — 静态规则 + LLM 动态
 *   [2] 任务执行 TaskExecutor — 顺序/并行/独立 + 重试 + 续跑
 *   [3] 多角色讨论 Planner — brainstorm → debate → consensus → finalize
 *   [4] 端到端 Orchestrator — 单目标 + 多子目标 + 持久化
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { TaskDecomposer } from "../src/engine/agent/task-decomposer.ts"
import { TaskExecutor } from "../src/engine/agent/task-executor.ts"
import { Planner, BUILTIN_ROLES } from "../src/engine/agent/coordinator/planner.ts"
import { Orchestrator } from "../src/engine/agent/coordinator/orchestrator.ts"
import type { Plan, DiscussionRound, ExecutionReport } from "../src/engine/agent/coordinator/types.ts"

const TEST_DIR = path.join(process.cwd(), ".kx2code", "plans", "__complete-test__")

// ==================== LLM 配置 ====================

const API_KEY = process.env.LLM_API_KEY?.trim()
const USE_REAL_LLM = !!API_KEY

let pass = 0
let fail = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`)
    pass++
  } else {
    console.log(`  ❌ ${msg}`)
    fail++
  }
}

function section(title: string) {
  console.log(`\n${"=".repeat(70)}`)
  console.log(`  ${title}`)
  console.log(`${"=".repeat(70)}`)
}

function printDiscussion(round: DiscussionRound, rolesMap: Map<string, string>) {
  const roleName = rolesMap.get(round.roleId) || round.roleId
  console.log(`\n    [${round.phase}] ${roleName} (${round.id}):`)
  const content = round.content.length > 400 ? round.content.slice(0, 400) + "..." : round.content
  console.log(`    ${"-".repeat(60)}`)
  console.log(`    ${content}`)
}

function printPlan(plan: Plan, rolesMap: Map<string, string>) {
  console.log(`\n  📋 Plan: ${plan.id}`)
  console.log(`     标题: ${plan.title}`)
  console.log(`     状态: ${plan.status}`)
  console.log(`     版本: ${plan.version}`)
  console.log(`     讨论: ${plan.discussions.length} 轮`)
  console.log(`\n     任务列表:`)
  for (const t of plan.tasks) {
    const deps = t.dependsOn.length > 0 ? ` ← [${t.dependsOn.join(", ")}]` : ""
    console.log(`       [${t.id}] ${t.description}`)
    console.log(`            cmd=${t.command || "(无)"} | ${t.strategy} | priority=${t.priority}${deps}`)
    if (t.validate) console.log(`            validate: ${t.validate}`)
    if (t.result) console.log(`            result: success=${t.result.success} (${t.result.durationMs}ms)`)
  }
}

function printReport(report: ExecutionReport) {
  console.log(`\n  📊 Report: ${report.planId}`)
  console.log(`     成功: ${report.success}`)
  console.log(`     耗时: ${report.totalDurationMs}ms`)
  console.log(`     讨论: ${report.discussionRounds} 轮`)
  console.log(`     任务: ${report.taskResults.length} 个`)
  console.log(`\n     执行详情:`)
  for (const r of report.taskResults) {
    const icon = r.success ? "✅" : "❌"
    console.log(`       ${icon} [${r.taskId}] ${r.description} (${r.durationMs}ms)`)
    if (r.error) console.log(`           错误: ${r.error}`)
    if (r.output && r.output.length > 10) {
      const out = r.output.slice(0, 200) + (r.output.length > 200 ? "..." : "")
      console.log(`           输出: ${out}`)
    }
  }
}

// ==================== Mock LLM ====================

const MOCK_RESPONSES: Record<string, string> = {
  "请提出你的初步想法": JSON.stringify({
    title: "用户认证模块规划",
    description: "为项目添加完整的用户认证功能",
    tasks: [
      { id: "auth-1", description: "分析现有项目结构和认证需求", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "输出项目结构分析报告" },
      { id: "auth-2", description: "设计用户数据模型和数据库迁移", command: "refactor", args: [], dependsOn: ["auth-1"], strategy: "sequential", priority: 2, validate: "输出数据模型设计文档" },
      { id: "auth-3", description: "实现登录/注册 API 接口", command: "refactor", args: [], dependsOn: ["auth-2"], strategy: "parallel", priority: 3, validate: "API 测试通过" },
      { id: "auth-4", description: "实现密码重置和邮箱验证", command: "refactor", args: [], dependsOn: ["auth-2"], strategy: "parallel", priority: 3, validate: "功能测试通过" },
      { id: "auth-5", description: "编写单元测试和集成测试", command: "test", args: [], dependsOn: ["auth-3", "auth-4"], strategy: "sequential", priority: 4, validate: "测试覆盖率 >= 80%" },
      { id: "auth-6", description: "安全审查和代码审查", command: "review", args: [], dependsOn: ["auth-5"], strategy: "standalone", priority: 5, validate: "无安全漏洞" },
    ],
  }),
  "请针对上述讨论": "补充意见：建议加入 JWT token 刷新机制和登录限流保护",
  "汇总为一份可执行的 Plan": JSON.stringify({
    title: "认证模块实施计划",
    description: "完整实现用户认证",
    tasks: [
      { id: "t1", description: "分析项目结构和认证需求", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "输出分析报告" },
      { id: "t2", description: "设计数据模型", command: "refactor", args: [], dependsOn: ["t1"], strategy: "sequential", priority: 2, validate: "设计文档完成" },
      { id: "t3", description: "实现核心 API", command: "refactor", args: [], dependsOn: ["t2"], strategy: "parallel", priority: 3, validate: "API 测试通过" },
      { id: "t4", description: "编写测试", command: "test", args: [], dependsOn: ["t3"], strategy: "sequential", priority: 4, validate: "覆盖率 >= 80%" },
    ],
  }),
  "审查以下计划": "APPROVED — 计划合理，依赖关系清晰，可以执行",
}

function mockCallLLM(role: any, prompt: string): string {
  console.log(`    [DEBUG] callLLM → role=${role.id}, promptLen=${prompt.length}`)

  // 根据 prompt 关键词匹配
  for (const [keyword, response] of Object.entries(MOCK_RESPONSES)) {
    if (prompt.includes(keyword)) {
      console.log(`    [DEBUG] mock match: "${keyword.slice(0, 30)}..."`)
      return response
    }
  }

  // 默认回复
  const defaults: Record<string, string> = {
    planner: "建议按分析→设计→实现→测试→审查的顺序执行",
    discussant: "同意上述方案，建议增加错误处理和数据校验",
    reviewer: "计划可行，依赖关系合理，建议加入 CI/CD 检查",
    critic: "需要关注：1) 密码安全存储 2) token 过期处理 3) 并发登录控制",
  }
  console.log(`    [DEBUG] mock default: ${role.id}`)
  return defaults[role.id] || "同意上述方案"
}

// ==================== 真实 LLM（可选） ====================

async function realCallLLM(role: any, prompt: string): Promise<string> {
  console.log(`    [DEBUG] realCallLLM → role=${role.id}, promptLen=${prompt.length}`)

  const { execSync } = await import("node:child_process")
  const body = JSON.stringify({
    model: process.env.LLM_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: role.systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature: 0.4,
  })

  const baseUrl = process.env.LLM_BASE_URL || "https://api.deepseek.com"
  const url = `${baseUrl}/v1/chat/completions`

  try {
    const result = execSync(
      `curl -s --max-time 60 -X POST "${url}" -H "Content-Type: application/json" -H "Authorization: Bearer ${API_KEY}" -d ${JSON.stringify(body)}`,
      { encoding: "utf-8", timeout: 65_000 }
    )
    const parsed = JSON.parse(result)
    const content = parsed.choices?.[0]?.message?.content ?? ""
    console.log(`    [DEBUG] real LLM response length: ${content.length}`)
    if (content.length === 0) {
      console.log(`    [DEBUG] WARNING: empty response from LLM! Full response:`, result.slice(0, 200))
    }
    return content
  } catch (e) {
    console.log(`    [DEBUG] real LLM error: ${e}`)
    return `[${role.name}] LLM 调用失败`
  }
}

// ==================== 清理 ====================

if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true })
fs.mkdirSync(TEST_DIR, { recursive: true })

const rolesMap = new Map<string, string>()
for (const r of BUILTIN_ROLES) rolesMap.set(r.id, r.name)

// ==================== 测试 1: TaskDecomposer 拆解 ====================

section("[测试 1] TaskDecomposer — 复杂任务拆解")

const decomposer = new TaskDecomposer({
  mode: "static",
  stateDir: TEST_DIR,
})

const plan1 = await decomposer.decompose("重构登录模块并写测试")
console.log(`  拆解结果: ${plan1.subtasks.length} 个子任务`)
for (const s of plan1.subtasks) {
  console.log(`    [${s.id}] ${s.description} (strategy=${s.strategy})`)
}

assert(plan1.subtasks.length === 4, `拆出 4 个子任务（实际: ${plan1.subtasks.length}）`)
assert(plan1.subtasks[0].description.includes("分析"), "第1步: 分析")
assert(plan1.subtasks[1].description.includes("重构"), "第2步: 重构")
assert(plan1.subtasks[2].description.includes("测试"), "第3步: 测试")
assert(plan1.subtasks[3].description.includes("验证"), "第4步: 验证")
assert(plan1.mergeStrategy === "sequential", "合并策略: sequential")
assert(plan1.sessionId.length > 0, "有 sessionId")

const planFile = path.join(TEST_DIR, `${plan1.sessionId}.plan.json`)
assert(fs.existsSync(planFile), `plan.json 已写入磁盘`)

// ==================== 测试 2: TaskExecutor 执行 ====================

section("[测试 2] TaskExecutor — 执行子任务")

const executor = new TaskExecutor({
  stateDir: TEST_DIR,
  maxRetries: 1,
  validators: new Map(),
})

console.log(`  开始执行 ${plan1.subtasks.length} 个子任务...`)
const result = await executor.execute(plan1, {
  onProgress: (current, total) => {
    process.stdout.write(`\r  进度: ${current}/${total}`)
  },
})
console.log()

assert(result.subtaskResults.length === 4, `执行了 4 个子任务（实际: ${result.subtaskResults.length}）`)
assert(result.totalDurationMs >= 0, `有总耗时: ${result.totalDurationMs}ms`)
assert(result.output.includes("任务执行结果"), "输出包含合并报告")

const doneFile = path.join(TEST_DIR, `${plan1.sessionId}.done`)
assert(fs.existsSync(doneFile), `.done 文件存在`)
const doneStatus = fs.readFileSync(doneFile, "utf-8")
assert(["SUCCESS", "FAILED"].includes(doneStatus), `done 状态: ${doneStatus}`)

// ==================== 测试 3: 断点续跑 ====================

section("[测试 3] 断点续跑 — 模拟崩溃后恢复")

fs.rmSync(TEST_DIR, { recursive: true })
fs.mkdirSync(TEST_DIR, { recursive: true })

const decomposer2 = new TaskDecomposer({ mode: "static", stateDir: TEST_DIR })
const plan2 = await decomposer2.decompose("修复认证模块的 bug")

plan2.subtasks[0].result = { success: true, output: "lint 通过", durationMs: 50, executedAt: new Date().toISOString() }
plan2.subtasks[1].result = { success: true, output: "测试运行完毕", durationMs: 100, executedAt: new Date().toISOString() }

const plan2File = path.join(TEST_DIR, `${plan2.sessionId}.plan.json`)
fs.writeFileSync(plan2File, JSON.stringify(plan2, null, 2))

const executor2 = new TaskExecutor({ stateDir: TEST_DIR, maxRetries: 0 })
const result2 = await executor2.execute(plan2)

assert(result2.subtaskResults.length === plan2.subtasks.length, "总任务数不变")
assert(result2.subtaskResults[0].success === true, "任务1 跳过（保留原结果）")
assert(result2.subtaskResults[0].output === "lint 通过", "任务1 输出正确")
assert(result2.subtaskResults[1].success === true, "任务2 跳过（保留原结果）")
assert(result2.subtaskResults[1].output === "测试运行完毕", "任务2 输出正确")

// ==================== 测试 4: Planner 多角色讨论 ====================

section(`[测试 4] Planner — 多角色讨论生成 Plan (${USE_REAL_LLM ? "真实LLM" : "Mock"})`)

console.log(`  模式: ${USE_REAL_LLM ? "真实 LLM 调用" : "Mock 响应"}`)
console.log(`  角色: ${BUILTIN_ROLES.map(r => r.name).join("、")}`)

const callLLM = USE_REAL_LLM ? realCallLLM : mockCallLLM

// override protected callLLM
const plannerProto = Planner.prototype as any
const originalCallLLM = plannerProto.callLLM
plannerProto.callLLM = async function (role: any, prompt: string): Promise<string> {
  return callLLM(role, prompt)
}

try {
  const planner = new Planner({
    config: {
      llm: { provider: "openai", apiKey: API_KEY || "mock", model: process.env.LLM_MODEL || "mock-model", baseUrl: process.env.LLM_BASE_URL },
      maxDiscussionRounds: 2,
      plansDir: TEST_DIR,
    },
    roles: BUILTIN_ROLES,
    callbacks: {
      onPhaseChange: (phase, detail) => {
        console.log(`\n  >> 阶段: ${phase} — ${detail}`)
      },
      onDiscussionRound: (round) => {
        printDiscussion(round, rolesMap)
      },
    },
  })

  const plan = await planner.generatePlan({
    id: "multiagent-plan",
    description: "给项目添加一个用户认证模块，包括登录、注册、密码重置功能",
  })

  printPlan(plan, rolesMap)

  assert(plan.status === "approved", `计划状态: ${plan.status}`)
  assert(plan.tasks.length >= 2, `计划有 >=2 个任务（实际: ${plan.tasks.length}）`)
  assert(plan.discussions.length > 0, `有讨论记录（${plan.discussions.length} 轮）`)

  // 验证 tasks 有 command 字段
  const hasCommand = plan.tasks.some(t => t.command && t.command.length > 0)
  assert(hasCommand, `任务包含 command 字段`)

  // 验证依赖关系
  const hasDeps = plan.tasks.some(t => t.dependsOn.length > 0)
  assert(hasDeps, "任务存在依赖关系")

} finally {
  plannerProto.callLLM = originalCallLLM
}

// ==================== 测试 5: Orchestrator 端到端 ====================

section(`[测试 5] Orchestrator — 端到端完整流程 (${USE_REAL_LLM ? "真实LLM" : "Mock"})`)

plannerProto.callLLM = async function (role: any, prompt: string): Promise<string> {
  return callLLM(role, prompt)
}

try {
  const orchestrator = new Orchestrator(
    {
      llm: { provider: "openai", apiKey: API_KEY || "mock", model: process.env.LLM_MODEL || "mock-model", baseUrl: process.env.LLM_BASE_URL },
      maxDiscussionRounds: 2,
      maxRetries: 0,
      plansDir: TEST_DIR,
      cwd: process.cwd(),
    },
    {
      onPhaseChange: (phase, detail) => {
        console.log(`\n  >> 阶段: ${phase} — ${detail}`)
      },
      onTaskStart: (task) => {
        console.log(`  >> 开始: [${task.id}] ${task.description}`)
      },
      onTaskComplete: (task, result) => {
        console.log(`  >> 完成: [${task.id}] ${result.success ? "成功" : "失败"} (${result.durationMs}ms)`)
      },
    }
  )

  const report = await orchestrator.execute({
    id: "e2e-test",
    description: "重构项目的错误处理机制，统一异常捕获和日志输出",
  })

  printReport(report)

  assert(report.planId === "e2e-test", `report.planId = ${report.planId}`)
  assert(report.finishedAt.length > 0, "有 finishedAt")
  assert(report.totalDurationMs >= 0, `耗时: ${report.totalDurationMs}ms`)
  assert(report.taskResults.length > 0, `有 ${report.taskResults.length} 个任务结果`)

  // 验证 report 持久化
  const reportFile = path.join(TEST_DIR, "e2e-test.report.json")
  assert(fs.existsSync(reportFile), `report.json 已持久化`)
  if (fs.existsSync(reportFile)) {
    const saved = JSON.parse(fs.readFileSync(reportFile, "utf-8"))
    assert(saved.planId === "e2e-test", "report.planId 正确")
    assert(saved.taskResults.length > 0, "report.taskResults 非空")
    console.log(`\n  📁 持久化报告验证: ${reportFile}`)
    console.log(`     状态: ${saved.success} | 任务: ${saved.taskResults.length} | 耗时: ${saved.totalDurationMs}ms`)
  }

} finally {
  plannerProto.callLLM = originalCallLLM
}

// ==================== 测试 6: 多子目标并行 ====================

section("[测试 6] 多子目标并行规划")

plannerProto.callLLM = async function (role: any, prompt: string): Promise<string> {
  return callLLM(role, prompt)
}

try {
  const orchestrator2 = new Orchestrator(
    {
      llm: { provider: "openai", apiKey: API_KEY || "mock", model: process.env.LLM_MODEL || "mock-model", baseUrl: process.env.LLM_BASE_URL },
      maxDiscussionRounds: 2,
      maxRetries: 0,
      plansDir: TEST_DIR,
      cwd: process.cwd(),
    }
  )

  const multiReport = await orchestrator2.execute({
    id: "multi-obj-test",
    description: "多目标综合改进",
    subObjectives: [
      { id: "sub-perf", description: "优化项目启动速度，减少初始化耗时", priority: 1 },
      { id: "sub-test", description: "为核心模块补充单元测试，提升覆盖率", priority: 2 },
    ],
  })

  assert(multiReport.taskResults.length > 0, `有 ${multiReport.taskResults.length} 个任务结果`)
  assert(multiReport.success === true, "全部成功")

  // 验证子目标各自生成了 plan 文件
  const subPlan1 = path.join(TEST_DIR, "sub-perf.plan.json")
  const subPlan2 = path.join(TEST_DIR, "sub-test.plan.json")
  assert(fs.existsSync(subPlan1), "子目标1 plan 文件存在")
  assert(fs.existsSync(subPlan2), "子目标2 plan 文件存在")

} finally {
  plannerProto.callLLM = originalCallLLM
}

// ==================== 结果 ====================

section("最终结果")

// 列出所有持久化文件
console.log(`\n  📁 持久化文件 (${TEST_DIR}):`)
const files = fs.readdirSync(TEST_DIR).sort()
for (const f of files) {
  const stat = fs.statSync(path.join(TEST_DIR, f))
  const size = stat.size
  console.log(`     ${f} (${size} bytes)`)
}

console.log(`\n${"=".repeat(70)}`)
console.log(`  结果: ${pass} 通过, ${fail} 失败, 共 ${pass + fail} 项`)
console.log(`${"=".repeat(70)}\n`)

if (fail > 0) {
  process.exit(1)
}

// 清理
fs.rmSync(TEST_DIR, { recursive: true })
console.log("✅ 所有功能验证通过\n")
