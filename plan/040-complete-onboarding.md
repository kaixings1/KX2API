# Plan-040: 完成引导 (completeOnboarding)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `completeOnboarding()` 函数，标记项目引导为已完成。

## 现状分析
- KX2API 有 `/init` 命令和基本的引导逻辑
- 但缺少全局的引导完成状态管理（electron-store 中）
- D:\src 使用 saveGlobalConfig 持久化 `hasCompletedOnboarding` 和 `lastOnboardingVersion`

## 实施步骤

### Step 1: 状态定义
- 新建 `src/engine/onboarding/types.ts`
- 定义 `OnboardingConfig` interface（hasCompletedOnboarding, lastOnboardingVersion, seenCount）

### Step 2: completeOnboarding 实现
- 实现 `completeOnboarding(): void`
- 设置 hasCompletedOnboarding = true
- 记录 lastOnboardingVersion = APP_VERSION

### Step 3: electron-store 集成
- 在 store 中持久化 onboarding 配置
- 支持跨会话读取

## 验收标准
- 调用 completeOnboarding 后状态持久化
- 下次启动时读取到 completed 状态

## 风险/依赖
- 低风险：状态读写
