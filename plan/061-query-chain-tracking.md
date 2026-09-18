# Plan-061: QueryChainTracking 类型

## 目标
实现 D:\src\Tool.ts 中 QueryChainTracking 类型。

## 现状分析
- QueryChainTracking 用于追踪工具调用链
- KX2API 有消息链但没有工具链追踪

## 实施步骤

### Step 1: QueryChainTracking 定义
- 定义 QueryChainTracking interface（chainId, parentChainId, depth, toolCalls）

### Step 2: 链追踪实现
- 在工具调用时创建追踪记录
- 支持嵌套工具调用

### Step 3: 可视化/调试
- 支持查询调用链
- 用于调试和分析

## 验收标准
- 工具调用链正确追踪
- 嵌套调用关系正确

## 风险/依赖
- 低风险：追踪逻辑
