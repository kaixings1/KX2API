/**
 * 多角色协调器 — 真实数据验证脚本（StepFun API）
 *
 * 用法：
 *   npx tsx tools/test-multiagent-real.ts
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { Planner, BUILTIN_ROLES } from "../src/engine/agent/coordinator/planner.ts"
import { Orchestrator } from "../src/engine/agent/coordinator/orchestrator.ts"

const TEST_DIR = path.join(process.cwd(), ".kx2code", "plans", "__multiagent-real__")

// ==================== LLM 配置（StepFun） ====================

const LLM_CONFIG = {
  provider: "openai" as const,
  apiKey: "2X1Go9G9hgNk1SHxSlVwhaWe0m2spQkzhTppgSdVVq4hTkR7VimUIFIT9DFCkkbDr",
  model: "step-3.7-flash",
  baseUrl: "https://api.stepfun.com/step_plan/v1",
  maxTokens: 4096,
}

// ==================== 真实 LLM 调用（原生 https，无 curl） ====================

async function realCallLLM(role: any, prompt: string): Promise<string> {
  const https = await import("node:https")

  const body = JSON.stringify({
    model: LLM_CONFIG.model,
    messages: [
      { role: "system", content: role.systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature: 0.4,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.stepfun.com",
      path: "/step_plan/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_CONFIG.apiKey}`,
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ""
      res.on("data", (chunk: Buffer) => { data += chunk.toString() })
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.message?.reasoning || ""
          console.log(`    [DEBUG] LLM response length: ${content.length}`)
          resolve(content)
        } catch (e) {
          console.log(`    [DEBUG] Parse error: ${data.slice(0, 200)}`)
          reject(new Error("Failed to parse LLM response"))
        }
      })
    })

    req.on("error", (e) => {
      console.log(`    [DEBUG] LLM error: ${e.message}`)
      reject(e)
    })

    req.write(body)
    req.end()
  })
}

// ==================== 工具函数 ====================

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${"=".repeat(60)}`)
}

function printPlanSummary(plan: any) {
  console.log(`\n  计划 ID:     ${plan.id}`)
  console.log(`  目标 ID:     ${plan.objectiveId}`)
  console.log(`  标题:        ${plan.title}`)
  console.log(`  状态:        ${plan.status}`)
  console.log(`  版本:        ${plan.version}`)
  console.log(`  讨论回合:    ${plan.discussions.length}`)

  console.log(`\n  任务列表:`)
  for (const task of plan.tasks) {
    console.log(`    [${task.id}] ${task.description}`)
    console.log(`          command: ${task.command || "(无)"} | strategy: ${task.strategy} | priority: ${task.priority}`)
    if (task.dependsOn.length > 0) {
      console.log(`          dependsOn: [${task.dependsOn.join(", ")}]`)
    }
    if (task.validate) {
      console.log(`          validate:  ${task.validate}`)
    }
  }
}

function printReport(report: any) {
  console.log(`\n  报告 ID:        ${report.planId}`)
  console.log(`  成功:           ${report.success}`)
  console.log(`  总耗时:         ${report.totalDurationMs}ms`)
  console.log(`  讨论回合数:     ${report.discussionRounds}`)
  console.log(`  任务结果数:     ${report.taskResults.length}`)
  console.log(`  完成时间:       ${report.finishedAt}`)

  console.log(`\n  任务执行详情:`)
  for (const r of report.taskResults) {
    const status = r.success ? "✅" : "❌"
    console.log(`    ${status} [${r.taskId}] ${r.description} (${r.durationMs}ms)`)
    if (r.error) console.log(`         错误: ${r.error}`)
    if (r.output) {
      const out = r.output.length > 200 ? r.output.slice(0, 200) + "..." : r.output
      console.log(`         输出: ${out}`)
    }
  }
}

// ==================== 清理 ====================

if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true })
fs.mkdirSync(TEST_DIR, { recursive: true })

// override Planner.callLLM
const plannerProto = Planner.prototype as any
const originalCallLLM = plannerProto.callLLM
plannerProto.callLLM = realCallLLM

// ==================== 测试 1: Planner 多角色讨论 ====================

section("测试 1: Planner — 多角色讨论生成 Plan（真实 LLM）")

try {
  const planner = new Planner({
    config: {
      llm: { ...LLM_CONFIG },
      maxDiscussionRounds: 2,
      plansDir: TEST_DIR,
    },
    roles: BUILTIN_ROLES,
    callbacks: {
      onPhaseChange: (phase: string, detail: string) => {
        console.log(`\n  >> 阶段切换: ${phase} — ${detail}`)
      },
      onDiscussionRound: (round: any) => {
        const role = BUILTIN_ROLES.find((r: any) => r.id === round.roleId)
        const roleName = role?.name || round.roleId
        console.log(`    [${round.phase}] ${roleName}: ${round.content.slice(0, 200)}`)
      },
    },
  })

  console.log(`  模型: ${LLM_CONFIG.model} @ ${LLM_CONFIG.baseUrl}`)
  console.log(`  角色: ${BUILTIN_ROLES.map((r: any) => r.name).join("、")}`)

  const plan = await planner.generatePlan({
    id: "real-multiagent",
    description: "给项目添加一个用户认证模块，包括登录、注册、密码重置功能",
  })

  printPlanSummary(plan)

  const planOk = plan.status === "approved" && plan.tasks.length >= 2 && plan.discussions.length > 0
  console.log(`\n  ${planOk ? "✅" : "❌"} Planner 多角色讨论 ${planOk ? "通过" : "失败"}`)

  if (!planOk) process.exitCode = 1
} catch (e) {
  console.log(`  ❌ Planner 失败: ${(e as Error).message}`)
  process.exitCode = 1
}

// ==================== 测试 2: Orchestrator 端到端 ====================

section("测试 2: Orchestrator — 端到端执行（真实 LLM）")

try {
  const orchestrator = new Orchestrator(
    {
      llm: { ...LLM_CONFIG },
      maxDiscussionRounds: 2,
      maxRetries: 0,
      plansDir: TEST_DIR,
      cwd: process.cwd(),
    },
    {
      onPhaseChange: (phase: string, detail: string) => {
        console.log(`\n  >> 阶段: ${phase} — ${detail}`)
      },
      onTaskStart: (task: any) => {
        console.log(`  >> 开始: [${task.id}] ${task.description}`)
      },
      onTaskComplete: (task: any, result: any) => {
        console.log(`  >> 完成: [${task.id}] ${result.success ? "成功" : "失败"} (${result.durationMs}ms)`)
      },
    }
  )

  const report = await orchestrator.execute({
    id: "real-e2e",
    description: "重构项目的错误处理机制，统一异常捕获和日志输出",
  })

  printReport(report)

  const reportOk = report.planId === "real-e2e" && report.taskResults.length > 0 && report.success === true
  console.log(`\n  ${reportOk ? "✅" : "❌"} Orchestrator 端到端 ${reportOk ? "通过" : "失败"}`)

  if (!reportOk) process.exitCode = 1
} catch (e) {
  console.log(`  ❌ Orchestrator 失败: ${(e as Error).message}`)
  process.exitCode = 1
}

// ==================== 检查持久化文件 ====================

section("持久化文件检查")

try {
  const planFiles = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith(".plan.json"))
  const reportFiles = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith(".report.json"))

  console.log(`  Plan 文件:   ${planFiles.length} 个`)
  for (const f of planFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(TEST_DIR, f), "utf-8"))
    console.log(`    - ${f}: status=${data.status}, tasks=${data.tasks.length}, discussions=${data.discussions.length}`)
  }

  console.log(`  Report 文件: ${reportFiles.length} 个`)
  for (const f of reportFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(TEST_DIR, f), "utf-8"))
    console.log(`    - ${f}: success=${data.success}, tasks=${data.taskResults.length}`)
  }
} catch (e) {
  console.log(`  ❌ 检查失败: ${(e as Error).message}`)
  process.exitCode = 1
}

// ==================== 恢复 + 清理 ====================

plannerProto.callLLM = originalCallLLM

section("清理")
fs.rmSync(TEST_DIR, { recursive: true })
console.log("  ✓ 临时文件已清理")
