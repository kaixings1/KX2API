# Plan-014: 命令获取与缓存 (getCommands / clearCommandsCache)

## 目标
实现 `D:\src\commands.ts` 中的 `getCommands()`、`clearCommandsCache()`、`clearCommandMemoizationCaches()`。

## 现状分析
- KX2API `engine/commands/registry.ts` 已有 `getAll()` / `getNames()` / `get()`
- 但缺少：
  - 分组过滤（getByGroup 已有但简单）
  - Memoization 缓存
  - 远程模式过滤
  - MCP/Skill 命令分类

## 实施步骤

### Step 1: getCommands 增强
- 实现 `getCommands(options?: { group?, tags?, includeDisabled?, mode? }): Command[]`
- 在 `engine/commands/registry.ts` 的 `CommandRegistry` 类上扩展
- 支持按 group、tags 过滤
- 支持模式过滤（cli/web/electron/remote）

### Step 2: 缓存层
- 实现 `clearCommandsCache(): void` — 清空命令缓存
- 实现 `clearCommandMemoizationCaches(): void` — 清空所有命令相关的 memoize 缓存
- 使用 WeakMap 或 Map 做命令结果缓存
- 注册/卸载命令时自动失效缓存

### Step 3: 远程安全命令
- 实现 `getRemoteSafeCommands(): Command[]` — 过滤出远程模式可用的命令
- 实现 `filterCommandsForRemoteMode(commands): Command[]`
- 移除需要本地文件系统访问、child_process 的命令

## 验收标准
- `getCommands({ group: 'utility' })` 只返回 utility 组命令
- `clearCommandsCache()` 后下次调用重新计算
- 远程模式下自动排除危险命令

## 风险/依赖
- 低风险：在现有 registry 上扩展
