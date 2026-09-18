# Plan-020: 基础工具获取与过滤 (getAllBaseTools / filterToolsByDenyRules)

## 目标
实现 `D:\src\tools.ts` 中的 `getAllBaseTools()` 和 `filterToolsByDenyRules()`，提供基础工具集合和 deny 规则过滤能力。

## 现状分析
- KX2API 已有 `toolCollection` 管理工具
- 但缺少：
  - 基础工具 vs 扩展工具的区分
  - Deny 规则过滤系统
  - 工具组合/池管理

## 实施步骤

### Step 1: 基础工具分类
- 新建 `src/engine/tools/baseTools.ts`
- 定义 `BaseTool` 类型（扩展 `Tool`，增加 `isBase: boolean` 标记）
- 基础工具列表（与 D:\src 一致）：
  - `Read`、`Write`、`Edit`、`Bash`、`Glob`、`Grep`、`LS`
  - `WebFetch`、`WebSearch`、`AskUserQuestion`

### Step 2: getAllBaseTools
- 实现 `getAllBaseTools(): BaseTool[]`
- 从 `toolCollection` 中过滤出 `isBase = true` 的工具
- 如果 toolCollection 未初始化，返回默认基础工具列表

### Step 3: Deny 规则系统
- 定义 `DenyRule` 类型：
  - `tool?: string` — 匹配工具名
  - `tag?: string` — 匹配标签
  - `path?: string` — 匹配路径模式
  - `env?: string` — 匹配环境条件
- 实现 `filterToolsByDenyRules(tools: Tool[], rules: DenyRule[]): Tool[]`
- 遍历规则，移除匹配的工具

### Step 4: 规则配置来源
- 从 `electron-store` 读取用户配置的 deny rules
- 支持热更新（配置变更自动重新过滤）

### Step 5: 集成到引擎
- `QueryEngine` 构造时自动应用 deny rules
- `setToolDefinitions()` 时重新过滤

## 验收标准
- `getAllBaseTools()` 返回所有标记为 base 的工具
- `filterToolsByDenyRules(tools, [{ tool: 'Bash' }])` 移除 Bash 工具
- 配置热更新后工具列表立即生效

## 风险/依赖
- 低风险：过滤逻辑
