# Plan-027: 会话成本管理 (addToTotalSessionCost / session restore)

## 目标
实现 `D:\src\cost-tracker.ts` 中的 `addToTotalSessionCost()` 和会话成本持久化/恢复功能。

## 现状分析
- Plan-025/026 已完成核心追踪和模型用量
- 但缺少会话粒度的成本累加和恢复

## 实施步骤

### Step 1: addToTotalSessionCost
- 实现 `addToTotalSessionCost(model, usage): void`
- 将单次 API 调用的用量累加到当前会话
- 参数：`{ inputTokens, outputTokens, model, duration, cost }`

### Step 2: 会话成本存储
- 实现 `saveCurrentSessionCosts(): void`
- 将当前会话成本快照保存到 `electron-store`
- Key：`costs.session_${sessionId}`

### Step 3: 会话成本恢复
- 实现 `getStoredSessionCosts(sessionId): SessionCost | null`
- 实现 `restoreCostStateForSession(sessionId): void`
- 从 store 读取并恢复到全局状态

### Step 4: 多会话管理
- 实现 `clearSessionCost(sessionId): void` — 清理旧会话
- 实现 `getAllSessionCosts(): Record<string, SessionCost>` — 列出所有会话

### Step 5: 在引擎中集成
- 在 `QueryEngine.query()` 完成后调用 `addToTotalSessionCost`
- 在会话恢复时调用 `restoreCostStateForSession`

## 验收标准
- 每次 query() 后 `addToTotalSessionCost` 被调用
- 重启后 `restoreCostStateForSession` 恢复成本数据
- 多会话成本互不干扰
- `getAllSessionCosts()` 返回所有历史会话数据

## 风险/依赖
- 低风险：在 Plan-025 基础上扩展
- 依赖：electron-store
