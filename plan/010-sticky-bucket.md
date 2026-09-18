# Plan-010: 粘性分桶服务 (StickyBucketService)

## 目标
实现 `D:\src\sticky-bucket-service.ts` 中的完整粘性分桶服务，包括本地存储、Cookie、Redis 后端。

## 现状分析
- KX2API 无粘性分桶概念
- 依赖于 Plan-009 的哈希属性系统
- 需要多种存储后端

## 实施步骤

### Step 1: 接口定义
- 新建 `src/engine/featureFlag/stickyBucket.ts`
- 定义：
  - `CookieAttributes` (domain, path, expires, secure, httpOnly, sameSite)
  - `JsCookiesCompat` (set, get, remove 接口)
  - `IORedisCompat` (get, set, del 接口)
  - `RequestCompat` / `ResponseCompat`

### Step 2: 抽象基类
- 实现 `abstract class StickyBucketService`：
  - `abstract getAssignment(namespace, attributeValue): string | null`
  - `abstract setAssignment(namespace, attributeValue, variation): void`
  - `abstract clearAssignment(namespace): void`
  - `protected abstract getRaw(key): Promise<string | null>`
  - `protected abstract setRaw(key, value, ttl): Promise<void>`

### Step 3: 存储后端实现
1. **LocalStorageStickyBucketService** — 内存 Map（开发/测试用）
2. **BrowserCookieStickyBucketService** — HTTP Cookie（渲染进程）
3. **ExpressCookieStickyBucketService** — 服务端 Cookie（SSR/Proxy）
4. **RedisStickyBucketService** — Redis 存储（生产部署）

### Step 4: 同步版本
- 实现 `abstract class StickyBucketServiceSync`
- 同步版本的 `get/set/clear` 方法
- 供 Node.js 主进程使用

### Step 5: 集成到 GrowthBook
- 在 `GrowthBook` 构造函数中注入 `stickyBucketService`
- `evalFeature` 时调用 `getAssignment` 获取用户分桶
- 同一 namespace + 属性 → 始终同一 variation

## 验收标准
- 同一用户在不同请求中始终得到相同 variation
- 切换 namespace 不影响其他 namespace 的分桶
- Redis 后端支持 TTL 过期
- Cookie 后端正确设置 domain/path

## 风险/依赖
- 依赖 Plan-009 的哈希系统
- Redis 后端需 redis 依赖（可选）
