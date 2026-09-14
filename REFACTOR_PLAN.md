# 大型重构计划：以 CLI 版为核心升级 Web 版

## 目标
以 `D:\KX2API\out\src\`（CLI 终端版）为核心，对 `D:\KX2API\src2026\`（Web/Electron 版）进行全面升级。

## 差距分析

| 组件 | CLI 版 (out/src/engine/) | Web 版 (src2026/engine/) | 状态 |
|------|--------------------------|--------------------------|------|
| messageLoop.ts | 完整实现 (39KB) | 简单实现 (16KB) | ⚠️ 需升级 |
| stateMachine.ts | 完整 | 完整 | ✅ 已存在 |
| requestBuilder.ts | 完整 | 完整 | ✅ 已存在 |
| responseHandler.ts | 完整 | 完整 | ✅ 已存在 |
| toolScheduler.ts | 完整 | 完整 | ✅ 已存在 |
| tokenBudgetManager.ts | 完整 | 完整 | ✅ 已存在 |
| autoCompactor.ts | 完整 | 完整 | ✅ 已存在 |
| autoFixLoop.ts | 完整 | 完整 | ✅ 已存在 |
| gitContext.ts | 完整 | 完整 | ✅ 已存在 |
| messageNormalizer.ts | 完整 | 完整 | ✅ 已存在 |
| index.ts | 完整 QueryEngine + MessageLoop 装配 | 简单导出 | ⚠️ 需升级 |
| core.ts | 无（被 index.ts 替代） | 简化 QueryEngine | ⚠️ 需替换 |

## 执行步骤

### Step 1: 升级 src2026/engine/messageLoop.ts
- 从 CLI 版复制完整实现
- 添加 Human-in-the-loop、ErrorRecovery、HookManager、AutoFixLoop 增强
- 添加 AutoContinue 配置支持

### Step 2: 升级 src2026/engine/index.ts
- 从 CLI 版复制完整 QueryEngine 类
- 集成 MessageLoop、ToolRegistry、ErrorRecovery、HookManager
- 添加 PermissionManager、SandboxExecutor、SelfHealingExecutor

### Step 3: 升级 src2026/engine/core.ts
- 保留作为向后兼容的薄封装
- 委托给新的 QueryEngine

### Step 4: 升级 src2026/main/engine-bridge.ts
- 使用新的完整 QueryEngine
- 添加 ToolRegistry 同步
- 添加 Dev 模式工具验证

### Step 5: 升级 src2026/main/ipc/chat-handlers.ts
- 使用 MessageLoop 事件驱动架构
- 添加 AgentEvent 流式转发
- 支持 Human-in-the-loop 暂停/恢复

### Step 6: 集成消息工具
- 复制 CLI 版 utils/messages.ts 的核心函数
- 添加到 src2026 的共享模块

## 风险评估
- Bun 特有 API（bun:bundle）需要替换为 Node.js 等效
- CLI 版的工具系统（Tool.ts）与 Web 版的工具系统（toolCollection.ts）架构不同
- 需要保持向后兼容，不破坏现有功能
