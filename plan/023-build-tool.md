# Plan-023: 工具构建器 (buildTool / toolMatchesName / findToolByName)

## 目标
实现 `D:\src\Tool.ts` 中的 `buildTool()`、`toolMatchesName()`、`findToolByName()` 工具构建和查找函数。

## 现状分析
- KX2API 工具通过 `toolCollection.addTool()` 和 `ToolScheduler` 管理
- 但缺少从原始定义构建完整 Tool 对象的工厂函数
- 查找工具依赖 Map 索引，无字符串匹配能力

## 实施步骤

### Step 1: toolMatchesName
- 实现 `toolMatchesName(tool: Tool, name: string): boolean`
- 匹配逻辑：
  - 精确匹配 `tool.name === name`
  - 别名匹配 `tool.alias?.includes(name)`
  - 不区分大小写

### Step 2: findToolByName
- 实现 `findToolByName(tools: Tool[], name: string): Tool | undefined`
- 遍历工具列表，使用 `toolMatchesName` 匹配
- 返回第一个匹配的工具

### Step 3: buildTool
- 实现 `buildTool(def: ToolDef, context?: ToolUseContext): Tool`
- `ToolDef` 结构：
  - `name`, `description`, `parameters` (JSON Schema)
  - `execute: (input, context) => Promise<ToolResult>`
- 构建完整的 `Tool` 对象，包含：
  - 运行时状态（progress、cache）
  - 钩子（preExecute, postExecute）
  - 权限规则

### Step 4: ToolDef 类型
- 定义 `ToolDef`：
  ```typescript
  interface ToolDef {
    name: string
    description: string
    parameters: ToolInputJSONSchema
    execute: (input: unknown, context?: ToolUseContext) => Promise<ToolResult>
    alias?: string[]
    tags?: string[]
  }
  ```

### Step 5: 集成
- 在 `importCommands()` 中使用 `buildTool` 构建命令工具
- 在 MCP 工具适配中使用 `buildTool` 构建 MCP 工具

## 验收标准
- `toolMatchesName(tool, 'Read')` → true（精确）
- `toolMatchesName(tool, 'read')` → true（不区分大小写）
- `findToolByName(tools, 'Read')` → 返回 Read 工具
- `buildTool(def)` 返回完整的 Tool 对象

## 风险/依赖
- 低风险：工厂函数
