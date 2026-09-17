import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 关键接线：createQueryEngine 此前**完全忽略** engineFactory 与 defaultEngineCtor，
// 直接返回一个「隔离桩」——子代理的 query 因此永远不跑真实模型。
// 本文件头部注释明确写着「每个子代理的引擎由 engineFactory 创建」，
// 但实现从未用它（setEngineFactory 注入了也没人读 → 空壳）。
// 这里补上优先级：外部注入的 factory → 全局默认构造器 → 隔离桩兜底。
const re =
  /  private createQueryEngine\(config: SubAgentConfig, params: ExecuteSubAgentParams\): SubAgentInstance\["engine"\] \{\r?\n    const maxTokens = params\.maxTokens \?\? config\.maxTokens \?\? 4000;/

if (!re.test(s)) {
  console.log('未命中 createQueryEngine 开头')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  private createQueryEngine(config: SubAgentConfig, params: ExecuteSubAgentParams): SubAgentInstance["engine"] {',
    '    const maxTokens = params.maxTokens ?? config.maxTokens ?? 4000;',
    '',
    '    // 优先使用外部注入的工厂：它才会把真实 apiClient 装进子引擎。',
    '    // 次选全局默认构造器；两者都没有时，落到下面的隔离桩（仅能构造、不能推理）。',
    '    const factory = this.engineFactory',
    '    if (factory) {',
    '      const engine = factory({',
    '        model: params.parentModel ?? config.model ?? "",',
    '        systemPrompt: config.systemPrompt,',
    '        maxOutputTokens: maxTokens,',
    '        allowedTools: config.allowedTools,',
    '        parentModel: params.parentModel,',
    '      })',
    '      return {',
    '        query: (input: string) => engine.query(input) as ReturnType<SubAgentEngine["query"]>,',
    '        abort: async () => { engine.abort?.() },',
    '      }',
    '    }',
    '    if (defaultEngineCtor) {',
    '      const engine = new defaultEngineCtor({',
    '        model: params.parentModel ?? config.model ?? "",',
    '        systemPrompt: config.systemPrompt,',
    '        maxOutputTokens: maxTokens,',
    '      })',
    '      return {',
    '        query: (input: string) => engine.query(input) as ReturnType<SubAgentEngine["query"]>,',
    '        abort: async () => { engine.abort?.() },',
    '      }',
    '    }',
  ].join(NL),
)

writeFileSync(p, s)
console.log('已改: ' + p)
