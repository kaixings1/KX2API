# Plan-068: 成本汇总 (Cost Summary)

## 目标
实现 D:\src\cost-tracker.ts 中的成本汇总功能。

## 现状分析
- cost-tracker 支持会话级别的成本汇总
- KX2API 有基础的成本追踪但不完整

## 实施步骤

### Step 1: getSessionCost 实现
- 实现 `getSessionCost(): SessionCost`
- 汇总当前会话的所有成本

### Step 2: getModelBreakdown 实现
- 实现 `getModelBreakdown(): Record<string, Cost>`
- 按模型分组统计

### Step 3: 格式化输出
- 实现 `formatCostSummary(): string`
- 人类可读的成本报告

## 验收标准
- 成本汇总正确
- 按模型分组正确
- 格式化输出清晰

## 风险/依赖
- 低风险：汇总逻辑
