# Plan-006: GrowthBook 远程客户端 (GrowthBookClient)

## 目标
实现 `D:\src\GrowthBookClient.ts` 中的 `GrowthBookClient` 类，从远程 API 拉取特性标记配置。

## 现状分析
- Plan-005 完成后，这是自然的扩展
- 需要 HTTP 客户端 + SSE 支持

## 实施步骤

### Step 1: 客户端核心
- 新建 `src/engine/featureFlag/client.ts`
- 实现 `class GrowthBookClient`：
  - `constructor(options: { apiHost, clientKey, features, attributes })`
  - `async fetchFeatures(): Promise<Feature[]>`
  - `async startStreaming(callback): void` — SSE 流式更新
  - `destroy(): void` — 断开连接

### Step 2: HTTP 请求
- 使用 `fetch` 或 `axios`（KX2API 已有 axios）
- 请求 `/api/features/:clientKey` 端点
- 处理认证（clientKey header）

### Step 3: SSE 流式更新
- 使用 `eventsource-parser`（KX2API 已有依赖）
- 实现 `startStreaming(callback)` — 实时接收特性变更
- 连接断开自动重连（指数退避）

### Step 4: 用户范围特性
- 实现 `class UserScopedGrowthBook extends GrowthBookClient`
- 按 `userId` + `email` + `sessionId` 隔离特性上下文
- 每个用户独立的 attributes 对象

### Step 5: 集成到 FeatureRepository
- 与 Plan-007 的 feature-repository 集成
- 提供 `refreshFeatures()` 和 `subscribe()` 能力

## 验收标准
- `client.fetchFeatures()` 成功拉取远程配置
- SSE 连接建立后，服务端更新特性时客户端自动回调
- 断网后自动重连，最多 5 次
- `UserScopedGrowthBook` 同一 user 的 attributes 一致

## 风险/依赖
- 依赖远程 API 可用性
- SSE 解析器：eventsource-parser（已有）
- 注意：D:\src 的 GrowthBookClient.ts 有 376 行
