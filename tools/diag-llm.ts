/**
 * 诊断 LLM 响应 — 打印原始返回内容
 */

import { execSync } from "node:child_process"

const API_KEY = "sk-2932c2b5df154948a721024a6d74b4fe"
const MODEL = "deepseek-chat"
const BASE_URL = "https://api.deepseek.com"
const ROLE_NAME = "规划师"
const SYSTEM_PROMPT = `你是 KX2Code 的规划师。你的职责是：
1. 分析用户需求，将其分解为可执行的任务
2. 定义每个任务的目标、输入、输出、验证条件
3. 确定任务之间的依赖关系和执行顺序
4. 最终汇总所有讨论结果，生成可执行的 Plan JSON

输出要求：
- 任务描述具体、可执行
- 依赖关系清晰
- 每个任务有明确的验证条件`
const USER_PROMPT = `用户目标: 给项目添加一个用户认证模块，包括登录、注册、密码重置功能

请提出你的初步想法和方案。`

const body = JSON.stringify({
  model: MODEL,
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: USER_PROMPT },
  ],
  max_tokens: 2048,
  temperature: 0.4,
})

const url = `${BASE_URL}/v1/chat/completions`

console.log("请求 URL:", url)
console.log("模型:", MODEL)
console.log("System prompt 长度:", SYSTEM_PROMPT.length)
console.log("User prompt 长度:", USER_PROMPT.length)
console.log()

try {
  const result = execSync(
    `curl -s -X POST "${url}" -H "Content-Type: application/json" -H "Authorization: Bearer ${API_KEY}" -d ${JSON.stringify(body)}`,
    { encoding: "utf-8", timeout: 60_000 }
  )
  console.log("=== 原始响应 ===")
  console.log(result)
  console.log()
  console.log("=== 解析后 ===")
  const parsed = JSON.parse(result)
  console.log("choices 数量:", parsed.choices?.length)
  const content = parsed.choices?.[0]?.message?.content ?? ""
  console.log("content 长度:", content.length)
  console.log("content:", content.slice(0, 500))
} catch (e) {
  console.error("调用失败:", e)
}
