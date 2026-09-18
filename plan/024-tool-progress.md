# Plan-024: 工具进度系统 (filterToolProgressMessages)

## 目标
实现 `D:\src\Tool.ts` 中的 `filterToolProgressMessages()` 和进度类型定义。

## 现状分析
- KX2API 工具执行有事件系统（`AgentEvent`），包含 `tool_progress` 类型
- 但缺少：
  - 细粒度的进度消息过滤
  - 不同工具类型的进度事件定义
  - 进度数据的 compact 格式

## 实施步骤

### Step 1: 进度事件类型
- 定义 `CompactProgressEvent`：
  ```typescript
  interface CompactProgressEvent {
    type: 'start' | 'progress' | 'complete' | 'error'
    toolUseId: string
    toolName: string
    progress?: number // 0-100
    message?: string
    timestamp: number
  }
  ```

### Step 2: 工具进度类型
- 定义各种进度类型：
  - `AgentToolProgress` — 通用进度
  - `BashProgress` — Bash 命令进度（stdout/stderr 增量）
  - `MCPProgress` — MCP 工具进度
  - `REPLToolProgress` — REPL 工具进度
  - `SkillToolProgress` — Skill 工具进度
  - `TaskOutputProgress` — Task 输出进度
  - `WebSearchProgress` — Web 搜索进度

### Step 3: filterToolProgressMessages
- 实现 `filterToolProgressMessages(events: AgentEvent[]): CompactProgressEvent[]`
- 过滤逻辑：
  1. 只保留 `type === 'tool_progress'` 的事件
  2. 按 `toolUseId` 去重
  3. 按时间戳排序
  4. 转换为紧凑格式

### Step 4: 进度聚合
- 实现 `aggregateProgress(events): ToolProgress`
- 计算整体进度百分比
- 合并多工具的进度状态

## 验收标准
- `filterToolProgressMessages(events)` 正确过滤出进度事件
- 不同工具类型的进度事件有正确的类型标签
- 去重和排序正确

## 风险/依赖
- 低风险：数据转换
