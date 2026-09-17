import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/ipc/chat-handlers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 1) ExecutionReport 没有 discussionRounds 字段（只有 discussions: DiscussionRound[]）。
//    这里的语义是「讨论轮次数」，取数组长度。
s = s.replace(
  '        discussionRounds: report.discussionRounds,',
  '        // ExecutionReport 的字段是 discussions（数组），这里要的是轮次数\n        discussionRounds: report.discussions?.length ?? 0,',
)

// 2) Objective.priority 是必填 number；原调用只给了 id/description。
//    1 = 最高优先级（见 types.ts 注释），普通请求给个中庸值。
s = s.replace(
  "      const report = await orchestrator.execute({\n        id: 'team-' + Date.now(),\n        description,\n      })",
  "      const report = await orchestrator.execute({\n        id: 'team-' + Date.now(),\n        description,\n        // Objective.priority 必填；数值含义为「越大越优先」，普通互动取中位\n        priority: 5,\n      })",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
