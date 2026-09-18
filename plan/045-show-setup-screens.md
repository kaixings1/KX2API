# Plan-045: 设置界面 (showSetupScreens)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `showSetupScreens()` 函数。

## 现状分析
- D:\src 的 showSetupScreens 处理首次启动的信任对话框和设置流程
- KX2API 有 /init 命令但没有完整的首次启动流程
- 需要信任确认、API Key 设置、权限配置等

## 实施步骤

### Step 1: showSetupScreens 实现
- 新建 `src/engine/onboarding/setupScreens.ts`
- 实现 `async function showSetupScreens(root, permissionMode, allowDangerouslySkipPermissions, commands?, claudeInChrome?, devChannels?): Promise<boolean>`
- 显示信任对话框
- 显示 API Key 配置界面
- 显示权限模式选择

### Step 2: 信任对话框
- 集成 `checkHasTrustDialogAccepted` / `setSessionTrustAccepted`
- 首次启动时强制显示

### Step 3: 权限配置
- 显示权限模式选择（normal / plan / bypass）
- 保存到全局配置

## 验收标准
- 首次启动显示设置流程
- 信任对话框正确显示/跳过
- 返回是否完成设置

## 风险/依赖
- 中风险：需要多个 UI 状态管理
