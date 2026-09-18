/**
 * engine/onboarding/projectOnboarding.ts — 项目引导状态管理
 *
 * 吸收自 D:\src\projectOnboardingState.ts
 */

import type { Step } from './types.js'

export function getSteps(hasClaudeMd: boolean, isWorkspaceDirEmpty: boolean): Step[] {
  return [
    {
      key: 'workspace',
      text: '让 Claude 创建新应用或克隆仓库',
      isComplete: false,
      isCompletable: true,
      isEnabled: isWorkspaceDirEmpty,
    },
    {
      key: 'claudemd',
      text: '运行 /init 创建包含 Claude 指令的 CLAUDE.md 文件',
      isComplete: hasClaudeMd,
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
  ]
}

export function isProjectOnboardingComplete(
  getSteps: () => Step[],
  hasCompleted: boolean,
): boolean {
  if (hasCompleted) return true
  return getSteps()
    .filter(({ isCompletable, isEnabled }) => isCompletable && isEnabled)
    .every(({ isComplete }) => isComplete)
}

export function maybeMarkProjectOnboardingComplete(
  hasCompleted: boolean,
  checkComplete: () => boolean,
  save: (updater: (current: { hasCompletedProjectOnboarding?: boolean }) => { hasCompletedProjectOnboarding?: boolean }) => void,
): void {
  if (hasCompleted) return
  if (checkComplete()) {
    save(current => ({ ...current, hasCompletedProjectOnboarding: true }))
  }
}
