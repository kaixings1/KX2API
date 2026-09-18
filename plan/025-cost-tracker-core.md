# Plan-025: 成本追踪核心 (cost-tracker.ts)

## 目标
实现 `D:\src\cost-tracker.ts` 中的完整成本追踪系统，包括 API 调用计数、Token 消耗、费用计算。

## 现状分析
- KX2API 有 TokenBudgetManager 管理 token 预算
- 有 `getTotalCost()` 等基础方法
- 但缺少 D:\src 中的完整成本追踪系统

## 实施步骤

### Step 1: 成本状态管理
- 新建 `src/engine/cost/tracker.ts`
- 定义内部状态：
  - `totalCostUSD`: 累计费用（美元）
  - `totalInputTokens`: 累计输入 token
  - `totalOutputTokens`: 累计输出 token
  - `totalCacheReadInputTokens`: 缓存读取 token
  - `totalCacheCreationInputTokens`: 缓存创建 token
  - `totalAPIDuration`: API 总耗时
  - `totalAPIDurationWithoutRetries`: 不含重试的耗时
  - `totalLinesAdded/Removed`: 代码行变更
  - `totalWebSearchRequests`: 搜索请求次数

### Step 2: 基础 API
- 实现 `getTotalCostUSD(): number`
- 实现 `getTotalCost(): number` — 别名
- 实现 `getTotalDuration(): number`
- 实现 `getTotalAPIDuration(): number`
- 实现 `getTotalAPIDurationWithoutRetries(): number`
- 实现 `addToTotalLinesChanged(added, removed): void`
- 实现 `getTotalLinesAdded/Removed(): number`

### Step 3: Token 统计
- 实现 `getTotalInputTokens(): number`
- 实现 `getTotalOutputTokens(): number`
- 实现 `getTotalCacheReadInputTokens(): number`
- 实现 `getTotalCacheCreationInputTokens(): number`

### Step 4: 费用格式化
- 实现 `formatCost(cost: number): string` — 格式化为 $X.XX
- 实现 `formatTotalCost(): string` — 格式化总费用（含模型明细）

### Step 5: 重置与状态管理
- 实现 `resetCostState(): void` — 重置所有计数器
- 实现 `resetStateForTests(): void` — 测试专用重置
- 实现 `setHasUnknownModelCost(val): void`
- 实现 `hasUnknownModelCost(): boolean`

## 验收标准
- 每次 API 调用后成本正确累加
- `formatCost(0.001)` → `$0.001`
- `resetCostState()` 后所有计数器归零
- Token 计数与实际 API 响应一致

## 风险/依赖
- 中风险：需要模型价格表（model pricing）
- 依赖：各 provider 的 token usage 解析
