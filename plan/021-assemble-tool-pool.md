# Plan-021: 工具池组装 (assembleToolPool / getMergedTools)

## 目标
实现 `D:\src\tools.ts` 中的 `assembleToolPool()` 和 `getMergedTools()`，管理多源工具的合并与组装。

## 现状分析
- KX2API 工具来源多样：基础工具、命令工具、MCP 工具、插件工具、Skill 工具
- 缺少统一的工具池组装和合并逻辑

## 实施步骤

### Step 1: 工具池组装
- 新建 `src/engine/tools/assemble.ts`
- 定义 `ToolPool` interface：
  - `base: Tool[]` — 基础工具
  - `commands: Tool[]` — 命令转换的工具
  - `mcp: Tool[]` — MCP 工具
  - `plugins: Tool[]` — 插件工具
  - `skills: Tool[]` — Skill 工具

### Step 2: assembleToolPool
- 实现 `assembleToolPool(options?: { presets?, denyRules?, includeCommands?, includeMcp? }): ToolPool`
- 流程：
  1. 获取基础工具（Plan-020）
  2. 获取命令工具（Plan-014）
  3. 获取 MCP 工具（Plan-015）
  4. 获取插件工具（已有 toolPluginRegistry）
  5. 获取 Skill 工具
  6. 应用 deny rules 过滤

### Step 3: getMergedTools
- 实现 `getMergedTools(pool: ToolPool): Tool[]`
- 合并所有来源的工具为扁平数组
- 处理命名冲突（同名的保留优先级高的）
- 优先级：命令 > MCP > 插件 > 基础

### Step 4: 合并策略
- 名称冲突：保留第一个（按优先级）
- 描述合并：用 `|` 拼接不同来源的描述
- 参数合并：取最完整的 schema

### Step 5: 集成
- 在 `QueryEngine.constructor` 中调用 `assembleToolPool`
- `getTools()` 返回合并后的工具列表

## 验收标准
- `assembleToolPool()` 返回包含所有来源的工具池
- `getMergedTools()` 返回扁平化的合并工具列表
- 同名工具只保留最高优先级的
- 添加/移除 MCP 服务器后工具池自动更新

## 风险/依赖
- 中风险：合并策略需仔细定义
