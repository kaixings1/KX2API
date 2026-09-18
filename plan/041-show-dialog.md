# Plan-041: 对话框显示 (showDialog)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `showDialog()` 函数，提供 Ink 根节点上的 Promise 对话框能力。

## 现状分析
- KX2API 使用 Electron 的 BrowserWindow + IPC 通信
- D:\src 使用 Ink 的 root.render() 渲染临时 JSX 树
- 架构不同，但概念可迁移为 Electron 对话框

## 实施步骤

### Step 1: 类型定义
- 新建 `src/engine/dialogs/showDialog.ts`
- 定义 `DialogRenderer<T>` type

### Step 2: showDialog 实现
- 实现 `showDialog<T>(root, renderer): Promise<T>`
- 在 KX2API 中对应：通过 IPC 打开一个模态 BrowserWindow
- 通过 preload 暴露 Promise 化的 result 通道

### Step 3: 与 renderer 集成
- renderer 进程创建临时对话框组件
- main 进程管理窗口生命周期

## 验收标准
- showDialog 返回 Promise<T>
- 对话框关闭后 resolve
- 支持取消操作

## 风险/依赖
- 中风险：Electron 窗口管理与 Ink root.render 的差异
