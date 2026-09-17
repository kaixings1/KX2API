import { readFileSync, writeFileSync } from 'node:fs'

// ── 1) base.ts：基类签名接受可选的执行器，避免子类扩参时违反 LSP ──
{
  const p = 'src/engine/flow/base.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s

  const re = /  \/\*\* 执行 Flow（子类实现） \*\/\r?\n  abstract execute\(input: string\): Promise<FlowResult>;/

  if (!re.test(s)) {
    console.log('未命中 base.execute')
    process.exit(1)
  }

  s = s.replace(
    re,
    [
      '  /**',
      '   * 执行 Flow（子类实现）。',
      '   *',
      '   * `executor` 是**可选**的步骤执行器：分步型 Flow（如 PlanningFlow）需要它',
      '   * 来实际执行每一步；单体型 Flow 不需要。',
      '   *',
      '   * 必须声明在基类上，否则子类增参会被判为「与基类签名不兼容」（TS2416/TS2322）——',
      '   * 那正是 LSP：基类能调用的地方，子类也必须能调用。',
      '   */',
      '  abstract execute(',
      '    input: string,',
      '    executor?: (step: unknown, agentKey?: string) => Promise<string>,',
      '  ): Promise<FlowResult>;',
    ].join('\n'),
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  }
}

// ── 2) planning.ts：签名对齐基类；缺执行器时返回明确失败 ──
{
  const p = 'src/engine/flow/planning.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s

  const re =
    /  async execute\(input: string, executorFn: \(step: PlanStep, agentKey\?: string\) => Promise<string>\): Promise<FlowResult> \{\r?\n    const start = Date\.now\(\);\r?\n    try \{/

  if (!re.test(s)) {
    console.log('未命中 planning.execute')
    process.exit(1)
  }

  const nl = s.includes('\r\n') ? '\r\n' : '\n'
  s = s.replace(
    re,
    [
      '  async execute(',
      '    input: string,',
      '    executorFn?: (step: PlanStep, agentKey?: string) => Promise<string>,',
      '  ): Promise<FlowResult> {',
      '    const start = Date.now();',
      '    // 分步 Flow 依赖外部执行器；缺失时明确失败，而不是在循环里 undefined(...) 崩掉',
      '    if (!executorFn) {',
      '      return {',
      '        success: false,',
      "        output: 'PlanningFlow error: 缺少 executor（分步执行需要传入步骤执行器）',",
      '        stepsCompleted: this.plan.steps.filter(s => s.status === \'completed\').length,',
      '        durationMs: Date.now() - start,',
      '      };',
      '    }',
      '    try {',
    ].join(nl),
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  }
}
