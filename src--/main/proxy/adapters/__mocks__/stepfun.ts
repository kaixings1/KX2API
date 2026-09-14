export class StepFunAdapter {
  static isStepFunProvider(provider: any): boolean { return false }
}
export { StepFunStreamHandler } from './stepfun-stream'
export const stepfunAdapter = { StepFunAdapter }
