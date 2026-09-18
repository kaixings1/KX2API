/**
 * engine/onboarding/index.ts — 引导系统 barrel export
 */
export type { Step } from './types.js'
export { getSteps, isProjectOnboardingComplete, maybeMarkProjectOnboardingComplete } from './projectOnboarding.js'
