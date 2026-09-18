# Plan-007: 特性仓库 (FeatureRepository)

## 目标
实现 `D:\src\feature-repository.ts` 中的完整特性仓库系统，包括缓存、自动刷新、页面可见性处理。

## 现状分析
- KX2API 无特性标记基础设施
- 需要 Plans 005-006 的基础

## 实施步骤

### Step 1: FeatureRepository 主类
- 新建 `src/engine/featureFlag/repository.ts`
- 实现 `class FeatureRepository`：
  - `constructor(growthBook: GrowthBook)`
  - `getFeature(name, defaultValue): FeatureResult`
  - `subscribe(callback): () => void` — 订阅变更
  - `unsubscribe(callback): void`

### Step 2: 缓存系统
- 实现 `configureCache({ ttl, maxSize }): void`
- 实现 `clearCache(): void` — 清空特性缓存
- 内存缓存：Map<string, { value, expiresAt }>
- LRU 淘汰策略

### Step 3: 自动刷新
- 实现 `clearAutoRefresh(): void` — 清除定时器
- 实现 `startStreaming(interval: number): void` — 定时刷新 + SSE 流式
- 默认 30 秒轮询
- 页面不可见时暂停轮询

### Step 4: 页面可见性
- 实现 `onHidden(): void` — 页面隐藏时暂停
- 实现 `onVisible(): void` — 页面恢复时刷新
- 使用 `document.visibilityState` / `visibilitychange` 事件

### Step 5: setPolyfills
- 实现 `setPolyfills({ hash, random }): void` — 允许注入 polyfill 函数
- 用于 SSR 或测试环境

### Step 6: helpers 导出
- 导出 `helpers` 对象：便捷方法集合
- `helpers.isOn(name)`, `helpers.getValue(name, default)`, `helpers.track()`

## 验收标准
- `repo.getFeature('new-feature', false)` 返回正确值
- 缓存命中时不再调用 GrowthBook.evalFeature
- `clearCache()` 后下次调用重新求值
- 页面隐藏 5 秒后自动暂停轮询
- 页面恢复后立即刷新

## 风险/依赖
- 依赖 Plan-005/006 的 GrowthBook 类
- 页面可见性 API 在 Electron 主进程中需特殊处理
