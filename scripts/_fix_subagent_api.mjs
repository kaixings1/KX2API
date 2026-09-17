import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// ── 1) 导出默认并发常量（测试导入它） ──
if (!s.includes('DEFAULT_MAX_CONCURRENT_AGENTS')) {
  s = s.replace(
    'export class SubAgentManager {',
    '/** 子代理默认并发上限（此前硬编码在类字段里，现可运行时调整） */' + NL +
    'export const DEFAULT_MAX_CONCURRENT_AGENTS = 5' + NL + NL +
    'export class SubAgentManager {',
  )
}

// ── 2) 字段默认值改用常量 ──
s = s.replace(
  '  private maxConcurrentAgents = 5;',
  '  private maxConcurrentAgents = DEFAULT_MAX_CONCURRENT_AGENTS;',
)

// ── 3) 构造函数：兼容 `new SubAgentManager(12)`（并发上限）与 `new SubAgentManager({...})`（deps） ──
const oldCtor = [
  '  constructor(deps?: SubAgentManagerDeps) {',
  '    this.deps = deps ?? {};',
  '    for (const [name, cfg] of Object.entries(predefinedAgents)) {',
  '      this.registry.set(name, cfg);',
  '    }',
  '  }',
].join(NL)

const oldCtorLF = oldCtor.replace(/\r\n/g, '\n')

const newCtor = [
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
].join(NL)

let used = null
if (s.includes(oldCtor)) used = oldCtor
else if (s.includes(oldCtorLF)) used = oldCtorLF

if (!used) {
  console.log('未命中构造函数')
  process.exit(1)
}
s = s.replace(used, used.includes('\r\n') ? newCtor : newCtor.replace(/\r\n/g, '\n'))

// ── 4) 追加 API 与归一化函数 ──
const anchor = '  setDeps(deps: SubAgentManagerDeps): void {'
if (!s.includes(anchor)) {
  console.log('未命中 setDeps 锚点')
  process.exit(1)
}

const api = [
  '  /**',
  '   * 运行时更新并发上限（设置界面改完即时生效）。',
  '   * 非法值不改变既有设置 —— 静默忽略比"回落默认"更安全：',
  '   * 用户误填 0 时不该把已经调好的 12 悄悄变回 5。',
  '   */',
  '  setMaxConcurrentAgents(max: number): void {',
  '    if (!Number.isFinite(max) || max < 1) return;',
  '    this.maxConcurrentAgents = Math.floor(max);',
  '  }',
  '',
  '  /** 当前并发状况（供 UI 展示与测试断言） */',
  '  getConcurrencyInfo(): { max: number; active: number; available: number } {',
  '    return {',
  '      max: this.maxConcurrentAgents,',
  '      active: this.activeAgents,',
  '      available: Math.max(0, this.maxConcurrentAgents - this.activeAgents),',
  '    };',
  '  }',
  '',
  '  /**',
  '   * 注入子引擎工厂。',
  '   *',
  '   * 缺省实现只是「能构造、不能工作」——内部 createQueryEngine 返回的是隔离桩，',
  '   * 真正的推理由调用方经此注入的工厂提供（否则子代理的 query 不会真的跑模型）。',
  '   */',
  '  setEngineFactory(factory: SubAgentEngineFactory): void {',
  '    this.engineFactory = factory;',
  '  }',
  '',
].join(NL)

s = s.replace(anchor, api + anchor)

// ── 5) 归一化辅助函数（放在类之后，或复用已有 DEFAULT 常量的位置） ──
if (!s.includes('function normalizeMaxConcurrent')) {
  s = s.replace(
    'export class SubAgentManager {',
    '/** 归一化并发上限：非有限值或小于 1 时回落默认 */' + NL +
    'function normalizeMaxConcurrent(n: number): number {' + NL +
    '  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_CONCURRENT_AGENTS' + NL +
    '  return Math.floor(n)' + NL +
    '}' + NL + NL +
    'export class SubAgentManager {',
  )
}

writeFileSync(p, s)
console.log('已改: ' + p)
