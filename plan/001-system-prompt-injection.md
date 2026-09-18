# Plan-001: 系统提示注入 (getSystemPromptInjection / setSystemPromptInjection)

## 目标
实现 `D:\src\context.ts` 中的 `getSystemPromptInjection()` / `setSystemPromptInjection()` 功能，支持缓存破坏（cache breaker）和临时调试状态注入。

## 现状分析
- KX2API 的 `engine/context.ts` 不存在统一上下文层
- 系统提示词在 `engine/core.ts` 和 `engine/index.ts` 中以静态方式构造
- 无机制支持临时覆盖/注入调试信息

## 实施步骤

### Step 1: 创建上下文注入模块
- 新建 `src/engine/context/promptInjection.ts`
- 实现 `getSystemPromptInjection(): string | null`
- 实现 `setSystemPromptInjection(value: string | null): void`
- 注入变更时清空 `getSystemContext` / `getUserContext` 缓存

### Step 2: 集成到系统提示词构建
- 修改 `engine/index.ts` 的 `buildEnhancedSystemPrompt`，在适当位置插入注入内容
- 仅当注入非空时添加 `[CACHE_BREAKER: ...]` 标记

### Step 3: 通过 IPC 暴露
- 在 `src/main/ipc/channels.ts` 添加 `CONTEXT_SET_INJECTION` channel
- 在 `preload/index.ts` 暴露 `setPromptInjection()`
- 在 UI 层可临时触发

## 验收标准
- `setSystemPromptInjection("debug")` 后，下次 `buildSystemPrompt()` 输出含 `[CACHE_BREAKER: debug]`
- 再次设为 null 后，注入消失
- 不影响正常系统提示词结构

## 风险/依赖
- 低风险：纯内存状态，不影响持久化
- 注意：仅在 debug/ant 场景使用，生产环境需 Feature Flag 控制
