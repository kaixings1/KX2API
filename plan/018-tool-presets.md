# Plan-018: 工具预设系统 (TOOL_PRESETS / ToolPreset)

## 目标
实现 `D:\src\tools.ts` 中的 `TOOL_PRESETS` 常量和 `ToolPreset` 类型，提供工具预设分类能力。

## 现状分析
- KX2API 工具系统已有 `toolCollection` 和 `toolManager`
- 但缺少工具预设（预设=工具的有意义组合，如 "编程模式"、"搜索模式"）
- 工具没有统一的分类标签系统

## 实施步骤

### Step 1: ToolPreset 类型定义
- 新建 `src/engine/tools/presets.ts`
- 定义 `ToolPreset`：
  - `id: string` — 预设唯一 ID
  - `name: string` — 显示名称
  - `description: string` — 描述
  - `tags: string[]` — 工具标签
  - `denyRules?: string[]` — 禁用规则
  - `allowRules?: string[]` — 启用规则

### Step 2: TOOL_PRESETS 常量
- 导出 `TOOL_PRESETS: Record<string, ToolPreset>`：
  - `default`: 全部基础工具
  - `programming`: 编程相关（edit, bash, read, grep 等）
  - `search`: 搜索相关（webSearch, WebFetch 等）
  - `minimal`: 最小集（read, bash 等）

### Step 3: parseToolPreset
- 实现 `parseToolPreset(input: string): ToolPreset | null`
- 支持：
  - 预设 ID 直接匹配
  - 预设名称模糊匹配
  - JSON 字符串解析

### Step 4: getToolsForDefaultPreset
- 实现 `getToolsForDefaultPreset(allTools): Tool[]`
- 默认加载 default 预设中的工具
- 过滤掉 denyRules 匹配的工具

### Step 5: 集成到 QueryEngine
- `createEngine()` 或 `QueryEngine` 构造时接受 `tools` 选项
- 如果传入 preset 字符串，自动解析并过滤工具

## 验收标准
- `TOOL_PRESETS['default']` 包含完整工具集
- `parseToolPreset('programming')` → 返回对应预设
- `getToolsForDefaultPreset(allTools)` 过滤后只含允许工具
- 切换 preset 立即影响可用工具列表

## 风险/依赖
- 低风险：数据结构定义
