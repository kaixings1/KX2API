# Plan-069: useCostSummary Hook (costHook.ts)

## 目标
实现 D:\src\costHook.ts 中的 useCostSummary() React Hook。

## 现状分析
- useCostSummary 是 React Hook，用于在 UI 中展示成本摘要
- KX2API 使用 React + Electron，已有 React 渲染能力
- 但缺少与成本追踪器的集成

## 实施步骤

### Step 1: useCostSummary Hook 实现
- 新建 `src/renderer/hooks/useCostSummary.ts`
- 实现 `function useCostSummary(): CostSummaryData`
- 从 Zustand store 读取成本数据
- 实时更新

### Step 2: CostSummaryData 类型
- 定义 CostSummaryData interface
- 包含总成本、API 调用次数、Token 使用量

### Step 3: UI 组件
- 创建 CostSummary 显示组件
- 在状态栏或侧边栏展示

## 验收标准
- Hook 正确返回成本数据
- UI 实时更新

## 风险/依赖
- 低风险：React Hook
