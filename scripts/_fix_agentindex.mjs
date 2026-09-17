import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/agents/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// IAgentExecutor 在整个仓库中只有这一行“导出”，没有任何定义、也没有任何消费方。
// 旧的 AgentExecutor.ts 里只有 AgentExecutor 类（export class AgentExecutor），
// 因此这里改为导出那个真实存在的名字。
s = s.replace(
  /export \{ type IAgentExecutor \} from '\.\/AgentExecutor'/,
  "export { AgentExecutor } from './AgentExecutor'",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
