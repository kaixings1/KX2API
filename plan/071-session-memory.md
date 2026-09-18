# Plan-071: 会话记忆系统 (Session Memory)

## 目标
实现 D:\src\setup.ts 中使用的会话记忆系统。

## 现状分析
- setup.ts 调用 initSessionMemory() 初始化会话记忆
- D:\src 有 services/SessionMemory/sessionMemory.ts
- KX2API 缺少会话记忆功能

## 实施步骤

### Step 1: 会话记忆类型
- 新建 `src/engine/memory/sessionMemory.ts`
- 定义 SessionMemory 类型
- 定义 MemoryEntry 类型

### Step 2: initSessionMemory 实现
- 实现 `initSessionMemory(): void`
- 注册会话开始/结束钩子
- 初始化记忆存储

### Step 3: 记忆读写
- 实现记忆文件的读写
- 支持跨会话持久化
- 清理过期记忆

## 验收标准
- initSessionMemory 正确初始化
- 记忆正确读写
- 跨会话数据保持

## 风险/依赖
- 中风险：文件系统 I/O + 钩子系统
