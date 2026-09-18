# Plan-005: GrowthBook 特性标记核心 (GrowthBook)

## 目标
实现 `D:\src\GrowthBook.ts` 中的 `GrowthBook` 类，提供完整的特性标记（feature flag）SDK。

## 现状分析
- KX2API 完全没有特性标记系统
- 无 GrowthBook 集成，无 feature flag 基础设施
- 需要完整移植核心 SDK

## 实施步骤

### Step 1: 核心类型定义
- 新建 `src/engine/featureFlag/types.ts`
- 定义：
  - `Feature` interface (name, defaultValue, rules, enforce)
  - `FeatureResult` (value, source)
  - `Rule` (variations, coverage, hashAttribute, force)
  - `GrowthBookOptions` (apiHost, clientKey, attributes, etc.)

### Step 2: 哈希与分桶
- 实现 MurmurHash3 / MD5 哈希（`hash()` 函数）
- 实现 `getHashAttribute(attr: string): string` — 对属性名哈希取整
- 实现 `chooseVariation(n: number, coverage: number, hash: string): number`
- 实现 `isIncluded(coverage, hashAttribute, fallbackAttribute): boolean`

### Step 3: 特性求值引擎
- 新建 `src/engine/featureFlag/growthBook.ts`
- 实现 `class GrowthBook`：
  - `constructor(options)`
  - `evalFeature(name, defaultValue): FeatureResult`
  - `getFeatures(): Map<string, FeatureResult>`
  - `isOn(name): boolean`
  - `isOff(name): boolean`
  - `getFeatureValue(name, defaultValue): unknown`
- 特性规则求值：遍历 rules，找到第一个匹配的 rule 返回其 variation

### Step 4: 加密载荷
- 实现 `decryptPayload(payload, key): string`（AES-256-CBC）
- 实现 `getApiHosts()` — 返回 GrowthBook API 主机列表

### Step 5: 事件追踪
- 实现 `track(experiment, result)` — 实验曝光事件
- 事件常量：`EVENT_FEATURE_EVALUATED`、`EVENT_EXPERIMENT_VIEWED`

## 验收标准
- `new GrowthBook({ features: { 'new-ui': { defaultValue: false } } })`
- `gb.isOn('new-ui')` → false
- 添加 rule 后 `gb.isOn('new-ui')` → true（条件匹配）
- 哈希分桶一致性：同一用户属性始终得到相同 variation

## 风险/依赖
- 中风险：需移植完整算法，包括哈希一致性
- 依赖：crypto 模块（Node.js 内置）
- 注意：D:\src 的 GrowthBook.ts 有 1143 行，核心 evalFeature 在 L172
