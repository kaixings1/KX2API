# Plan-066: 成本追踪器细节 (cost-tracker.ts 补充)

## 目标
补全 D:\src\cost-tracker.ts 中遗漏的导出函数。

## 现状分析
- 之前已创建 Plan-025 到 Plan-028 覆盖主要功能
- 遗漏：addToTotalLinesChanged, getTotalLinesAdded, getTotalLinesRemoved, getApiCallCount, resetSession 等

## 实施步骤

### Step 1: 行数变更追踪
- 实现 `addToTotalLinesChanged(added, removed): void`
- 实现 `getTotalLinesAdded(): number`
- 实现 `getTotalLinesRemoved(): number`

### Step 2: API 调用计数
- 实现 `getApiCallCount(): number`
- 每次 API 调用时递增

### Step 3: 会话重置
- 实现 `resetSession(): void`
- 重置所有会话级计数器

## 验收标准
- 行数变更正确追踪
- API 计数正确
- 会话重置生效

## 风险/依赖
- 低风险：计数器逻辑
