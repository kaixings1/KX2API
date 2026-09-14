/**
 * Action Sampler
 * think → action → observation 循环
 * 参考 SWE-agent 的 StepOutput / Trajectory 设计
 */

import type { StepOutput, Trajectory, ToolCallRecord } from './types'

export interface ActionSamplerConfig {
  maxSteps: number
  maxExecutionTime: number
}

export class ActionSampler {
  private readonly maxSteps: number
  private readonly maxExecutionTime: number
  private trajectory: Trajectory = []

  constructor(config: Partial<ActionSamplerConfig> = {}) {
    this.maxSteps = config.maxSteps || 10
    this.maxExecutionTime = config.maxExecutionTime || 60000
  }

  getTrajectory(): Trajectory {
    return [...this.trajectory]
  }

  clear(): void {
    this.trajectory = []
  }

  /**
   * 执行一步 think → action → observation
   */
  async executeStep(input: {
    thought: string
    action: string
    executeAction: (action: string, args?: Record<string, unknown>) => Promise<string>
  }): Promise<StepOutput> {
    const startTime = Date.now()

    // Record thought
    this.trajectory.push({
      type: 'thought',
      content: input.thought,
      timestamp: startTime,
    })

    // Execute action
    const actionStartTime = Date.now()
    let observation: string
    try {
      observation = await Promise.race([
        input.executeAction(input.action),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Action timeout')), this.maxExecutionTime)
        ),
      ])
    } catch (e) {
      observation = `Error: ${(e as Error).message}`
    }

    const executionTime = Date.now() - actionStartTime

    // Record action + observation
    this.trajectory.push({
      type: 'action',
      content: input.action,
      timestamp: actionStartTime,
    })

    this.trajectory.push({
      type: 'observation',
      content: observation,
      timestamp: Date.now(),
    })

    const output: StepOutput = {
      thought: input.thought,
      action: input.action,
      output: observation,
      observation,
      done: false,
      executionTime,
    }

    return output
  }

  /**
   * 执行完整的 think → action → observation 循环
   * 返回完整的轨迹
   */
  async run(input: {
    steps: Array<{
      thought: string
      action: string
      executeAction: (action: string, args?: Record<string, unknown>) => Promise<string>
    }>
    shouldStop?: (trajectory: Trajectory, lastStep: StepOutput) => boolean
  }): Promise<{ trajectory: Trajectory; finalStep: StepOutput }> {
    let lastStep: StepOutput = {
      thought: '',
      action: '',
      output: '',
      observation: '',
      done: false,
      executionTime: 0,
    }

    for (let i = 0; i < Math.min(input.steps.length, this.maxSteps); i++) {
      const step = input.steps[i]
      lastStep = await this.executeStep({
        thought: step.thought,
        action: step.action,
        executeAction: step.executeAction,
      })

      if (input.shouldStop?.(this.trajectory, lastStep)) {
        lastStep.done = true
        break
      }
    }

    return {
      trajectory: this.getTrajectory(),
      finalStep: lastStep,
    }
  }
}
