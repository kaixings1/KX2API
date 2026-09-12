# KX2API 死代码有机结合计划

## 已完成
- [x] P1: `PromptInjectionService` 激活 — 集成到 `ToolCallingEngine.transformRequest()`
- [x] P2: prompt variants 统一 — `variants/index.ts` 唯一数据源
- [x] P3: `/test-tools` 命令暴露 — registry.ts + engine-bridge.ts
- [x] P4: apiKey 同步统一 — `chat-handlers.ts` → `syncProfileApiKey()`
- [x] T1: 500 错误排查 — 根因：stream buffering 误判；修复：`stream.ts:244-294` 添加 content-type 判断，非工具场景跳过 buffering；`chat.ts` stream pipe 添加 `close` 监听
- [x] T2: 多角色协作系统 (MetaGPT) — 新建 `src/main/agent/team/types.ts` + `team.ts`，`Team.process()` 实现 Lead/Engineer 角色协作；`core.ts` query() 集成 `/team` 命令入口
- [x] T3: ToolCollection 模式 (OpenManus) — 新建 `src/main/proxy/tools/toolCollection.ts`，提供 addTool/execute/executeAll/syncFromRegistry；`core.ts` executeCommand() 优先使用 ToolCollection
- [x] T4: Agent Action 采样器 (SWE-agent) — 新建 `src/main/agent/action/types.ts` + `sampler.ts`，提供 think→action→observation 循环 + 轨迹记录；`core.ts` executeCommand()` 通过 ActionSampler 包装命令执行
- [x] T5: 文件覆盖修复 — `orchestrator.ts` 新增 `uniquePath()` 自动递增文件名避免覆盖；`tryResumePlan()` 支持多版本扫描续跑

## 测试规则
- 每次修改结束必须执行完整测试
- 必须使用 `f.json` 中可用的模型配置进行真实 LLM 调用测试
- 测试脚本：`npx tsx tools/test-multiagent-complete.ts`（Mock）和 `npx tsx tools/test-multiagent-real.ts`（真实 LLM）
- 若外部网络不可用，使用本地 Mock LLM 服务器：`npx tsx tools/mock-llm-server.ts` + `npx tsx tools/test-proxy-direct.ts`
- 所有测试必须通过（0 失败）才能提交

## 测试结果
- Mock 模式：34 通过, 0 失败
- 真实 LLM（StepFun step-3.7-flash）：Planner + Orchestrator 端到端通过，exit code 0

## 已完成（本次会话新增）
- [x] P6: `StreamingToolExecutor` 激活 — 并发控制工具执行，移植到 `src/main/proxy/tools/streamingToolExecutor.ts`
- [x] P7: `ToolOrchestrator` 激活 — 工具并发编排器，移植到 `src/main/proxy/tools/toolOrchestrator.ts`

## 左侧视图扩展（进行中）
### Phase 1: 基础设施（共享层）
- [x] P-S1: `channels.ts` 新增 9 模块 IPC channels（PLAN_*, TASK_*, GIT_*, AGENT_*, CMD_*, WORKFLOW_*, MCP_*, PLUGIN_*, OTHER_*）
- [x] P-S2: `preload/index.ts` 暴露 9 模块 API 到渲染进程
- [x] P-S3: `handlers.ts` 注册新 handlers（阶段1）
- [x] P-S4: `zh-CN.json` + `en-US.json` 新增 nav 翻译和页面 i18n keys
- [x] P-S5: `Sidebar.tsx` navItems 数组添加 9 个条目
- [x] P-S6: `App.tsx` 注册 9 个 lazy routes

### Phase 2: 前端页面（可并行，启动子代理）
- [x] P-P1: 计划管理页面 `/plans` — `pages/PlanManagement/PlanManagementPage.tsx`
- [x] P-P2: 任务管理页面 `/tasks` — `pages/TaskManagement/TaskManagementPage.tsx`
- [x] P-P3: Git 管理页面 `/git` — `pages/GitManagement/GitManagementPage.tsx`
- [x] P-P4: Agent 管理页面 `/agents` — `pages/AgentManagement/AgentManagementPage.tsx`
- [x] P-P5: 命令管理页面 `/commands` — `pages/CommandManagement/CommandManagementPage.tsx`
- [x] P-P6: 工作流管理页面 `/workflows` — `pages/WorkflowManagement/WorkflowManagementPage.tsx`
- [x] P-P7: MCP 管理页面 `/mcp` — `pages/McpManagement/McpManagementPage.tsx`
- [x] P-P8: 插件管理页面 `/plugins` — `pages/PluginManagement/PluginManagementPage.tsx`
- [x] P-P9: 其他配置页面 `/other-config` — `pages/OtherConfig/OtherConfigPage.tsx`

### Phase 3: 后端服务
- [x] P-B1: Git 服务 — `src/main/git/gitService.ts`（child_process execSync 封装）
- [x] P-B2: MCP 服务 — `src/main/mcp/mcpService.ts`（复用 toolCalling clientAdapters）
- [x] P-B3: handlers.ts 阶段2 — Git/MCP handlers 已接入 mcpService
1. 持续集成：将两个测试脚本加入 CI，每次提交自动跑
2. Electron UI 集成：在 KX2Code 界面中暴露多角色任务入口
3. 任务命令增强：`/team` 命令支持从 UI 发起多角色规划
4. 更多角色模板：可配置角色库，支持用户自定义 AgentRole
5. SessionMemory / SessionTranscript：会话记忆管理（需评估与现有日志系统整合）
6. MCP types 系统：MCP 协议类型定义移植（需评估是否需要 MCP 客户端集成）

## 待处理问题

### 已修复
- [x] tsconfig.json duplicate key "skipLibCheck" — 移除重复条目
- [x] RequestChart key 冲突 — `yTicks` 可能含重复值，使用 `new Set()` 去重
- [x] handlers OTHER_CONFIG_GET 返回 `{ config }` 而非 `{ data }` — 改为 `{ data }` 格式
- [x] handlers GIT_PULL/PUSH 返回 `{ success: true }` 无 output 字段 — 添加 output

### 待验证
- [ ] 手动启动 `npm run dev` 验证所有 9 个新页面能否正常访问和加载数据
- [ ] 验证 AgentManagement、TaskManagement、PlanManagement 等页面的 CRUD 操作
- [ ] 验证 GitManagement 页面 git 操作是否正常
- [ ] 验证 TeamTask 页面多角色任务执行是否正常

### 规则文档化
- [x] CLAUDE.md 添加"代码保护规则" — 不得随意删除代码、不得破坏已验证的正确结构、修改前先阅读

### 已知问题
- [x] SSL 握手失败（api.stepfun.com + CookieSession + Connect 协议）— 修复：stepfun adapter HTTPS 路径添加 `setCertificateVerifyProc`；Connect 协议路径改为 `setProtocol('h1')`；cookieSessionManager + inAppLogin 添加 `certificate-error` bypass
- [ ] CookieSession perplexity/zai/qwen-ai/minimax — `ERR_CONNECTION_CLOSED` 是网络层阻断（地域/防火墙），无法代码修复
- [ ] React key 冲突警告（非 Critical）— RequestChart 已修复，检查其他位置

### 新增任务
- [x] P-D1: 控制台调试日志 — 在代理转发层显示向服务器发送的请求内容和接收的响应内容，方便调试
  - 已完成：增强调试中间件，添加请求/响应头（脱敏）、耗时统计（durationMs）
  - 文件：`src/main/proxy/server.ts:61-130`
  - 注意：修复了 safeHeaders 赋值 bug（原代码用方括号属性访问而非赋值，导致 try-catch 静默吞掉所有日志）

### StepFun 适配器修复（本次会话）
- [x] API Key 模式下 tool 请求走标准 `/v1/chat/completions` 而非 `step_plan`（step_plan 不支持 tools，返回 400）
  - `src/main/proxy/adapters/stepfun.ts`: 新增 `chatCompletionStandardApi()` 方法
  - `chatCompletion()` 入口判断 `request.tools` 存在时走标准 API
- [x] Web Session 反代地址更新为 `https://studio.stepfun.com/playground`（用户确认）


## 待处理问题

### 已修复
- [x] tsconfig.json duplicate key "skipLibCheck" — 移除重复条目
- [x] RequestChart key 冲突 — `yTicks` 可能含重复值，使用 `new Set()` 去重
- [x] handlers OTHER_CONFIG_GET 返回 `{ config }` 而非 `{ data }` — 改为 `{ data }` 格式
- [x] handlers GIT_PULL/PUSH 返回 `{ success: true }` 无 output 字段 — 添加 output

### 待验证
- [ ] 手动启动 `npm run dev` 验证所有 9 个新页面能否正常访问和加载数据
- [ ] 验证 AgentManagement、TaskManagement、PlanManagement 等页面的 CRUD 操作
- [ ] 验证 GitManagement 页面 git 操作是否正常
- [ ] 验证 TeamTask 页面多角色任务执行是否正常

### 规则文档化
- [x] CLAUDE.md 添加"代码保护规则" — 不得随意删除代码、不得破坏已验证的正确结构、修改前先阅读

### 已知问题
- [x] SSL 握手失败（api.stepfun.com + CookieSession + Connect 协议）— 修复：stepfun adapter HTTPS 路径添加 `setCertificateVerifyProc`；Connect 协议路径改为 `setProtocol('h1')`；cookieSessionManager + inAppLogin 添加 `certificate-error` bypass
- [ ] CookieSession perplexity/zai/qwen-ai/minimax — `ERR_CONNECTION_CLOSED` 是网络层阻断（地域/防火墙），无法代码修复
- [ ] React key 冲突警告（非 Critical）— RequestChart 已修复，检查其他位置
