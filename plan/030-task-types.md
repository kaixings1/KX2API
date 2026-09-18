# Plan-030: 任务系统类型定义 (Task.ts types)

## 目标
实现 `D:\src\Task.ts` 中的核心类型定义：`TaskType`、`TaskStatus`、`TaskHandle`、`TaskStateBase`。

## 现状分析
- KX2API 已有任务系统（`src/main/agent/team/`、`src/engine/tasks/`）
- 但缺少与 D:\src 完全对齐的类型定义
- KX2API 的任务状态和类型体系不同

## 实施步骤

### Step 1: TaskType 类型
- 新建 `src/engine/tasks/types.ts`
- 定义 `TaskType` 类型：
  ```typescript
  type TaskType =
    | 'agent'      // AI agent 任务
    | 'human'      // 人工任务
    | 'shell'      // Shell 命令
    | 'plan'       // 计划任务
    | 'workflow'   // 工作流
  ```

### Step 2: TaskStatus 类型
- 定义 `TaskStatus`：
  ```typescript
  type TaskStatus =
    | 'pending'    // 等待中
    | 'running'    // 执行中
    | 'completed'  // 已完成
    | 'failed'     // 失败
    | 'cancelled'  // 已取消
    | 'blocked'    // 被阻塞
  ```

### Step 3: isTerminalTaskStatus
- 实现 `isTerminalTaskStatus(status: TaskStatus): boolean`
- 返回 true 的状态：`completed`, `failed`, `cancelled`

### Step 4: TaskHandle 类型
- 定义 `TaskHandle`：`{ id: string; cancel(): void; onProgress(cb): () => void }`

### Step 5: TaskStateBase
- 定义 `TaskStateBase`：
  ```typescript
  interface TaskStateBase {
    id: string
    type: TaskType
    status: TaskStatus
    createdAt: number
    updatedAt: number
    metadata: Record<string, unknown>
  }
  ```
- 实现 `createTaskStateBase(type, metadata): TaskStateBase`

## 验收标准
- `isTerminalTaskStatus('completed')` → true
- `isTerminalTaskStatus('running')` → false
- `createTaskStateBase('agent', { prompt: '...' })` 返回正确结构
- 类型覆盖所有 D:\src 定义的状态

## 风险/依赖
- 低风险：类型定义
