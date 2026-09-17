/**
 * engine/flow/planning.ts — PlanningFlow
 *
 * 分步执行 Flow：先用 LLM 生成计划，再逐步骤分配 Agent 执行。
 * 步骤状态：not_started → in_progress → completed/blocked
 */
import { BaseFlow, type FlowAgent, type FlowResult } from './base.ts';

export type PlanStepStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface PlanStep {
  text: string;
  status: PlanStepStatus;
  /** 可选的 Agent key，指定执行该步骤的 Agent */
  agentKey?: string;
  notes?: string;
}

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  createdAt: number;
}

/** 工作单元 */
export interface WorkUnit {
  id: string
  name: string
  description: string
  dependsOn: string[]
  scope: string[]
  acceptanceTests: string[]
  riskLevel: 'trivial' | 'small' | 'medium' | 'large'
  rollbackPlan?: string
  agentKey?: string
}

/** DAG 分解结果 */
export interface DAGResult {
  layers: string[][]
  units: Map<string, WorkUnit>
  totalUnits: number
}

const STATUS_MARKS: Record<PlanStepStatus, string> = {
  not_started: '[ ]',
  in_progress: '[→]',
  completed: '[✓]',
  blocked: '[!]',
};

/**
 * 全局计划存储（会话级）
 */
const planStore = new Map<string, Plan>();

export function getPlan(id: string): Plan | undefined {
  return planStore.get(id);
}

export function getAllPlans(): Plan[] {
  return Array.from(planStore.values());
}

export function clearPlans(): void {
  planStore.clear();
}

// ---------------------------------------------------------------------------
// PlanningFlow
// ---------------------------------------------------------------------------

export class PlanningFlow extends BaseFlow {
  readonly planId: string;
  private plan: Plan;
  private stepIndex: number = 0;

  constructor(opts: {
    agents: FlowAgent[] | Record<string, FlowAgent>;
    planTitle?: string;
    planId?: string;
    executorKeys?: string[];
    metadata?: Record<string, unknown>;
  }) {
    super(opts);
    this.planId = opts.planId ?? `plan_${Date.now()}`;
    this.plan = {
      id: this.planId,
      title: opts.planTitle ?? 'Untitled Plan',
      steps: [],
      createdAt: Date.now(),
    };
    planStore.set(this.planId, this.plan);
  }

  createSteps(steps: string[]): void {
    this.plan.steps = steps.map(text => ({
      text,
      status: 'not_started' as PlanStepStatus,
    }));
  }

  async execute(
    input: string,
    executorFn?: (step: PlanStep, agentKey?: string) => Promise<string>,
  ): Promise<FlowResult> {
    const start = Date.now();
    // 分步 Flow 依赖外部执行器；缺失时明确失败，而不是在循环里 undefined(...) 崩掉
    if (!executorFn) {
      return {
        success: false,
        output: 'PlanningFlow error: 缺少 executor（分步执行需要传入步骤执行器）',
        stepsCompleted: this.plan.steps.filter(s => s.status === 'completed').length,
        durationMs: Date.now() - start,
      };
    }
    try {
      if (this.plan.steps.length === 0) {
        this.plan.steps = [
          { text: input || 'Execute task', status: 'not_started' },
          { text: 'Verify results', status: 'not_started' },
        ];
      }

      if (input && this.plan.title === 'Untitled Plan') {
        this.plan.title = input.length > 50 ? input.slice(0, 50) + '...' : input;
      }

      let stepsCompleted = 0;
      for (let i = 0; i < this.plan.steps.length; i++) {
        const step = this.plan.steps[i];
        step.status = 'in_progress';

        const agentKey = step.agentKey ?? this.executorKeys[0];
        const result = await executorFn(step, agentKey);

        step.status = 'completed';
        step.notes = result.slice(0, 200);
        stepsCompleted++;
      }

      return {
        success: true,
        output: this.getPlanText(),
        stepsCompleted,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `PlanningFlow error: ${message}`,
        stepsCompleted: this.plan.steps.filter(s => s.status === 'completed').length,
        durationMs: Date.now() - start,
      };
    }
  }

  getPlanText(): string {
    const completed = this.plan.steps.filter(s => s.status === 'completed').length;
    const total = this.plan.steps.length;
    const progress = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

    const header = `Plan: ${this.plan.title} (ID: ${this.plan.id})`;
    let text = `${header}\n${'='.repeat(header.length)}\n\n`;
    text += `Progress: ${completed}/${total} steps completed (${progress}%)\n\n`;
    text += 'Steps:\n';

    for (let i = 0; i < this.plan.steps.length; i++) {
      const step = this.plan.steps[i];
      const mark = STATUS_MARKS[step.status];
      text += `  ${i}. ${mark} ${step.text}\n`;
      if (step.notes) {
        text += `     Notes: ${step.notes}\n`;
      }
    }
    return text;
  }

  markStepCompleted(index: number): void {
    if (index >= 0 && index < this.plan.steps.length) {
      this.plan.steps[index].status = 'completed';
    }
  }

  markStepBlocked(index: number): void {
    if (index >= 0 && index < this.plan.steps.length) {
      this.plan.steps[index].status = 'blocked';
    }
  }
}

// ---------------------------------------------------------------------------
// DAGDecomposer
// ---------------------------------------------------------------------------

export class DAGDecomposer {
  static decompose(objective: string): DAGResult {
    const units = new Map<string, WorkUnit>()
    const layers: string[][] = []

    const unitSpecs: Array<{ id: string; name: string; deps: string[]; risk: WorkUnit['riskLevel'] }> = [
      { id: 'research', name: 'Research & Analysis', deps: [], risk: 'trivial' },
      { id: 'plan', name: 'Implementation Plan', deps: ['research'], risk: 'small' },
      { id: 'implement', name: 'Implementation', deps: ['plan'], risk: 'medium' },
      { id: 'test', name: 'Testing', deps: ['implement'], risk: 'small' },
      { id: 'review', name: 'Code Review', deps: ['implement', 'test'], risk: 'small' },
    ]

    for (const spec of unitSpecs) {
      units.set(spec.id, {
        id: spec.id,
        name: spec.name,
        description: `${spec.name} for: ${objective}`,
        dependsOn: spec.deps,
        scope: [],
        acceptanceTests: [],
        riskLevel: spec.risk,
      })
    }

    // 拓扑分层（Kahn's algorithm）
    const inDegree = new Map<string, number>()
    const adj = new Map<string, string[]>()

    for (const [id, unit] of units) {
      inDegree.set(id, unit.dependsOn.length)
      adj.set(id, [])
    }

    for (const [, unit] of units) {
      for (const dep of unit.dependsOn) {
        if (adj.has(dep)) {
          adj.get(dep)!.push(unit.id)
        }
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    while (queue.length > 0) {
      const layer: string[] = []
      const nextQueue: string[] = []

      for (const id of queue) {
        layer.push(id)
        for (const next of adj.get(id) || []) {
          const newDeg = (inDegree.get(next) || 1) - 1
          inDegree.set(next, newDeg)
          if (newDeg === 0) nextQueue.push(next)
        }
      }

      if (layer.length > 0) layers.push(layer)
      queue.length = 0
      queue.push(...nextQueue)
    }

    return { layers, units, totalUnits: units.size }
  }

  static getNextLayer(result: DAGResult, completed: Set<string>): string[] {
    for (const layer of result.layers) {
      const pending = layer.filter(id => !completed.has(id))
      if (pending.length > 0) {
        const allDepsMet = pending.every(id => {
          const unit = result.units.get(id)
          return unit ? unit.dependsOn.every(dep => completed.has(dep)) : false
        })
        if (allDepsMet) return pending
      }
    }
    return []
  }
}
