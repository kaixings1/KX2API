# Plan-026: 模型用量追踪 (getModelUsage / getUsageForModel)

## 目标
实现 `D:\src\cost-tracker.ts` 中的 `getModelUsage()` 和 `getUsageForModel()`，按模型维度追踪用量。

## 现状分析
- Plan-025 的 tracker 只有全局聚合统计
- 缺少按模型拆分的用量维度
- 无法回答"这个模型花了多少"的问题

## 实施步骤

### Step 1: 模型用量类型
- 定义 `ModelUsage`：
  - `model: string`
  - `inputTokens: number`
  - `outputTokens: number`
  - `cacheReadInputTokens: number`
  - `cacheCreationInputTokens: number`
  - `apiCalls: number`
  - `totalCost: number`
  - `totalDuration: number`

### Step 2: getModelUsage
- 实现 `getModelUsage(): ModelUsage[]`
- 遍历所有已使用模型，返回聚合数据
- 按模型名称分组

### Step 3: getUsageForModel
- 实现 `getUsageForModel(model: string): ModelUsage | undefined`
- 返回指定模型的用量数据
- 如果模型不存在，返回 undefined

### Step 4: 模型价格表
- 新建 `src/engine/cost/pricing.ts`
- 定义 `MODEL_PRICING: Record<string, { inputPer1K, outputPer1K, cacheReadPer1K, cacheCreationPer1K }>`
- 包含主流模型的价格（GPT-4o, Claude, StepFun 等）
- 实现 `calculateCost(model, usage): number`

### Step 5: 会话成本持久化
- 实现 `saveCurrentSessionCosts(): void`
- 实现 `getStoredSessionCosts(): ModelUsage[]`
- 实现 `restoreCostStateForSession(): void`
- 持久化到 `electron-store`

## 验收标准
- `getModelUsage()` 返回包含所有已用模型的数据
- `getUsageForModel('gpt-4o')` 返回正确数据
- 模型价格变化时只需更新 pricing.ts
- 会话结束/重启后成本数据不丢失

## 风险/依赖
- 中风险：模型价格表需要维护
- 注意：不同 provider 的定价单位可能不同
