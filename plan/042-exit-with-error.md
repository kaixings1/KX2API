# Plan-042: 错误退出 (exitWithError)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `exitWithError()` 和 `exitWithMessage()` 函数。

## 现状分析
- D:\src 通过 Ink 的 root.render 渲染错误消息到终端
- KX2API 需要通过 BrowserWindow 渲染错误，然后关闭应用
- 两者都需要在渲染后执行清理逻辑

## 实施步骤

### Step 1: exitWithError 实现
- 新建 `src/engine/repl/exitHandlers.ts`
- 实现 `async function exitWithError(root, message, beforeExit?): Promise<never>`
- 内部调用 exitWithMessage with color='error'

### Step 2: exitWithMessage 实现
- 实现 `async function exitWithMessage(root, message, options?): Promise<never>`
- 渲染错误/消息到终端/窗口
- 执行 beforeExit 回调
- process.exit(exitCode)

### Step 3: KX2API 适配
- KX2API 使用 app.quit() 替代 process.exit
- 在 main 进程处理退出逻辑

## 验收标准
- 错误消息正确渲染
- 退出码正确传递
- beforeExit 回调执行

## 风险/依赖
- 低风险：退出逻辑
