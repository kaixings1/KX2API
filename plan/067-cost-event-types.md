# Plan-067: 成本事件类型定义

## 目标
定义 D:\src\cost-tracker.ts 中使用的事件类型。

## 现状分析
- cost-tracker 使用多种事件类型（CostEvent, ModelUsageEvent 等）
- KX2API 缺少这些类型定义

## 实施步骤

### Step 1: CostEvent 类型
- 定义 CostEvent interface（model, inputTokens, outputTokens, cacheTokens, cost, timestamp）

### Step 2: ModelUsageEvent 类型
- 定义 ModelUsageEvent interface
- 包含模型特定的使用统计

### Step 3: SessionCost 类型
- 定义 SessionCost interface
- 汇总会话级别的成本数据

## 验收标准
- 所有成本事件类型完整定义
- 类型间关系正确

## 风险/依赖
- 低风险：纯类型定义
