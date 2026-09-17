import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

const oldLines = [
  '  /**',
  '   * @param depsOrMax 依赖注入对象，或直接给出并发上限数字。',
  '   *   传数字是为了让「并发上限」可注入（测试与运行时配置都用这个入口）；',
  '   *   非法值（0、负数、NaN）一律回落到默认值，避免把并发闸门设成 0 导致全部拒绝。',
  '   */',
  '  constructor(depsOrMax?: SubAgentManagerDeps | number) {',
  '    if (typeof depsOrMax === "number") {',
  '      this.maxConcurrentAgents = normalizeMaxConcurrent(depsOrMax);',
  '      this.deps = {};',
  '    } else {',
  '      this.deps = depsOrMax ?? {};',
  '    }',
  '    for (const [name, cfg] of Object.entries(predefinedAgents)) {',
  '      this.registry.set(name, cfg);',
  '    }',
  '  }',
]

const newLines = [
  '  /**',
  '   * @param maxOrDeps 并发上限（数字）或依赖注入对象。',
  '   *   传数字是为了让「并发上限」可注入（测试与运行时配置都走这个入口）；',
  '   *   非法值（0、负数、NaN）回落到默认，避免把并发闸门设成 0 导致全部任务被拒。',
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
]

const oldCRLF = oldLines.join('\r\n')
const oldLF = oldLines.join('\n')

let used = null
if (s.includes(oldCRLF)) used = oldCRLF
else if (s.includes(oldLF)) used = oldLF

if (!used) {
  console.log('未命中构造函数原文')
  process.exit(1)
}

s = s.replace(used, used.includes('\r\n') ? newLines.join('\r\n') : newLines.join('\n'))

writeFileSync(p, s)
console.log('已改: ' + p)
