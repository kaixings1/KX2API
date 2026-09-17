import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/agent/command-runners.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 测试（tests/agent/dispatcher.test.ts）明确断言：
//   getRunnerType('agents-platform') === 'team'
//   dispatch('agents-platform', ...) 走 Team 多角色编排
// 因此 agents-platform 必须绑定 team 版实现；原先绑定的 local 版
// （列出可用子代理类型）改挂到 agents-platform-info，能力不丢。
const re =
  /  \['agents-platform', agentsPlatformImpl\],\r?\n  \['team', teamOrchestrationImpl\],\r?\n/

if (!re.test(s)) {
  console.log('未命中注册表两行')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "  ['agents-platform', teamOrchestrationImpl],",
    "  ['agents-platform-info', agentsPlatformImpl],",
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
