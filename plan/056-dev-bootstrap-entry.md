# Plan-056: 开发入口逻辑 (dev-entry / bootstrap-entry)

## 目标
分析 D:\src 中 dev-entry 和 bootstrap-entry 的入口逻辑。

## 现状分析
- D:\src\main.tsx 有大量入口逻辑：
  - 命令行解析（@commander-js/extra-typings）
  - 特性门控（feature()）
  - Worktree 创建和管理
  - UDS 消息服务器启动
  - 会话记忆初始化
  - 钩子系统热重载
  - 遥测和日志初始化
- KX2API 的入口在 src/main/index.ts

## 实施步骤

### Step 1: 入口分析
- 分析 main.tsx 的 setup() 函数职责
- 识别可复用的子系统

### Step 2: KX2API 入口增强
- 在 src/main/index.ts 中逐步引入：
  - Worktree 管理（如需要）
  - 会话记忆初始化
  - 钩子系统
  - 遥测集成

### Step 3: 逐步迁移
- 按依赖顺序迁移各子系统
- 保持 KX2API 的 Electron 架构

## 验收标准
- 入口逻辑完整覆盖 D:\src 的核心功能
- Electron 架构保持完整

## 风险/依赖
- 高风险：入口逻辑与架构深度耦合
