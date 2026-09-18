# Plan-053: 恢复选择器 (launchResumeChooser)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchResumeChooser()` 函数。

## 现状分析
- 交互式会话恢复选择器
- 使用 renderAndRun 而非 showSetupDialog
- 需要并行加载 worktree paths、ResumeConversation 组件和 App

## 实施步骤

### Step 1: launchResumeChooser 实现
- 实现 `async function launchResumeChooser(root, appProps, worktreePathsPromise, resumeProps): Promise<void>`
- 使用 Promise.all 并行加载
- 使用 renderAndRun 渲染

### Step 2: 工作树路径
- 支持 worktreePaths 动态加载
- 传递给 ResumeConversation 组件

## 验收标准
- 恢复界面正常渲染
- worktree paths 正确传递

## 风险/依赖
- 中风险：依赖会话恢复系统
