import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 类型已存在于本文件（IsolatedEngineFactory），此前我按 engine-bridge 的调用
// 写成了 SubAgentEngineFactory。统一为现成名字，避免重复定义同一概念。
s = s.replace('setEngineFactory(factory: SubAgentEngineFactory): void {', 'setEngineFactory(factory: IsolatedEngineFactory): void {')

// 声明字段
s = s.replace(
  '  private deps: SubAgentManagerDeps = {};',
  '  private deps: SubAgentManagerDeps = {};' + NL +
  '  /** 子引擎工厂：由外部注入真实的引擎装配（缺省回落到 defaultEngineCtor / 隔离桩） */' + NL +
  '  private engineFactory: IsolatedEngineFactory | null = null;',
)

writeFileSync(p, s)
console.log('已改: ' + p)
