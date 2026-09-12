# KX2API 左侧视图扩展规划

## 项目背景
在现有的左侧导航视图中新增 9 个管理模块，复用现有后端能力（agent/team、tool system、engine-bridge 等），最小化新增后端代码。

## 模块清单

| # | 模块 | 路由 | 图标 | 复用后端能力 | 新后端代码量 |
|---|------|------|------|-------------|------------|
| 1 | 计划管理 | `/plans` | Calendar | engine-bridge (`/plan` 命令) | 少量 IPC |
| 2 | 任务管理 | `/tasks` | CheckSquare | engine-bridge (`/task` 命令) | 少量 IPC |
| 3 | Git 管理 | `/git` | GitBranch | simple-git npm 包 | 新模块 |
| 4 | Agent 管理 | `/agents` | Bot | `src/main/agent/` 已有代码 | 仅 IPC 暴露 |
| 5 | 命令管理 | `/commands` | Terminal | engine-bridge + 命令系统 | 少量 IPC |
| 6 | 工作流管理 | `/workflows` | Workflow | engine-bridge + flow 工具 | 少量 IPC |
| 7 | MCP 管理 | `/mcp` | Plug | MCP client adapter | 新模块 |
| 8 | 插件管理 | `/plugins` | Puzzle | skill/plugin 系统 | 新模块 |
| 9 | 其他配置 | `/other-config` | Wrench | config store | 仅 IPC |

## 实施步骤

### Phase 1: 基础设施（所有模块共享）
- [ ] 在 `channels.ts` 添加新 IPC channels
- [ ] 在 `preload/index.ts` 暴露新 API
- [ ] 在 `handlers.ts` 注册 handlers
- [ ] 在 `zh-CN.json` / `en-US.json` 添加 nav 翻译
- [ ] 在 `Sidebar.tsx` 添加 navItems 条目
- [ ] 在 `App.tsx` 注册路由
- [ ] 创建各模块页面组件（lazy import）

### Phase 2: 各模块页面（可并行）
每个模块创建 `src/renderer/src/pages/<ModuleName>/<ModuleName>Page.tsx`，遵循现有页面模式：
- 使用 `useTranslation` + shadcn/ui 组件
- 通过 `window.electronAPI` 调用后端能力
- 统一风格

### Phase 3: 后端服务（按需）
- Git: `src/main/git/` 目录 + simple-git
- MCP: `src/main/mcp/` 目录 + MCP client
- Agent: 复用 `src/main/agent/`，新增 IPC handlers
- 其他: 通过 engine-bridge 或 config store 实现

## 文件变更汇总

### 修改文件（6个）
1. `src/main/ipc/channels.ts` - 新增 ~20 个 channel 常量
2. `src/preload/index.ts` - 新增 ~20 个 API 方法
3. `src/main/ipc/handlers.ts` - 新增 handlers
4. `src/renderer/src/components/layout/Sidebar.tsx` - 新增 9 个 navItems
5. `src/renderer/src/App.tsx` - 新增 9 个 lazy routes
6. `src/renderer/src/i18n/locales/zh-CN.json` + `en-US.json` - 新增 nav 翻译

### 新建文件（9+ 个页面 + N 个后端文件）
- `src/renderer/src/pages/PlanManagement/PlanManagementPage.tsx`
- `src/renderer/src/pages/TaskManagement/TaskManagementPage.tsx`
- `src/renderer/src/pages/GitManagement/GitManagementPage.tsx`
- `src/renderer/src/pages/AgentManagement/AgentManagementPage.tsx`
- `src/renderer/src/pages/CommandManagement/CommandManagementPage.tsx`
- `src/renderer/src/pages/WorkflowManagement/WorkflowManagementPage.tsx`
- `src/renderer/src/pages/McpManagement/McpManagementPage.tsx`
- `src/renderer/src/pages/PluginManagement/PluginManagementPage.tsx`
- `src/renderer/src/pages/OtherConfig/OtherConfigPage.tsx`
- `src/main/git/gitService.ts` (新)
- `src/main/mcp/mcpService.ts` (新)

## 技术选型
- 前端页面：shadcn/ui + Tailwind + lucide-react icons（与现有一致）
- 状态管理：可选的 zustand stores（复杂页面需要）
- Git 操作：`simple-git` npm 包
- MCP 客户端：已有 `src/main/proxy/toolCalling/clientAdapters/cherryStudioMcp.ts`
- Agent 管理：复用 `src/main/agent/team/` 和 `src/main/agent/action/`
