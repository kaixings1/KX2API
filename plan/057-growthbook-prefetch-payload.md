# Plan-057: GrowthBook 预取 (prefetchPayload)

## 目标
实现 D:\src\GrowthBook.ts 中的 `prefetchPayload()` 函数。

## 现状分析
- prefetchPayload 预取 GrowthBook 特性标记 payload
- 用于在应用启动前预加载特性配置
- KX2API 无此功能

## 实施步骤

### Step 1: prefetchPayload 实现
- 新建 `src/engine/feature/prefetch.ts`
- 实现 `async function prefetchPayload(options): Promise<FeatureApiResponse>`
- 从远程 API 获取 payload
- 本地缓存

### Step 2: 缓存策略
- 实现本地 payload 缓存
- 支持过期时间
- 后台刷新

### Step 3: 集成
- 在应用启动时预取
- 在主进程或 preload 中初始化

## 验收标准
- payload 正确预取和缓存
- 应用启动时特性状态可用

## 风险/依赖
- 中风险：需要网络请求和缓存
