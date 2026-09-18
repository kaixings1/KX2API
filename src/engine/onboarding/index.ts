/**
 * engine/onboarding/index.ts — 引导系统 barrel export
 */
export type { Step } from './types.ts'
export { getSteps, isProjectOnboardingComplete, maybeMarkProjectOnboardingComplete } from './projectOnboarding.ts'
