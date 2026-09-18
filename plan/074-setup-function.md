# Plan-074: Setup 函数 (setup.ts)

## 目标
实现 D:\src\setup.ts 中的 setup() 入口函数。

## 现状分析
- setup() 是 D:\src 的核心初始化函数
- 职责：Node.js 版本检查、工作目录设置、worktree 管理、UDS 启动、会话记忆、钩子初始化、遥测等
- KX2API 的初始化分散在多个地方

## 实施步骤

### Step 1: setup 函数骨架
- 新建 `src/engine/bootstrap/setup.ts`
- 实现 `async function setup(options): Promise<void>`
- options: cwd, permissionMode, worktreeEnabled 等

### Step 2: 核心初始化
- 工作目录设置
- 全局配置加载
- Git 状态检查

### Step 3: 子系统初始化
- 钩子系统初始化
- 插件预加载
- 遥测启动
- 会话记忆初始化

### Step 4: 工作树支持
- Worktree 创建和管理
- Tmux 会话集成

## 验收标准
- setup 函数完成所有初始化
- 各子系统正常启动
- 工作树模式可用

## 风险/依赖
- 高风险：核心初始化逻辑，与架构深度耦合
