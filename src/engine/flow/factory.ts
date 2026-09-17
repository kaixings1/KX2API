/**
 * engine/flow/factory.ts — FlowFactory
 *
 * 工厂类：根据 Flow 类型创建对应的 Flow 实例。
 */
import { BaseFlow, type FlowAgent } from './base.ts';
import { PlanningFlow, type PlanStep } from './planning.ts';

export type FlowType = 'planning';

export interface FlowFactoryOptions {
  type: FlowType;
  agents: FlowAgent[] | Record<string, FlowAgent>;
  executorKeys?: string[];
  planTitle?: string;
  planId?: string;
  metadata?: Record<string, unknown>;
}

export class FlowFactory {
  static create(opts: FlowFactoryOptions): BaseFlow {
    switch (opts.type) {
      case 'planning':
        return new PlanningFlow({
          agents: opts.agents,
          executorKeys: opts.executorKeys,
          planTitle: opts.planTitle,
          planId: opts.planId,
          metadata: opts.metadata,
        });
      default:
        throw new Error(`Unknown flow type: ${opts.type}`);
    }
  }
}
