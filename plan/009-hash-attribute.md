# Plan-009: 哈希属性系统 (getHashAttribute / getStickyBucketAttributeKey)

## 目标
实现 `D:\src\core.ts` 中的哈希属性相关函数，为特性标记和实验提供一致的哈希分桶能力。

## 现状分析
- KX2API 无哈希分桶系统
- 多个模块（feature flag、experiment、sticky bucket）需要此能力
- 需统一算法确保跨模块一致性

## 实施步骤

### Step 1: 哈希基础函数
- 新建 `src/engine/featureFlag/hash.ts`
- 实现 `hash(str: string): string` — 基于 MurmurHash3V3 的哈希
- 输出：16 进制字符串，与 D:\src 实现一致
- 纯函数，无副作用

### Step 2: getHashAttribute
- 实现 `getHashAttribute(attr: string): number`
- 对属性名哈希后取整
- 返回 0 ~ 2^32-1 的整数
- 同一属性名始终返回相同值

### Step 3: getStickyBucketAttributeKey
- 实现 `getStickyBucketAttributeKey(namespace: string): string`
- 生成分桶专用的属性键名
- 格式：`sticky_bucket_${namespace}`

### Step 4: 辅助函数
- 实现 `inRange(value, min, max): boolean`
- 实现 `inNamespace(namespace, key): boolean` — 检查 key 是否属于 namespace

### Step 5: 导出到工具层
- 在 `src/engine/featureFlag/index.ts` 统一导出
- 供 GrowthBook、Experiment、StickyBucketService 共享

## 验收标准
- `hash("user_123")` → 固定值，多次调用一致
- `getHashAttribute("id")` → 0~2^32 整数
- `getStickyBucketAttributeKey("onboarding")` → `sticky_bucket_onboarding`
- 不同 namespace 的 bucket 独立

## 风险/依赖
- 低风险：纯函数实现
- 需确保哈希算法与 D:\src 完全一致（MurmurHash3V3_finalize）
