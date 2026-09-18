# Plan-048: 无效设置对话框 (launchInvalidSettingsDialog)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchInvalidSettingsDialog()` 函数。

## 现状分析
- 显示设置验证错误对话框
- KX2API 有 `getSettingsWithAllErrors` 验证系统
- 缺少错误对话框的显示逻辑

## 实施步骤

### Step 1: launchInvalidSettingsDialog 实现
- 实现 `async function launchInvalidSettingsDialog(root, props): Promise<void>`
- props: { settingsErrors: ValidationError[], onExit: () => void }
- 动态导入 InvalidSettingsDialog

### Step 2: 错误展示
- 展示 settingsErrors 列表
- 提供"继续"和"退出"按钮
- 支持自动修复

## 验收标准
- 验证错误正确展示
- 用户操作正确回调

## 风险/依赖
- 低风险：纯 UI 逻辑
