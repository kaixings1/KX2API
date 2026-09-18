# Plan-015: MCP 与 Skill 命令分类 (getMcpSkillCommands / getSkillToolCommands)

## 目标
实现 `D:\src\commands.ts` 中的 MCP 技能命令和 Skill 工具命令的分类获取。

## 现状分析
- KX2API 已有 MCP client adapter（`src/main/proxy/toolCalling/clientAdapters/`）
- 已有 skill/plugin 系统（`src/engine/plugin/`）
- 但命令注册表与 MCP/Skill 的联动不完整

## 实施步骤

### Step 1: getMcpSkillCommands
- 实现 `getMcpSkillCommands(): Command[]`
- 从 MCP client adapter 获取已连接的 MCP 服务器列表
- 将每个 MCP 工具转为命令形式注册
- 命令名格式：`mcp:<server>/<tool>`

### Step 2: getSkillToolCommands
- 实现 `getSkillToolCommands(): Command[]`
- 从 skill/plugin 注册表获取已安装的 skills
- 将每个 skill 的入口点转为命令
- 命令名格式：`skill:<name>`

### Step 3: getSlashCommandToolSkills
- 实现 `getSlashCommandToolSkills(): Map<string, string[]>`
- 返回斜杠命令到 tool/skill 的映射
- 格式：`Map<'/search' -> ['web-search-skill']>`

### Step 4: 动态注册
- 在 `importCommands()` 中增加 MCP/Skill 命令的自动发现
- MCP 连接/断开时自动更新命令注册表
- Skill 安装/卸载时同步更新

### Step 5: ToolPreset 集成
- 实现 `TOOL_PRESETS` 常量和 `ToolPreset` 类型
- 将 MCP/Skill 工具按预设分类

## 验收标准
- 连接 MCP 服务器后，`getMcpSkillCommands()` 返回对应命令
- 断开连接后自动移除
- Skill 安装后立即出现在命令列表中
- `getSlashCommandToolSkills()` 返回正确的映射关系

## 风险/依赖
- 依赖 KX2API 已有 MCP client adapter
- 需处理 MCP 连接的异步生命周期
