# Plan-029: 成本追踪 React Hook (useCostSummary)

## 目标
实现 `D:\src\costHook.ts` 中的 `useCostSummary()` React Hook，为 UI 提供成本追踪能力。

## 现状分析
- KX2API 已有 React + Zustand 状态管理
- 但缺少专用的成本追踪 Hook
- 成本数据需要实时反映到 UI

## 实施步骤

### Step 1: useCostSummary Hook
- 新建 `src/renderer/src/hooks/useCostSummary.ts`
- 实现 `useCostSummary()`：
  - 返回：`{ totalCost, totalTokens, modelUsage, isLoading, error }`
  - 内部通过 `window.electronAPI.cost.getSummary()` 获取数据
  - 使用 `useState` + `useEffect` 管理状态

### Step 2: 实时更新
- 使用 WebSocket 或轮询获取实时成本数据
- 每次新 API 调用后自动刷新
- 防抖：1 秒内的多次更新合并为一次渲染

### Step 3: 格式化显示
- 实现 `formatCost(cost): string`
- 实现 `formatTokens(tokens): string`
- 大数字缩写：`1.2K`, `3.4M`

### Step 4: 与主进程同步
- 在 preload 中暴露 `costAPI`：
  - `getSummary()`
  - `getModelUsage()`
  - `getSessionCosts()`
  - `reset()`
- 在 IPC handlers 中注册对应 handler

### Step 5: 成本面板组件
- 可选：创建 `CostSummary` 组件
- 显示总费用、Token 消耗、模型分布

## 验收标准
- Hook 正确返回当前会话成本数据
- 每次 query 后数据自动更新
- 大数字正确缩写显示
- 重置成本后 UI 归零

## 风险/依赖
- 低风险：标准 React Hook 模式
- 依赖：Plan-025/026 的主进程 API
