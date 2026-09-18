# Plan-011: 特性标记辅助函数 (util.ts)

## 目标
实现 `D:\src\util.ts` 中的特性标记相关辅助函数。

## 现状分析
- `util.ts` 包含约 20 个辅助函数
- 部分与 feature flag 相关，部分与 URL/命名空间相关

## 实施步骤

### Step 1: URL 相关
- 实现 `getUrlRegExp(url: string): RegExp` — 将 glob 模式转为正则
- 实现 `isURLTargeted(url: string, patterns: string[]): boolean` — 检查 URL 是否匹配目标

### Step 2: 命名空间相关
- 实现 `inNamespace(namespace: string, key: string): boolean`
- 实现 `getEqualWeights(n: number): number[]` — 生成等权重数组

### Step 3: 分桶相关
- 实现 `getBucketRanges(n: number, start = 0, end = 1): [number, number][]` — 生成分桶范围
- 实现 `chooseVariation(n: number, coverage: number, hash: string): number` — 根据哈希选择 variation
- 实现 `isIncluded(coverage, hashAttribute, fallbackAttribute?): boolean` — 判断用户是否在实验组

### Step 4: 查询字符串
- 实现 `getQueryStringOverride(url: string): { name: string; value: string } | null` — 从 URL 查询参数读取 override
- 实现 `mergeQueryStrings(a, b): string` — 合并两个查询字符串

### Step 5: 自动实验变更类型
- 实现 `getAutoExperimentChangeType(oldValue, newValue): 'add' | 'remove' | 'update'`
- 比较两个值确定变更类型

## 验收标准
- `getUrlRegExp('https://*.example.com/*')` → 正确的正则表达式
- `isURLTargeted('https://app.example.com/path', ['*.example.com/*'])` → true
- `getBucketRanges(3)` → `[[0, 0.333], [0.333, 0.667], [0.667, 1]]`
- `chooseVariation(3, 0.5, 'abc123')` → 0 或 1 或 2（确定性）
- `getQueryStringOverride('?feature=new-ui=true')` → `{ name: 'feature', value: 'new-ui=true' }`

## 风险/依赖
- 低风险：纯函数实现
- URL glob 转正则需处理通配符
