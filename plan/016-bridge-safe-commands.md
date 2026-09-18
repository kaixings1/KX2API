# Plan-016: 桥接安全命令 (BRIDGE_SAFE_COMMANDS / isBridgeSafeCommand)

## 目标
实现 `D:\src\commands.ts` 中的 `BRIDGE_SAFE_COMMANDS` 常量和 `isBridgeSafeCommand()` / `filterCommandsForRemoteMode()` 函数。

## 现状分析
- KX2API 有远程模式（Web 版通过 CCR 连接）
- 但缺少命令安全过滤层
- 某些命令涉及文件系统操作、shell 执行，在远程模式下应被屏蔽

## 实施步骤

### Step 1: 安全命令列表
- 新建 `src/engine/commands/bridgeSafety.ts`
- 导出 `BRIDGE_SAFE_COMMANDS: string[]`
- 包含只读、查询类命令：`/help`, `/version`, `/list`, `/status`, `/history`

### Step 2: isBridgeSafeCommand
- 实现 `isBridgeSafeCommand(name: string): boolean`
- 检查命令名是否在安全列表中
- 不区分大小写

### Step 3: filterCommandsForRemoteMode
- 实现 `filterCommandsForRemoteMode(commands: Command[]): Command[]`
- 过滤逻辑：
  1. 首先用 `isBridgeSafeCommand()` 过滤
  2. 额外检查命令的 `execute` 是否涉及危险操作
  3. 检查 `availability.remote` 字段

### Step 4: 危险操作检测
- 实现 `hasDangerousOperation(cmd: Command): boolean`
- 检测：
  - 使用了 `child_process`
  - 直接文件写入（`fs.writeFile`）
  - 数据库修改操作
- 通过 AST 扫描或约定标记检测

### Step 5: 桥接层集成
- 在 `engine-bridge.ts` 或 WebSocket handler 中应用过滤
- 远程客户端只能看到安全命令列表

## 验收标准
- `isBridgeSafeCommand('/help')` → true
- `isBridgeSafeCommand('/write-file')` → false
- `filterCommandsForRemoteMode(allCommands)` 只返回安全命令
- `/` 帮助列表在远程模式下只显示安全命令

## 风险/依赖
- 中风险：需仔细定义"安全"边界
- 依赖：桥接层架构
