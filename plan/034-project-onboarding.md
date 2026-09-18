# Plan-034: 引导状态管理 (projectOnboardingState.ts)

## 目标
实现 `D:\src\projectOnboardingState.ts` 中的项目引导状态管理功能。

## 现状分析
- KX2API 有 `/init` 命令生成 CLAUDE.md
- 但缺少项目引导的状态管理
- 缺少首次使用引导流程

## 实施步骤

### Step 1: 引导步骤类型
- 新建 `src/engine/onboarding/types.ts`
- 定义 `OnboardingStep`：
  - `id: string`
  - `title: string`
  - `description: string`
  - `action: string` — 需要执行的动作
  - `completed: boolean`

### Step 2: 引导步骤获取
- 实现 `getSteps(projectPath): OnboardingStep[]`
- 步骤列表：
  1. 选择 AI provider
  2. 输入 API Key
  3. 运行 `/init` 生成项目说明
  4. 安装推荐插件
  5. 配置快捷键

### Step 3: 状态检查
- 实现 `isProjectOnboardingComplete(projectPath): boolean`
- 检查是否存在完成标记（electron-store 中）
- 检查所有步骤是否 completed

### Step 4: 标记完成
- 实现 `maybeMarkProjectOnboardingComplete(projectPath): void`
- 自动标记：当所有步骤完成时自动标记
- 手动标记：用户点击"跳过"

### Step 5: 展示控制
- 实现 `shouldShowProjectOnboarding(projectPath): boolean`
- 实现 `incrementProjectOnboardingSeenCount(projectPath): void`
- 控制引导弹窗的展示频率

## 验收标准
- 首次打开项目时显示引导
- 完成引导后不再显示
- `getSteps` 返回正确的步骤列表
- 展示计数正确递增

## 风险/依赖
- 低风险：状态管理
