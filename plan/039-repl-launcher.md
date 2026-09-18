# Plan-039: REPL 启动器 (replLauncher.tsx)

## 目标
实现 `D:\src\replLauncher.tsx` 中的 `launchRepl()` 函数，提供 KX2API 主 REPL 界面的启动能力。

## 现状分析
- KX2API 有 `engine/cli.ts` 作为 CLI 入口
- 但缺少专门的 REPL 启动逻辑，包括重试加载、渲染入口等
- D:\src 的 `launchRepl` 负责动态加载 App 和 REPL 组件并启动渲染循环

## 实施步骤

### Step 1: 类型定义
- 新建 `src/engine/repl/launcher.ts`
- 定义 `ReplLauncherProps` interface（getFpsMetrics, stats, initialState）
- 定义 `ReplProps` interface

### Step 2: launchRepl 实现
- 实现 `async function launchRepl(root, appProps, replProps, renderAndRun): Promise<void>`
- 动态导入 REPL 组件
- 带重试机制的模块加载（3 次尝试，500ms 间隔）
- 包裹 App 组件并调用 renderAndRun

### Step 3: 与 Electron 集成
- 在 main 进程创建 BrowserWindow 后调用 launchRepl
- 传递 preload 的 FPS 指标和 stats store

### Step 4: 错误处理
- REPL 加载失败的降级策略
- 渲染失败的恢复机制

## 验收标准
- REPL 界面正常启动
- 模块加载重试机制生效
- 与现有 engine/cli.ts 行为一致

## 风险/依赖
- 低风险：纯入口逻辑
