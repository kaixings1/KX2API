# Plan-032: 任务 Shell 类型 (LocalShellSpawnInput)

## 目标
实现 `D:\src\Task.ts` 中的 `LocalShellSpawnInput` 类型，定义 Shell 任务启动输入参数。

## 现状分析
- KX2API 有 shell 命令执行（Bash 工具）
- 但缺少结构化的 Shell 任务输入类型
- Bash 工具的参数是自由的 JSON，无类型约束

## 实施步骤

### Step 1: LocalShellSpawnInput 类型
- 定义 `LocalShellSpawnInput`：
  ```typescript
  interface LocalShellSpawnInput {
    command: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    stdin?: string
    shell?: boolean
  }
  ```

### Step 2: TaskContext 扩展
- 扩展 `TaskContext`（Plan-030 定义）
- Shell 任务的 context：
  - `spawnInput: LocalShellSpawnInput`
  - `process?: ChildProcess`
  - `exitCode?: number`

### Step Step 3: SetAppState 类型
- 定义 `SetAppState`：
  ```typescript
  type SetAppState = (updater: (prev: AppState) => AppState) => void
  ```

### Step 4: Shell 任务执行器
- 在 `src/engine/tasks/shellTask.ts` 中实现
- 使用 `child_process.spawn` 执行
- 实时流式输出 stdout/stderr
- 支持超时和中断

### Step 5: 集成到 Bash 工具
- Bash 工具内部使用 `LocalShellSpawnInput` 结构化参数
- 保证参数类型安全

## 验收标准
- `LocalShellSpawnInput` 完整定义 shell 启动参数
- Shell 任务正确执行并流式输出
- 超时自动终止
- stdin 输入正确传递

## 风险/依赖
- 低风险：类型定义 + 现有 shell 执行逻辑封装
