# Plan-028: 未知模型费用 (hasUnknownModelCost / setHasUnknownModelCost)

## 目标
实现 `D:\src\cost-tracker.ts` 中的 `hasUnknownModelCost()` 和 `setHasUnknownModelCost()`，处理定价表中不存在的模型。

## 现状分析
- Plan-026 的 MODEL_PRICING 不包含所有模型
- 某些自定义/自托管模型没有价格数据
- 需要标记和提示机制

## 实施步骤

### Step 1: 标记机制
- 在 tracker 状态中增加 `_hasUnknownModelCost: boolean`
- 实现 `setHasUnknownModelCost(value: boolean): void`
- 实现 `hasUnknownModelCost(): boolean`

### Step 2: 价格缺失检测
- 在 `calculateCost()` 中检查模型是否在定价表中
- 如果不在，自动调用 `setHasUnknownModelCost(true)`
- 费用计算时返回 NaN 或 0

### Step 3: UI 提示
- 当 `hasUnknownModelCost` 为 true 时，在成本面板显示提示
- 格式：`⚠ 部分模型无定价信息，费用可能不完整`

### Step 4: 价格覆盖
- 实现 `setModelPricing(model, pricing): void`
- 允许运行时动态添加模型价格
- 如果新增后所有模型都有价格，自动清除 unknown 标记

### Step 5: 日志记录
- 记录所有未知模型的名称和调用量
- 便于后续补充定价表

## 验收标准
- 使用未在定价表中的模型时 `hasUnknownModelCost()` → true
- 添加定价后 `hasUnknownModelCost()` → false
- UI 正确显示提示信息
- 日志记录未知模型信息

## 风险/依赖
- 低风险：标记机制
