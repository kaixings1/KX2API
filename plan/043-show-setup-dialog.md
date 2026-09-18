# Plan-043: 设置对话框 (showSetupDialog)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `showSetupDialog()` 函数。

## 现状分析
- D:\src 在 showDialog 基础上包裹 AppStateProvider + KeybindingSetup
- KX2API 已有状态管理系统和快捷键系统
- 需要将两者结合

## 实施步骤

### Step 1: 类型定义
- 定义 ShowSetupDialogOptions（onChangeAppState）

### Step 2: showSetupDialog 实现
- 实现 `showDialog<T>(root, renderer, options?): Promise<T>`
- 在 showDialog 基础上包裹必要的上下文提供者
- 传入 KeybindingSetup 包裹层

### Step 3: KX2API 上下文映射
- AppStateProvider → existing state store
- KeybindingSetup → existing keybinding system

## 验收标准
- showSetupDialog 渲染带上下文的对话框
- 返回 Promise<T>
- 支持 onChangeAppState 回调

## 风险/依赖
- 低风险：组合已有组件
