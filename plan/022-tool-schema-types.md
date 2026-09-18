# Plan-022: 工具 Schema 类型 (ToolInputJSONSchema / ToolPermissionContext)

## 目标
实现 `D:\src\Tool.ts` 中的 `ToolInputJSONSchema` 类型和 `ToolPermissionContext` / `getEmptyToolPermissionContext()`。

## 现状分析
- KX2API `engine/toolScheduler.ts` 已有 `Tool` 类型定义
- 但缺少：
  - 输入 JSON Schema 的类型定义
  - 权限上下文系统
  - 空权限上下文的工厂函数

## 实施步骤

### Step 1: ToolInputJSONSchema
- 新建 `src/engine/tools/types.ts`
- 定义 `ToolInputJSONSchema`：
  ```typescript
  interface ToolInputJSONSchema {
    type: 'object'
    properties: Record<string, JSONSchemaProperty>
    required?: string[]
    additionalProperties?: boolean
  }
  interface JSONSchemaProperty {
    type?: string
    description?: string
    enum?: unknown[]
    default?: unknown
    items?: JSONSchemaProperty
  }
  ```

### Step 2: ToolPermissionContext
- 定义 `ToolPermissionContext`：
  - `source: 'user' | 'admin' | 'system'` — 权限来源
  - `rules: ToolPermissionRule[]` — 权限规则列表
  - `grantedTools: Set<string>` — 已授权工具
  - `deniedTools: Set<string>` — 已拒绝工具
  - `metadata: Record<string, unknown>` — 额外元数据

### Step 3: getEmptyToolPermissionContext
- 实现 `getEmptyToolPermissionContext(): ToolPermissionContext`
- 返回空的权限上下文（空规则、空授权集合）

### Step 4: ToolUseContext
- 定义 `ToolUseContext`：
  - `options: ToolExecutionOptions` — 执行选项
  - `abortController: AbortController`
  - `getAppState(): AppState`
  - `setAppState(fn): void`
  - `setInProgressToolUseIDs(ids): void`
  - `setResponseLength(len): number`
  - `readFileState: ReadFileState`

### Step 5: 集成
- 在 `ToolScheduler` 中使用 `ToolPermissionContext`
- 在 `QueryEngine` 中传递 `ToolUseContext`

## 验收标准
- `getEmptyToolPermissionContext()` 返回空上下文
- `ToolInputJSONSchema` 正确描述工具输入
- 权限上下文在工具执行链中正确传递

## 风险/依赖
- 低风险：类型定义
