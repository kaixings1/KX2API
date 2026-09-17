import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 测试（subAgentIsolation.test.ts）与调用方的用法是位置参数二连：
//   new SubAgentManager(5, factory)
//   new SubAgentManager(10, factory)
//   new SubAgentManager(1, blocked)
//   new SubAgentManager(12)            // 只给并发
//   new SubAgentManager({ ... })       // 只给 deps
//   new SubAgentManager()              // 全默认
// 故签名需同时容纳这三种形态。
const re =
  /  \/\*\*\r?\n   \* @param depsOrMax 依赖注入对象，或直接给出并发上限数字。\r?\n[\s\S]*?\r?\n  \}\r?\n(\r?\n  setDeps)/

if (!re.test(s)) {
  console.log('未命中构造函数块')
  process.exit(1)
}

const newCtor = [
  '  /**',
  '   * @param maxOrDeps 并发上限（数字），或依赖注入对象。',
  '   *   传数字是为了让「并发上限」可注入；非法值（0、负数、NaN）回落到默认，',
  '   *   避免把并发闸门设成 0 导致全部任务被拒。',
  '   * @param factory 子引擎工厂（可选）。缺省时回落到全局默认构造器 / 隔离桩。',
  '   */',
  '  constructor(maxOrDeps?: number | SubAgentManagerDeps, factory?: IsolatedEngineFactory) {',
  '    if (typeof maxOrDeps === "number") {',
  '      this.maxConcurrentAgents = normalizeMaxConcurrent(maxOrDeps);',
  '      this.deps = {};',
  '    } else {',
  '      this.deps = maxOrDeps ?? {};',
  '    }',
  '    if (factory) this.engineFactory = factory;',
  '    for (const [name, cfg] of Object.entries(predefinedAgents)) {',
  '      this.registry.set(name, cfg);',
  '    }',
  '  }',
  '$1',
].join(NL)

s = s.replace(re, newCtor)

writeFileSync(p, s)
console.log('已改: ' + p)
