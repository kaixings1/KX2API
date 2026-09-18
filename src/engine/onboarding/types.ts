/**
 * engine/onboarding/types.ts — 项目引导类型定义
 *
 * 吸收自 D:\src\projectOnboardingState.ts
 */

export type Step = {
  key: string
  text: string
  isComplete: boolean
  isCompletable: boolean
  isEnabled: boolean
}

export interface OnboardingConfig {
  hasCompletedProjectOnboarding: boolean
  projectOnboardingSeenCount: number
}
