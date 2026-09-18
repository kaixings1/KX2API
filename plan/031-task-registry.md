# Plan-031: 任务管理 API (getAllTasks / getTaskByType)

## 目标
实现 `D:\src\tasks.ts` 中的 `getAllTasks()` 和 `getTaskByType()` 任务管理 API。

## 现状分析
- KX2API 有团队任务（`src/main/agent/team/`）和引擎任务
- 但缺少统一的任务注册表和管理 API
- 缺少按类型过滤能力

## 实施步骤

### Step 1: 任务注册表
- 新建 `src/engine/tasks/registry.ts`
- 定义 `TaskRegistry` 类：
  - `register(task): void`
  - `unregister(id): void`
  - `get(id): TaskStateBase | undefined`
  - `getAll(): TaskStateBase[]`
  - `getByType(type): TaskStateBase[]`
  - `getByStatus(status): TaskStateBase[]`

### Step 2: 全局注册表
- 导出 `getAllTasks(): TaskStateBase[]` — 返回所有任务
- 导出 `getTaskByType(type: TaskType): TaskStateBase[]` — 按类型过滤

### Step 3: 任务生命周期管理
- 实现 `updateTaskStatus(id, status): void`
- 实现 `updateTaskMetadata(id, metadata): void`
- 实现 `cancelTask(id): void`

### Step 4: 与引擎集成
- `QueryEngine` 中集成任务注册表
- 每次 query() 创建一个 agent 任务
- 每次 executeCommand() 创建一个 task 任务
- Team 模式创建团队任务

### Step 5: 持久化
- 可选：将任务状态保存到 `electron-store`
- 实现 `loadTasks(): void` / `saveTasks(): void`

## 验收标准
- `getAllTasks()` 返回当前所有活跃任务
- `getTaskByType('agent')` 只返回 agent 类型任务
- 任务状态变更后注册表实时更新
- 重启后任务状态可恢复（如实现持久化）

## 风险/依赖
- 低风险：在现有任务系统上封装
