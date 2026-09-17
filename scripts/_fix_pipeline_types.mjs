import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/pipeline.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 三元里 `['research', ...]` 字面量被推断为 string[]，与 PIPELINE_STAGES
// （WorkflowStage[]）联合后整体退化为 string[]，于是 stageToRole(stage) 、
// this.roleOutputs.set(stage, ...) 等全部报「string 不能赋给 WorkflowStage」。
const re =
  /    const stages = this\.config\.mode === 'parallel'\r?\n      \? \['research', 'analyze', 'plan', 'implement', 'verify', 'review'\]\r?\n      : PIPELINE_STAGES/

if (!re.test(s)) {
  console.log('未命中 stages 三元')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "    const stages: WorkflowStage[] = this.config.mode === 'parallel'",
    "      ? ['research', 'analyze', 'plan', 'implement', 'verify', 'review']",
    '      : PIPELINE_STAGES',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
