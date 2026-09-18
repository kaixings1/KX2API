# Plan-044: 渲染并运行 (renderAndRun)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `renderAndRun()` 函数。

## 现状分析
- D:\src 的 renderAndRun 是 REPL 渲染的主入口
- 负责 root.render() → startDeferredPrefetches → waitUntilExit → gracefulShutdown
- KX2API 的 Electron 应用有类似的启动流程

## 实施步骤

### Step 1: renderAndRun 实现
- 新建 `src/engine/repl/renderAndRun.ts`
- 实现 `async function renderAndRun(root, element): Promise<void>`
- 调用 root.render(element)
- 启动延迟预取
- 等待退出信号
- 执行优雅关闭

### Step 2: 延迟预取
- 实现 `startDeferredPrefetches()` 在渲染后启动
- 非阻塞的初始化任务

### Step 3: 优雅关闭
- 实现 `gracefulShutdown(exitCode)` 清理逻辑

## 验收标准
- REPL 正常渲染
- 退出后正确清理
- 延迟预取在渲染后执行

## 风险/依赖
- 低风险：生命周期管理
