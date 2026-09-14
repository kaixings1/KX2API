/**
 * Action Sampler
 * think → action → observation 循环
 * 参考 SWE-agent 的 StepOutput / Trajectory 设计
 */
import type { StepOutput, Trajectory } from './types';
export interface ActionSamplerConfig {
    maxSteps: number;
    maxExecutionTime: number;
}
export declare class ActionSampler {
    private readonly maxSteps;
    private readonly maxExecutionTime;
    private trajectory;
    constructor(config?: Partial<ActionSamplerConfig>);
    getTrajectory(): Trajectory;
    clear(): void;
    /**
     * 执行一步 think → action → observation
     */
    executeStep(input: {
        thought: string;
        action: string;
        executeAction: (action: string, args?: Record<string, unknown>) => Promise<string>;
    }): Promise<StepOutput>;
    /**
     * 执行完整的 think → action → observation 循环
     * 返回完整的轨迹
     */
    run(input: {
        steps: Array<{
            thought: string;
            action: string;
            executeAction: (action: string, args?: Record<string, unknown>) => Promise<string>;
        }>;
        shouldStop?: (trajectory: Trajectory, lastStep: StepOutput) => boolean;
    }): Promise<{
        trajectory: Trajectory;
        finalStep: StepOutput;
    }>;
}
