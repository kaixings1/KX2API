# Plan-012: 命令系统类型与常量 (commands.ts types)

## 目标
实现 `D:\src\commands.ts` 中的类型定义和常量导出（Command, CommandResult, INTERNAL_ONLY_COMMANDS, builtInCommandNames）。

## 现状分析
- KX2API `engine/commands/registry.ts` 已有 `Command` 和 `CommandResult` 接口
- 但缺少 `INTERNAL_ONLY_COMMANDS`、`builtInCommandNames` 等分类常量
- 缺少命令可用性检查逻辑

## 实施步骤

### Step 1: 命令类型扩展
- 扩展 `engine/commands/registry.ts` 中的 `Command` 接口：
  - 已有：`name`, `description`, `execute`
  - 新增：`group?: string`, `tags?: string[]`, `availability?: string[]`, `alias?: string[]`
- 扩展 `CommandResult`：已有 `success`, `output`, `error`, `needsAgent`
  - 新增：`plan?: unknown`（用于声明式命令模板结果）

### Step 2: 内部命令分类
- 新建 `src/engine/commands/constants.ts`
- 导出 `INTERNAL_ONLY_COMMANDS: string[]` — 仅内部使用的命令列表
- 导出 `builtInCommandNames: string[]` — 所有内置命令名
- 导出 `BRIDGE_SAFE_COMMANDS: string[]` — 桥接模式安全命令列表

### Step 3: LocalCommandResult
- 实现 `LocalCommandResult` 类型（D:\src 中 L409 处导出）
- 扩展：增加 `meta?: Record<string, unknown>`

### Step 4: Command 导入适配
- 确保 `engine/commands/importer.ts` 能正确加载所有命令
- 命令注册时自动分类到对应 group

## 验收标准
- `Command` 接口包含所有 D:\src 定义字段
- `INTERNAL_ONLY_COMMANDS` 包含正确列表
- 新命令可通过 `importCommands()` 自动注册
- `registry.getAll()` 返回完整命令列表

## 风险/依赖
- 低风险：类型层面扩展
