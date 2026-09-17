import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/pipeline.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// buildSummary 里引用了 this.totalDuration，但类中并无该字段（真 bug：
// 摘要里的「总耗时」永远取不到值）。总耗时是 buildResult 用 startTime 算出来的，
// 正确做法是把它作为参数传进来，而不是虚构一个实例字段。
const reCall = /      totalDuration: Date\.now\(\) - startTime,\r?\n      totalIterations: this\.totalIterations,\r?\n      summary: this\.buildSummary\(success, finalStage, results, qualityScore\),/

if (!reCall.test(s)) {
  console.log('未命中 buildSummary 调用点')
  process.exit(1)
}

s = s.replace(
  reCall,
  [
    '      totalDuration: Date.now() - startTime,',
    '      totalIterations: this.totalIterations,',
    '      // 总耗时需显式传入：buildSummary 是独立方法，拿不到此处的 startTime',
    '      summary: this.buildSummary(success, finalStage, results, qualityScore, Date.now() - startTime),',
  ].join(NL),
)

const reSig =
  /  private buildSummary\(success: boolean, finalStage: WorkflowStage, results: RoleExecutionResult\[\], qualityScore: number\): string \{/

if (!reSig.test(s)) {
  console.log('未命中 buildSummary 签名')
  process.exit(1)
}

s = s.replace(
  reSig,
  '  private buildSummary(' +
    NL +
    '    success: boolean,' +
    NL +
    '    finalStage: WorkflowStage,' +
    NL +
    '    results: RoleExecutionResult[],' +
    NL +
    '    qualityScore: number,' +
    NL +
    '    /** 总耗时（ms），由调用方传入 */' +
    NL +
    '    totalDuration: number,' +
    NL +
    '  ): string {',
)

s = s.replace(
  '      `总耗时: ${this.formatDuration(this.totalDuration)}`,',
  '      `总耗时: ${this.formatDuration(totalDuration)}`,',
)

writeFileSync(p, s)
console.log('已改: ' + p)
