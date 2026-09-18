# Plan-017: 命令查找与描述 (findCommand / hasCommand / formatDescriptionWithSource)

## 目标
实现 `D:\src\commands.ts` 中的 `findCommand()`、`hasCommand()`、`getCommand()`、`formatDescriptionWithSource()` 函数。

## 现状分析
- KX2API `engine/commands/registry.ts` 已有 `get()` 和 `has()` 方法
- 但缺少：
  - `findCommand()` — 支持模糊/别名查找
  - `getCommand()` — 统一的命令获取接口
  - `formatDescriptionWithSource()` — 带来源的描述格式化

## 实施步骤

### Step 1: getCommand 统一接口
- 实现 `getCommand(name: string): Command | undefined`
- 查找顺序：
  1. 精确匹配（`registry.get(name)`）
  2. 别名匹配（遍历所有命令的 `alias` 数组）
  3. 模糊匹配（Levenshtein 距离 ≤ 2）

### Step 2: hasCommand
- 实现 `hasCommand(name: string): boolean`
- 使用 `getCommand()` 查找
- 比 registry.has() 更宽泛

### Step 3: findCommand
- 实现 `findCommand(nameOrAlias: string): Command | undefined`
- 支持：
  - 精确名称匹配
  - 别名匹配
  - 部分前缀匹配（`/t` 匹配 `/task`）
- 返回第一个匹配的命令

### Step 4: formatDescriptionWithSource
- 实现 `formatDescriptionWithSource(cmd: Command): string`
- 格式：`[builtin] description` 或 `[mcp:server] description` 或 `[skill:name] description`
- 根据命令来源添加标签前缀

### Step 5: 集成到 UI
- 在 `/help` 命令中使用 `formatDescriptionWithSource`
- 命令自动补全使用 `findCommand`

## 验收标准
- `getCommand('/task')` → 返回 task 命令
- `getCommand('/t')` → 前缀匹配成功
- `hasCommand('/unknown')` → false
- `formatDescriptionWithSource(mcpCmd)` → `[mcp:filesystem] 列出目录内容`

## 风险/依赖
- 低风险：逻辑增强
- 需要 Levenshtein 库（KX2API 已有 `fastest-levenshtein`）
