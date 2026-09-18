# Plan-013: 命令可用性检查 (meetsAvailabilityRequirement)

## 目标
实现 `D:\src\commands.ts` 中的 `meetsAvailabilityRequirement()` 函数，检查命令是否满足当前环境的可用性要求。

## 现状分析
- KX2API 无命令可用性检查机制
- 命令系统缺少环境适配能力（如某些命令只在特定平台/mode 下可用）

## 实施步骤

### Step 1: 可用性需求类型
- 新建 `src/engine/commands/availability.ts`
- 定义 `AvailabilityRequirement`：
  - `platform?: 'win32' | 'darwin' | 'linux'`
  - `mode?: 'cli' | 'web' | 'electron'`
  - `remote?: boolean` — 远程模式
  - `minVersion?: string`
  - `feature?: string` — 依赖的特性标记

### Step 2: meetsAvailabilityRequirement
- 实现 `meetsAvailabilityRequirement(req: AvailabilityRequirement): boolean`
- 检查逻辑：
  1. platform：对比 `process.platform`
  2. mode：对比当前运行模式（从 config 读取）
  3. remote：对比 `process.env.CLAUDE_CODE_REMOTE`
  4. minVersion：对比当前版本
  5. feature：通过 GrowthBook 检查特性开关

### Step 3: 命令注册时标注
- `Command` 接口增加 `availability?: AvailabilityRequirement`
- 注册时自动检查，不满足则跳过或标记为禁用

### Step 4: 过滤层
- 实现 `filterCommandsByAvailability(commands, env): Command[]`
- 供 `getCommands()` 调用

## 验收标准
- 标记 `platform: 'win32'` 的命令在 Linux 上不可用
- 标记 `feature: 'new-ui'` 的命令在特性关闭时不可用
- 远程模式过滤掉仅本地命令

## 风险/依赖
- 依赖 Plan-005 的 GrowthBook（feature 检查）
- 低风险：纯逻辑判断
