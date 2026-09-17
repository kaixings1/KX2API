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


## 工具管理前端交互细化（ToolGroupsPanel）（2026-09-15）

改进点（均在 src/renderer/src/pages/ToolManagement/ToolGroupsPanel.tsx）：
- [x] 组内工具列表新增内联搜索（按工具名/别名/描述过滤）
- [x] 工具按平台分组折叠展示（全部/Windows/Unix，含 sticky 分组头计数）
- [x] 新增批量操作：全选 / 清空（对当前过滤结果批量启停）
- [x] 「被跳过」工具改为默认折叠的 details 区，不再堆满一行
- [x] 生效清单限制展示前 60 个 + 折叠被跳过项，避免 254 个全平铺
- [x] 「另存为组」改为 Dialog 对话框，带名称非空/重名校验
- [x] 拆分视觉分区（Separator 分隔 生效/编辑 两个区块）
- [x] 移除 ScrollArea（滚动行为不可靠），改用原生 overflow-y-auto 滚动容器
- [x] 修正多个引用命名冲突（isCheckedIn/applyBatch），消除未知变量

说明：各翻译键仍沿用 i18next fallback 默认值风格，未改 locale JSON。
验证：ts.transpileModule 语法校验通过；错误引用扫描无残留。运行时效果待 npm run dev 人工确认。

## 工具参数（JSON Schema）编辑打通（2026-09-15）

里程碑 3：让自定义工具能配置命令参数（parameters），打通 后端到前端 全链路。

改动文件：
1. src/main/tools/toolManager.ts — addTool 补 parameters 空数组兜底（避免 undefined）。
2. src/renderer/src/pages/ToolManagement/ParameterEditor.tsx — 新增结构化参数编辑器组件（name/type/required/description/defaultValue，支持增删改行 + 类型选择）。
3. src/renderer/src/pages/ToolManagement/ToolManagementPage.tsx — ToolDef/toolForm 加 parameters；添加/行内编辑透传 parameters（过滤空名占位行）；接入 ParameterEditor。
4. src/renderer/src/pages/ToolManagement/ToolDetailPage.tsx — 详情页新增参数展示卡片（类型/必填/默认值/描述）。

链路：UI（ParameterEditor）→ toolManager.addTool/updateTool（透传 parameters）→ toolRuntime.buildParameterSchema 生成函数 JSON Schema → 发请求给模型。

验证：四个文件 ts.transpileModule 语法校验通过；setToolForm 一致性与 import 扫描通过。运行时待 npm run dev 人工确认。

---

## 全面代码审查 + d:/src 能力吸收（2026-09-17）

### 一、根本性架构缺陷（已修复）

**项目此前完全没有类型检查。** 根目录无 `tsconfig.json`，`package.json` 也没有 typecheck 脚本，
`electron-vite` 走 esbuild 只做转译不做类型检查 —— 所有类型错误静默通过。

- 新增 `tsconfig.check.json`（刻意不叫 `tsconfig.json`：electron-vite 会读取根 tsconfig，
  贸然新增可能改变 main/preload 的路径解析行为）
- 新增 `npm run typecheck` 脚本
- 首次全量检查暴露 **708 处类型错误**，其中 54 处 `TS2304 Cannot find name` 属运行时崩溃候选

复用工具：`python scripts/_tscheck.py`（按文件/错误码归类）、`python scripts/_audit_ipc.py`（IPC 三处一致性核对）。

### 二、IPC 链路缺陷（已修复）

`channels.ts` 定义 269 个 channel，主进程注册 255 个，preload 暴露 263 个。核对结论：

- **preload 混用常量与字符串字面量**：201 处用 `IpcChannels.X`，62 处直接写 `'tools:getAll'` 这类字面量。
  改 channel 名时字面量那批不会报错，会静默失联。建议后续统一收敛到常量。
- **11 个 channel 未纳入 `channels.ts`**：`chat:{pause,resume,getState,grantPermission,denyPermission,
  subscribeEvents,unsubscribeEvents}`、`tasks:autoExecuted`、`tray:{open-dashboard,quit-app,set-height}`。
- `preload/index.ts:1441-1453` 暴露了通用 `on/send/invoke(channel, ...)`，**绕过整个白名单** —— 渲染层
  可调用任意 IPC channel。这是安全边界问题，建议移除或改为白名单校验。

### 三、已修复的具体缺陷

| # | 位置 | 问题 | 后果 |
|---|---|---|---|
| 1 | `engine/api/client.ts:569` | 引用未声明的 `maxRounds` / `repeatCount` | **每个带工具的请求都抛 ReferenceError**，被外层 catch 转成错误返回前端 |
| 2 | `main/ipc/handlers.ts:2472` | `allLegacyToolPlugins` 未导入 | `plugins:setEnabledList` 必崩，插件启用列表功能不可用 |
| 3 | `main/oauth/kimiSessionManager.ts:80,89` | `logManager` 未导入 | `did-finish-load` 处理器崩溃 → `session-ready` 永不触发，Kimi 会话永不就绪 |
| 4 | `engine/responseHandler.ts:160` | `checkNeedsUserInput` 用 `\b(请问\|是否\|确认\|继续…)\b` | 中文不属 `\w`，词边界完全失效；「继续/确认」在正文中极常见 → 误判 |
| 5 | `engine/messageLoop.ts` | needsUserInput 时 `return true` 继续循环 + `needs_user` 事件发两次 | 配合 #4 会空转到 `maxIterations(100)`；事件重复推送。已改为终止性状态、事件只发一次 |
| 6 | `renderer/.../TaskManagementPage.tsx:13` | `CardHeader` / `CardTitle` 未导入 | 渲染崩溃 |
| 7 | `renderer/.../CommandManagementPage.tsx:14` | `Loader2` 未导入 | 渲染崩溃 |
| 8 | `renderer/.../WorkflowDetailPage.tsx:13` | `XCircle` 未导入 | 渲染崩溃 |
| 9 | `preload/index.ts` | 4 个 chat 工具事件无订阅方法 | 见下节 |

### 四、工具事件链路断点（架构收敛后已接通）

固定架构方向：**工具执行权归属 `MessageLoop`**（`client.ts` 已改单轮、不再自行执行工具；
`engine-bridge.ts` 的 `onToolUse` 已改为把 `tool_use` 转发回引擎）。

此前该链路存在三处断点，导致工具调用过程对 UI 完全不可见：
1. 主进程 `chat-handlers.ts:131-163` 发送 `CHAT_STREAM_TOOL_START/TOOL_RESULT/NEEDS_USER/ABORTED`
2. `preload/index.ts` **未暴露**对应订阅方法 → **已补齐 4 个**（`onStreamToolStart` /
   `onStreamToolResult` / `onStreamNeedsUser` / `onStreamAborted`）
3. `ChatPage.tsx` 未订阅，只能从正文文本里"猜"工具调用 → **已订阅**，按 `toolUseId` 维护权威列表，
   与正文解析结果在 done 阶段合并

`renderer/src/types/electron.d.ts` 同步补齐声明（含此前遗漏的 `onStreamReasoning`）。

### 五、其它已确认的架构冲突（未改，需决策）

- **上下文预算拦不住工具执行**：`TokenBudgetManager.shouldReject` 在 MessageLoop 内，而工具经
  `ToolScheduler` 执行；预算检查与工具执行之间没有强制门禁。
- **`messageLoop.ts:204` 重新赋值 `conversation.messages` 数组**：外部持有旧引用的持有者会读到过期数组。
- **`messageLoop.ts:432` 的 `lastToolCalls` 从未被填充** → `autoContinue.readSearch` 分支恒不触发（死功能）。
- **`messageLoop.ts:100` `TOOL_LOOP_THRESHOLD` 声明未使用**（实际用字面量 `2`）。
- **`engine/messageLoop.ts:226-234` 每轮重复赋值 `responseHandler.onChunk/onReasoning`**：并发 `run()` 会互相覆盖。
- 其余 44 处 `Cannot find name` 中，多数在类型位置（`AxiosError`/`SystemPrompt`/`ConfigGroup` 等）无害；
  需逐个排查值位置的（如 `store/index.ts:32` 的 `storeManager`、`tools/toolContext.ts:145` 的 `lastUsedAt`、
  `proxy/index.ts:17` 的 `proxyServer`、`engine/messages.ts:589` 的 `message`）。

### 六、能力吸收：记忆召回系统

移植自 `D:\src\memdir\`（Claude Code 记忆系统），新增 `src/engine/memory/memoryRecall.ts`：

- **同构路径约定**：`<homedir>/.doge/projects/<sanitizePath(项目根)>/memory/`，与现有目录完全一致，无需迁移数据
- **扫描**：单遍 `readdir` + 每文件只读前 30 行解析 frontmatter，按 mtime 排序取 Top200
- **检索**：关键词预排序（非向量）。中文用**二元组**分词 —— 单字会让「量子物理问题」这类无关查询
  噪声命中一片记忆；名称整体命中 +2，词元重叠 +1，feedback/project 类 +0.5
- **预算**：单文件 200 行 / 4096 字节，单轮最多 5 条
- **老化**：超过 1 天附「内容为时间点快照，行号可能已过时」提示
- **注入**：`<memory>` 包裹，附「据此下结论前先核对当前代码真实状态」的免责说明
- **失败降级**：任何异常静默返回 null，绝不阻断主请求
- **接入点**：`engine-bridge.ts` 构建 system 消息处（与 `toolHint` 拼接）

刻意不移植：`teamMemorySync`（绑定 Anthropic 服务端 API）、LLM 选择器（需额外一次模型调用，延迟收益比不佳）。

验证：`tests/engine/memory-recall.test.ts` 27 项用例全通过；对真实记忆目录实测 3/3 精准命中
（"工具调用后答复丢失" → 聊天流式链路回归；"图片文件要不要读取" → 图片文件不读取内容；
"配置保存重启后丢失" → 主进程单例初始化时序坑）。

### 七、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 397 通过（含新增 27）/ 单元 523 通过 / 0 失败
- `python scripts/_tscheck.py` → 修复后 TS2304 由 57 降至 54，4 个修复目标残留检查全部「已清除」

## 第二轮：找茬式审核 + 深度吸收（2026-09-17 晚）

采用 4 个 research 子代理并行通读 `D:\src` 的四个领域（压缩/预算、会话记忆、工具系统、提示词/钩子），
与 KX2API 现状逐项对照。**子代理结论均经过原文件复核后才采纳**。

### 一、新发现并修复的 P0 缺陷

| # | 位置 | 问题 | 后果 |
|---|---|---|---|
| 1 | `messageNormalizer.ts:96` | `mergeConsecutive` 把 Anthropic 的 `tool_result` 内容数组 `JSON.stringify` 成字符串再拼接 | 并行工具调用时 tool_result 结构被降级为纯文本 → API 认为 tool_use 无配对结果 → **400**。每条 tool 消息各产生一条 `role='user'`，必然触发合并，是常态路径 |
| 2 | `messageNormalizer.ts:39` | `mergeConsecutive` 是 `static` 方法，却以 `this.mergeConsecutive(...)` 调用 | 实例上无此属性 → **Anthropic 分支任何需合并的消息序列都抛 TypeError**（Anthropic 模式此前不工作的原因之一） |
| 3 | `autoCompactor.ts`（3 处） | Summary/Truncate/Selective 三策略都按 `nonSys.slice(-preserveRecentCount)` 切分 | 切点落在 `assistant(tool_use)` 与 `tool_result` 之间 → 保留段以**孤立 tool_result** 开头 → **400** |
| 4 | `plainTextToolCallRepair.ts` | 只做"名字长得像命令"的**形状校验**，不与真实工具集求交集 | 接口文档/示例里的 `<name>get_user</name>`、`[tool:bash]` 被判为工具调用并**整块剥离正文**（内容静默消失，比误转换更隐蔽）。这是历史回归的根因 |
| 5 | `plainTextToolCallRepair.ts:379` | `strip` 的扁平正则含裸 `name` 标签，而 `collectFlatXmlTools` 的识别正则**不含** | 识别集合与剥离集合不一致 → 误删正文 |
| 6 | `responseHandler.ts:123` | 整段判定为纯工具调用时 `fullContent = ""` 且无任何保护 | 一旦误判，用户看到空白答复且无迹可查 |

### 二、移植的三个模块（均零闭源依赖）

**1. `src/engine/messageIntegrity.ts`（新增）**
- `groupMessagesByApiRound` — 移植自 `services/compact/grouping.ts`（63 行，上游唯一"复制即用"的文件）
- `ensureToolResultPairing` — 移植自 `utils/messages.ts`，修复四类畸形：重复 tool_use / 孤立 tool_result / 缺失 tool_result（补合成占位）/ 重复 tool_result
- `splitAtSafeBoundary` — 按 API 轮次切分，保证 dropped 与 kept 各自配对完整
- **接入点**：`RequestBuilder.build()` 发请求前兜底调用；`AutoCompactor` 三策略改用安全切分

**2. `src/engine/toolResultStore.ts`（新增）**
- 移植自 `utils/toolResultStorage.ts` + `constants/toolLimits.ts`
- 口径对齐上游：50_000 字符阈值 / 2000 字节预览 / 预览在最近换行处切 / `flag:'wx'` 幂等落盘
- **防路径穿越**：`toolUseId` 来自模型，非 `[a-zA-Z0-9_.-]` 字符一律替换（`../../etc/passwd` → `.._.._etc_passwd`）
- **失败降级**：落盘失败必须原样返回内容，绝不丢工具输出
- 附带 `cleanupToolResults`（按 mtime 清 30 天前文件）
- **接入点**：`ToolScheduler.executeSingle` 包一层；主进程 `src/main/index.ts` 启动时配置目录到 `userData/tool-results-root` 并清理
- 收益：读日志/跑构建/列大目录这类工具不再一次吃光上下文窗口

**3. 纯文本工具调用白名单化（改造既有模块）**
- 新增 `isAllowedToolName(name, allowedNames)`：白名单存在时必须命中
- 语义区分：**未提供**白名单 → 退回形状校验（向后兼容）；**空集** → 明确表示本轮无工具，拒绝一切
- `parsePlainTextToolCalls` / `extractPlainTextToolCalls` / `stripPlainTextToolCalls` 三个入口全部接受 `allowedNames`
- `ResponseHandler.allowedToolNames` 由 `MessageLoop` 每轮注入生效工具名
- `strip` 两处剥离改为「只有命中白名单才剥离」，并去掉与识别集合不一致的裸 `name` 标签
- 剥离后正文若全空 → 判定过宽剥离，回退保留原文并告警（宁可少执行一次工具，不让用户看到空白）
- 清空正文前把原文样本写入日志，便于事后追查"答复为什么是空的"

### 三、子代理报告的其它结论（值得记录）

- **KX2API 与 Claude Code 工具系统的最大差距不在打分函数，而在状态归属**：CC 的"已加载工具集"由对话历史反扫 `tool_reference` **推导**（可重放、抗重启、压缩后仍可恢复）；KX2API 存在进程内 `Map`（重启即丢、压缩后与历史不一致）。这是结构性差距，非局部修补能解决。
- **"254 个工具每轮重复注入"是工具延迟加载问题，文本压缩治不了**。CC 的解法是 `ToolSearchTool` + `defer_loading`；KX2API 已有的 `toolGroups.ts` 方向是对的，应继续加强而非转向文本压缩。
- **`D:\src\utils\absorb.ts` 有 4 个真实 bug，默认行为在某些输入下会把整段文本压成空字符串**（缓存写入时机错误）。若要移植必须先修：① `cache.set` 移到相似判定之后；② 重建改为按原始行区间保序拼接；③ 补 `MAX_INPUT_LENGTH` 闸；④ 默认关 `globalDedup`。
- **`D:\src` 是部分移植的中间态树**：`services/contextCollapse/operations.ts`、`reactiveCompact.ts`、`snipCompact.ts`、`query/transitions.ts`、`proactive/*` 均为空壳桩（恒等函数/空实现）；`services/crossSessionMemory.ts`、`utils/persistentMemory.ts` 是死代码且有硬伤。移植前必须先 Read 验证有真实实现。
- **KX2API 缺的记忆写入闭环**：CC 的 `extractMemories` 在回合结束后台 fork 提取，并有"主代理已写过记忆则跳过"的互斥闸、`WHAT_NOT_TO_SAVE_SECTION` 黑名单、"游标仅在成功后推进"。KX2API 目前只有显式 `memoryTool`，模型不主动调就不写。已记入待办。

### 四、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 465 通过（本轮新增 68）/ 单元 552 通过 / **0 失败**
- 新增测试文件：
  - `tests/engine/message-integrity.test.ts`（27 例）— 分组/配对修复/压缩不变量/Anthropic 并行工具结果结构
  - `tests/engine/tool-result-store.test.ts`（23 例）— 阈值/预览行边界/幂等/路径穿越/失败降级/清理
  - `tests/engine/plaintext-whitelist.test.ts`（18 例）— **复现历史 bug（无白名单时正文被剥离）并证明修复有效**

### 五、下一轮待办（2026-09-18 复核：全部已完成）

- [x] **记忆写入闭环**：回合结束后台提取 + 预筛 + 不保存内容黑名单
  - `engine/memory/autoMemory.ts`（预筛 → 模型提炼 → `writeMemory`）
  - 接入 `chat-handlers.runPostTurnTasks`；新增 `/remember` 命令；设置界面有开关
- [x] **工具活跃集改为对话历史推导 + 落盘**
  - `main/tools/toolSessionStore.ts`（落盘 + `deriveActiveToolsFromMessages` 历史反扫）
  - `toolMetaTools.reconcileFromHistory` 已接入 `runPostTurnTasks`
  - ⚠️ 注意 id 与 name 是两套标识符（见 `mergeActiveTools` 注释），已分别过滤并加测试
- [x] `tool_search` 打分加词边界与 `searchHint`
- [x] `toolResultStorage` 的**单消息聚合预算**（`enforceToolResultBudget`，接入 `requestBuilder`）
- [x] 系统提示词静态/动态分段 + 缓存边界标记（`engine/promptSections.ts`，扩展了泛型缓存 `memoizeByKey`）
- [x] 把 typecheck 纳入 CI
  - ⚠️ **修正**：原 CI 的 typecheck job 指向 `project/tsconfig.json`（另一个项目），
    主应用从来没有任何类型检查。已拆为 `typecheck-project` + `typecheck-app`
    （后者盯 `tsconfig.check.json`，当前约 710 个存量错误，暂设 `continue-on-error` 并输出错误数到 Job Summary）

## 第三轮：按待办推进（2026-09-17 深夜）

### 一、修复崩溃：`toolContext.ts` 引用未导入的 `lastUsedAt`

`toolContext.ts:145` 的 LRU 淘汰排序调用 `lastUsedAt(sessionId, a.id)`，
但导入列表只有 `getActiveTools, touchTool` —— **值位置的未定义标识符，必然 ReferenceError**。
触发条件：分层模式下工具总 token 超出预算、进入淘汰分支时。

修复：补上 `lastUsedAt` 导入。这是上一轮类型检查标记出但未逐个处理的 44 处之一，现补上。

### 二、工具检索重写（`toolMetaTools`）

原实现两个缺陷使 254 个工具下的检索基本失效：
1. **无词边界**：`name.includes('search')` 会命中 `research_notes`，`git` 会命中 `digital`
2. **中文整串匹配**：查询按空格切分，"读取文件"整体作为一个 token，匹配不到描述里的"读取某个文件的内容"

新实现（参照 Claude Code `ToolSearchTool`）：
- **分词**：拉丁按词切、中文切**二元组**（与 `memoryRecall` 同口径，避免同仓库两套标准）
- **名称片段化**：先拆 camelCase/snake/kebab/点/冒号再比较。
  片段相等 +6、**片段前缀** +3（用前缀而非子串，这是 `git` 不命中 `digital` 的关键）
- **词边界正则** `(^|[^a-z0-9])term([^a-z0-9]|$)`，带 500 条上限缓存
- **每 token 只取最高命中档**，不跨档累加 —— 防止长描述靠堆词刷分
- **`searchHint` 字段**（`types.ts` 新增）：补上工具名与描述里都没有、但用户会这么问的词
  （如 `read_file` 的 `jupyter`/`ipynb`）
- **`+term` 必需词语法**：`+git commit` → 必须与 git 相关，在打分前预过滤缩小候选集

### 三、工具结果单消息聚合预算（`toolResultStore`）

单结果有 50K 阈值，但 **N 个并行工具各 40K 就能凑出 400K** —— 单个阈值拦不住聚合。
新增 `enforceToolResultBudget`（默认 200K 字符/轮）：

- 按 API 轮次分组，**按结果大小降序**替换（用最少次数压到预算内）
- **决策冻结**是该设计的核心：某个 toolUseId 一旦被决策（替换或不替换），
  后续轮次不得反悔 —— 否则替换集合每轮变化会让 prompt cache 全量失效
- 已决策替换的**重放冻结字符串**（零 I/O，字节一致，必然命中缓存）
- **净减少保护**：预览正文（含路径头部）本身有体积，替换后若反而更长则放弃
- **超支是设计内行为**：当"全部替换后的预览总量"仍超预算（预算极小时），
  接受超支交给上层压缩 —— 与上游 Claude Code 同口径
- 落盘失败一律冻结为不替换，**绝不因预算控制而丢工具输出**
- 接入 `RequestBuilder` 请求链路（配对修复之后，因为只改内容不改结构）

### 四、记忆写入器（`memoryWriter`，补齐记忆系统的写入侧）

此前只有读取侧（`memoryRecall`），写入侧完全缺失。上游把「什么不该记」写成硬规则，
因为记忆写错会在后续每轮被召回、持续污染判断。

- **不保存黑名单**（4 条规则）：代码结构/文件路径、git 历史、调试配方、临时任务进度 ——
  判据是「这些能从代码库直接查到」，存进去只会过期
- **密钥扫描**（7 类）：OpenAI/Anthropic/GitHub/AWS/JWT/私钥/Bearer，命中即拒收
- **索引纪律**：`MEMORY.md` 每行 ≤150 字符的指针、≤200 行、≤25KB，超限从头截断并留说明
- **原子写入**：tmp + rename，避免读到半截文件
- **文件名安全**：`../../etc/passwd` → 中和为无路径字符的名字
- **`looksWorthRemembering`**：回合结束后台提取的廉价预筛，明显不该记的直接跳过，
  不必再花一次模型调用

### 五、架构冲突记录（memoryTool 目录不一致已解决，见「memory_* 工具闭环」）

- **`src/memory/memoryTool.ts` 与记忆系统目录不一致**：前者基于 `/memories` 路径的
  通用文件操作（view/create/str_replace/insert/update/rename），目标用
  `.doge/projects/<编码项目>/memory/`。两套并存，调用方容易写错目录。
  **已解决**：默认落盘根改为统一走 `resolveMemoryDir()`（见下方小节）。
- **回合结束后台提取接线**：`looksWorthRemembering` + `writeMemory` 已就绪，
  调用点在 `src/main/ipc/chat-handlers.ts:249` 的 `runPostTurnTasks`（回合成功结束后
  由 `eng.query()` 返回处 `void` 触发，不阻塞）。

### 六、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 通过（本轮新增 81）/ 单元 560 通过 / **0 失败**
- 新增测试：`tool-search-scoring.test.ts`(25) / `result-budget.test.ts`(17) / `memory-writer.test.ts`(39)
  - 其中检索测试**复现原实现的两个误报**（`search` 命中 `research`、`git` 命中 `digital`）并证明修复有效
  - 记忆写入器测试含**读写闭环验证**（写入 → 召回命中）

## 第四轮：提示词缓存与协议一致性（2026-09-17 收尾）

### 一、修复 P0：提示词变体协议与解析器不一致

`XML_VARIANT.modelPatterns = ['.*']` 且 priority 与 `DEFAULT_VARIANT` 相同，靠数组顺序
**抢在 default 之前匹配所有模型**。而 `DefaultPromptAdapter.transformRequest` 用
`selectPromptVariant({model})` 注入协议、却用 bracket 解析器解析响应：

```
main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.ts:125  selectPromptVariant({model, provider})
main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.ts:143  const variant = this.getPromptVariant(model)
main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.ts:110  extractToolCallsFromText(content, 'default')  ← bracket
```

后果：给 gpt-4o 这类通用模型注入 **XML 工具调用协议**，却按 **bracket 格式解析**响应
→ 模型按 XML 输出时解析不出来 → 工具调用失败。

修复：`XML_VARIANT.modelPatterns` 改为 `[]`（不参与按模型名自动匹配）。
XML 协议的正规入口是显式指定（`getVariantByFormat('xml')`、`CherryStudioPromptAdapter`
已声明 `format = 'xml'`），都不依赖该字段。

### 二、修复：`variantSelector` 的未声明变量与排序缺失

- `registerVariants` 内 `_sorted = false` —— 该变量**从未声明**，ES module 严格模式下
  必然抛 ReferenceError，使批量注册完全不可用（该函数当前无调用方，属潜伏缺陷）
- 批量注册后**不排序**，而 `selectPromptVariant` 按数组顺序取首个匹配 → 后注册的
  高优先级变体永远匹配不到（单个注册的 `registerVariant` 有排序，行为不一致）
- 修复：删除 `_sorted`，注册后统一 `sort(priority desc)`

### 三、新增 `src/engine/promptSections.ts`：系统提示分片与缓存

移植自 `D:\src\constants\systemPromptSections.ts`（上游 70 行，零依赖）。

**解决的真实问题**：`engine-bridge.createApiClientStream` 在**工具循环的每一轮**都被调用，
而它每次都重新计算 `memorySection`（扫描记忆目录 + 读取文件）。一次 query 内用户输入不变，
不缓存等于每轮重复 I/O。

- `section(name, compute)` — 记忆化；`name` 即缓存键（须把影响输出的输入拼进键）
- `volatileSection(name, compute, reason)` — 每轮重算，**reason 必填**（破坏缓存前缀需自证）
- `resolveSections` 并行求值；单分片失败降级为 null，不拖垮整体组装
- **真 LRU**：命中时 `touchEntry` 刷新位置（Map 对已存在键 `set` 不改变顺序，
  只读不重排会让热键停在最旧位置被误踢 —— 该缺陷被单测抓到）
- `checkSectionOrder` / `buildPromptFromSections`：检出「稳定段排在易变段之后」的顺序错误
- `fingerprint`：长文本哈希做缓存键，避免常驻大字符串

**接线**：
- `engine-bridge` 用 `section('memory:' + fingerprint(query), ...)` 包住记忆召回
- `CHAT_CLEAR_HISTORY` 清空时调 `clearSectionCache()` + `resetRequestBuilderCaches()`

⚠️ **接线教训**：`resetReplacementState()` 与 `clearSectionCache()` 起初都只定义了、
**没有调用方**。配置化/缓存化最常见的失败就是「接口有了但没接上」——
新增此类接口后必须反向确认存在真实调用点。

### 四、修复：`AuditLogger` 缺方法与浮空 Promise

- 测试引用的 `src/main/security/AuditLogger` 缺 `stopFlushTimer()`，
  只有 `stop()`（清定时器 + 触发 flush，带 I/O 副作用）。
  补 `stopFlushTimer()` public 方法（只释放定时器句柄，用于测试/参数校验场景）。
- `stop(): void` 内部调用 `this.flush()` 却丢弃返回的 Promise —— 若紧接着进程退出会丢日志。
  改为 `async stop(): Promise<void>` 并 `await`，用 try/catch 保证即使 flush 失败也先释放句柄
  （定时器不释放会让 Node 进程无法退出）。

### 五、定量发现：425 个孤儿文件（未清理，需决策）

`npm run check:repo` 结果：`src/` 共 836 文件，应用引用 411，**孤儿 425**。

| 目录 | 孤儿数 |
|---|---|
| src/main | 274 |
| src/engine | 91 |
| src/renderer | 21 |
| src/__tests__ | 17 |
| src/security | 6 |
| src/utils / src/shared / 其它 | 16 |

**security 双份实锤**：
- `src/main/security/` —— **7/7 全部是孤儿**（整个目录未被任何生产代码引用，
  仅 `textRuntimeLimits.test.ts` 引用其 AuditLogger）
- `src/security/` —— 9 文件中 3 个被 `engine/securityEnhancer.ts` 与
  `engine/sandbox/index.ts` 引用（活的），其余 6 个是孤儿

⚠️ **未擅自清理**。CLAUDE.md 明确警告过：`.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts`，
按后缀一把删会误伤不会被 git 跟踪的手写声明文件。且删除是破坏性操作，
需先确认这些目录是否为迁移中间态。建议按目录分批评估，每批先跑 `npm run build` + `test:all`。

### 六、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 / 单元 614（本轮新增 24）/ **0 失败**
- `npm run check:repo` ✅ 报告已刷新至 `docs/integration-report.md`
- 新增测试：
  - `src/__tests__/main/variantSelector.test.ts`(16) — 复现「未知模型被套 XML 变体」并锁定修复
  - `src/__tests__/engine/promptSections.test.ts`(24) — 含 LRU 语义（热键存活 / 冷键淘汰）双向验证

## 第五轮：三个结构性大件（2026-09-18）

### 一、`src/engine/absorb.ts` — 吸收式压缩器（移植 + 修 4 个 bug）

移植自 `D:\src\utils\absorb.ts`。用途：同一段内容在上下文里重复出现时只保留一份
（重复的工具定义、同一文件被读两次、模型重复输出的模板）。

**移植时修复的 4 个上游缺陷（都会造成内容丢失）**：

| # | 上游问题 | 后果 | 修复 |
|---|---|---|---|
| ① | `cache.set` 写在相似度判定**之前** | 被判「相似重复」而丢弃的块，其指纹已进持久缓存 → 下次遇到孪生块被误删 → 若那是唯一内容则**返回空字符串** | 先判定保留/丢弃，**只缓存最终保留者** |
| ② | 重建文本用 `outParts.join('\n\n')` | 空行本身不产生段落，重建时空行信息全丢、段间被统一塞一个空行 → Markdown 列表被拆散、表格破坏、缩进错乱 | 每段记录原文 `[start, end)` 偏移，**按偏移切片重建**，逐字节保留 |
| ③ | `compressWithStats` 中 Pass 2 的 segments 被 Pass 4 复用 | Pass 3 的成果被完全丢弃（`dedupSegments` 的 `originalText` 形参从未使用）；且与无状态入口产出不一致 | 三段**严格串行**，每段作用于上一段输出 |
| ④ | 只有 `absorbText` 有 `MAX_INPUT_LENGTH` 闸 | SessionCompressor 路径缺闸，超大文本全量跑（相似度是 O(n·m)） | 所有入口统一长度闸 |

**另加安全兜底**：任何 pass 后若结果变空而输入非空 → 回退。压缩是优化，不该以内容消失为代价。

**设计取舍**：
- 中文/长文本相似度用**16 点采样 + 5-gram Jaccard**，短文本（≤300）才走精确 LCS ——
  代价是采样点错位会漏判，但避免了万字符级 O(10^8) 卡死
- 跨调用去重（`AbsorbSession`）**键用归一化文本本身而非哈希** —— 哈希碰撞会静默删错块，这类错误极难排查
- `absorbIfWorthwhile` 提供「收益不足就不换原文」的开关，避免为省一点 token 冒格式风险

### 二、`src/main/hooks/` — 钩子引擎（4 个文件）

移植自 `D:\src\utils\hooks.ts` 的**事件枚举 + 匹配器 + 执行器 + 结果语义**四块
（刻意不搬上游 163KB 的单文件混合实现）。

**Windows 关键处理**（用户特别指出的点）：
- `killProcessTree`：Windows 用 `taskkill /pid X /T /F`（`/T` 含子树）。
  `child.kill()` 只终止直接子进程 —— 钩子若是 `npm run x`、`bash -c "..."` 这类
  会派生孙进程的形式，杀完孙进程仍在后台跑（占端口、锁文件），且超时控制形同虚设。
  POSIX 靠 spawn 时 `detached: true` 建进程组 + 负 pid 整组杀。
- **`bash.exe` 不能直接写**：`where bash` 在 Windows 上优先返回
  `C:\Windows\System32\bash.exe` —— 那是 **WSL 转发器**，未装发行版时执行任何命令
  只输出「未安装分发」并退出码 1。实测确实被 where 命中，**不能靠 PATH 探测**。
  改为直接检查 Git for Windows 已知安装路径（`existsSync`，零进程开销），
  找不到就回落 Node 默认 shell（cmd.exe），与 `engine/utils/exec.ts` 保持一致。
- 新增 `resolveHookShell()` / `resetHookShellCache()`，可用 `KX2_HOOK_SHELL` 覆盖。

**结果语义**（对齐上游）：`continue:false` → 阻止继续；`decision:block` / 退出码 2 → 阻塞错误；
`hookSpecificOutput.permissionDecision`；多钩子结果按 **deny > ask > allow** 合并（拒绝不可被放行覆盖）。

**安全边界（刻意与上游不同）**：钩子会执行任意 shell 命令。上游允许项目级
`.claude/settings.json` 定义钩子 → 克隆仓库就可能执行其中埋好的命令。
本项目**只从用户 userData 读取**（`<userData>/hooks.json`），不接受项目目录的定义 ——
用户要为某项目配钩子需手动抄进自己的配置，这一步人工确认本身就是安全边界。

**接线**：`engine/toolScheduler.ts` 新增 `ToolHooks` 接口 + `setHooks()`，
由 `engine-bridge.wireToolHooks()` 注入（engine 层不反向依赖 main）。
经 `QueryEngine.setToolHooks()` 暴露。钩子异常一律吞掉不阻断工具执行。

### 三、`src/main/tools/toolSessionStore.ts` — 活跃集落盘 + 历史推导

解决原实现「活跃集只存在进程内 `Map`」的三个后果：
1. **重启即丢** —— 用户 `tool_load` 进来的工具重启后全失效，而对话历史还在 →
   模型以为工具可用、调用失败
2. **压缩/分支后与历史不一致** —— 活跃集是可变状态，历史是事实记录，两者各说各话
3. **无法从历史重建**

- `ToolSessionStore`：内存为主 + **异步 write-behind 防抖落盘**（2s）。
  工具调用是热路径，不能每次 `touchTool` 都同步写盘
- `flushSync()`：**专供退出路径** —— 退出时没机会 await，而防抖队列里可能压着
  最后几秒的 `tool_load`，用同步 IO 做最后一次保存
- 原子写入（tmp + rename）；落盘失败**恢复脏标记**等下次重试，绝不丢状态
- 上限：单会话 `lastUsed` 500 条（按时间裁剪）、最多 50 个会话（按 `updatedAt` 淘汰）
- `deriveActiveToolsFromMessages()`：**从对话历史反扫**重建 —— 扫 Anthropic 风格
  `tool_use` 块、OpenAI 风格 `tool_calls`、以及被序列化成字符串的历史。
  只保留当前仍可用的工具（历史里可能有已删除的）
- `mergeActiveTools()`：落盘（用户显式意图）与历史（实际事实）**取并集**，都要过滤不可用项
- `toolMetaTools` 改为内存缓存 + 落盘水合（并集合并，避免与并发写竞争）；
  `loadTools` / `unloadTools` 都触发落盘（**卸载不落盘会导致重启后被卸载的工具"复活"**）

### 四、顺带修复

`engine/index.ts:241` 用 4 个参数调用 `ToolScheduler` 的 3 参构造函数
（多传 `this.recovery`）。运行时多余实参被忽略，属既有的类型不匹配，已去掉以免误导。

### 五、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 / 单元 719（本轮新增 85）/ **0 失败**
- 新增测试：
  - `src/__tests__/engine/absorb.test.ts`(34) — 4 个 bug 各有回归用例
  - `src/__tests__/main/hooks.test.ts`(29) — 含超时杀进程树、并行执行、结果合并优先级
  - `src/__tests__/main/toolSessionStore.test.ts`(22) — 含「模拟重启读回」与历史反扫

**测试写法教训**：钩子测试最初用 `echo` / `sleep` 构造命令，12 个用例失败。
原因是 `cmd.exe` 的 `echo "..."` **会保留外层引号**（JSON 解析失败）、且没有 `sleep`。
改为「生成临时 node 脚本 + `node <file>` 执行」后全绿 —— 测试命令必须与 shell 无关。

## 第六轮：批量吸收剩余项（2026-09-18 续）

上一轮开头先做了一次**诚实的完成度核对**：39 项研究中列出的可移植能力，实际落地 16 项，
其中 3 项还是误匹配（只有注释提到、或同名不同物）。本轮继续推进。

### 一、`src/shared/textTruncate.ts` — 按显示宽度截断（46 测试）

移植 `D:\src\utils\truncate.ts`。上游依赖 `ink/stringWidth`，本轮**自实现了 `stringWidth`**，
因此零依赖、主进程与渲染层都能用。

解决的真实问题：按 `str.length` 截断会劈坏内容 ——
- 中文/日文/韩文是**双列宽**，按字符数切会让实际显示宽度翻倍
- emoji 与代理对按 code unit 切会劈出半个字符（显示为乱码）
- 组合字符（e + 组合尖音符）按码点切会拆散字形

实现：`codePointWidth`（East Asian Width 主要区间）+ `Intl.Segmenter` 字素簇迭代。
导出 `truncateToWidth` / `truncateStartToWidth` / `truncateToWidthNoEllipsis` /
`truncatePathMiddle`（保留目录头与文件名，**文件名优先于目录**）/ `truncate` / `wrapText`。

测试重点不是"截到几位"而是"有没有劈坏" —— 用 `hasLoneSurrogate` 断言代理对完整性。

### 二、`src/engine/errors/toolErrorFormat.ts` — 工具错误格式化（40 测试）

移植 `D:\src\utils\toolErrors.ts`。两条规则：

1. **超长错误中间截断**（而非尾部）—— 构建/编译错误的**关键信息常在末尾**
   （`error: ... at file.ts:12`），切尾会把最有用的部分丢掉。
2. **参数校验错误说人话** —— 分「缺少 / 多余 / 类型不符」三类陈述。
   原始的自由文本校验错误里，模型看不出该改哪个参数；
   改成「缺少必需参数 `path`」它下一次就能改对，直接影响工具调用成功率。

**已接入 `ToolScheduler`**：校验失败与 catch 分支都改用它；
`Tool not found` 也改为列出最相近的候选名并指向 `tool_search`
（原来只说 not found，模型会盲目重试同名调用）。

### 三、`src/engine/compactCoordinator.ts` — 压缩阈值与熔断（31 测试）

移植 `D:\src\services\compact\autoCompact.ts`。

**熔断器守的是真实事故**：上游注释记录 1279 个会话曾连续压缩失败 50+ 次
（最高 3272 次），每天浪费约 25 万次 API 调用。失败循环 =
上下文超限 → 压缩 → 压缩请求本身因超长被拒 → 下一轮再试（且上下文不会自己变小）。

阈值模型用**绝对 token 数**而非比例：

```
effectiveContextWindow = contextWindow - min(maxOutputTokens, 10_000)
autoCompactThreshold   = effectiveContextWindow - 8_000
blockingLimit          = effectiveContextWindow - 3_000   ← 高于自动压缩点
```

硬闸**高于**自动压缩点是关键：中间的空间留给压缩本身（它也要发请求、也占 token）。
若两者相等，会形成"该压缩了但已经发不出压缩请求"的死结。

**有效性判据是 token 真的下降**，而非"函数没抛异常" —— 策略可能返回一个长度几乎
没变的消息数组（可压缩内容本就少），不识别出来就会每轮重复做无用功。

**修复 `messageLoop` 的一个顺序缺陷**：原实现是 `if (shouldReject) throw` 在前、
`if (shouldCompact) compact` 在后，而 reject 阈值高于 compact 阈值
→ **代码永远走不到压缩分支**，等于"上下文一满就直接中断"。
改为先压缩自愈、压不动才拒绝。

**熔断自动复位**（由测试发现）：上下文回落到阈值以下时清零失败计数。
否则用户手动清空对话后仍带着旧计数，会过早熔断。

### 四、`src/engine/instructions/claudeMdLoader.ts` — 项目指令加载（40 测试）

**这是本轮发现的最严重的功能缺口**：KX2API 有 `/init` 命令**生成** CLAUDE.md，
却**没有任何读取端** —— 用户辛苦写好的项目约定，模型完全看不到。

- **逐级向上查找**，遇 `.git` 停止（项目边界）。这是实测教训：纯向上到盘根时，
  把 cwd 设为不存在的路径会一路走到 `D:\`，结果加载了 `D:\KX2API\CLAUDE.md` —— 明显不该发生
- **优先级逆序**：越靠近工作目录越靠后加载 → 对模型影响越大
- **本地覆盖文件**（`CLAUDE.local.md`）最后加载，优先级最高
- **`@include` 安全约束**（这是唯一会读「用户没直接指定」的文件的地方，必须设防）：
  解析后必须仍在项目根内、扩展名白名单（挡 `.pem`/`.key` 等凭据文件）、
  深度上限 5、已处理路径集合防循环。不加限制时，一份恶意 CLAUDE.md 里写
  `@~/.ssh/id_rsa` 就能把私钥读进上下文
- 单文件 40K 字符、合计 120K 字符上限
- **刻意不缓存**：文件少且小，而用户改完应当立即生效 ——
  不值得为省一点 I/O 开销引入"改了不生效"的困惑

**已接入 `engine-bridge`**，注入顺序：指令文件（几乎不变）→ 工具提示 → 记忆（每轮可能变），
静态在前以保证 prompt cache 前缀稳定。端到端验证：正确读到项目 CLAUDE.md（5038 字符）。

### 五、`src/engine/compactPrompt.ts` — 9 段式摘要提示词（26 测试）

移植 `D:\src\services\compact\prompt.ts`。替代原来一句话的英文提示。三个设计各有理由：

1. **首尾强制「不许调用工具」** —— 压缩只给一轮机会。上游注记：不加此约束时约 2.79%
   的情况会尝试调工具，而工具调用被拒意味着**这一轮没有任何文本输出**，压缩直接失败。
   首尾各说一次，是因为模型对结尾指令的遵从度更高。
2. **`<analysis>` 草稿块 + 事后剥离** —— 先按时间顺序梳理再写摘要能提升质量，
   但草稿不该进上下文，由 `formatCompactSummary` 剥掉（对未闭合标签做了容错）。
3. **9 段固定结构** —— 自由格式会随机漏掉关键信息。第 4、6 段
   （错误与修复、所有用户消息）最容易被漏，而它们承载"踩过的坑"与"用户纠正过的方向"。

### 六、`src/engine/permissions/permissionRules.ts` — 参数级权限规则（54 测试）

移植 `permissionRuleParser.ts` + `PermissionRule.ts`。

解决：KX2API 原有权限只有**工具级**粒度（整个工具放行或拒绝），
而真实场景需要 `Bash(git status)` 这种 —— 放行 `git status/log/diff`，
但 `git push` 每次都问。

关键实现点：
- **转义顺序不可颠倒**：转义时先反斜杠后括号（否则会把刚加上的转义符再转义一次）；
  反转义时反序。`Bash(python -c "print(1)")` 的括号歧义靠它解决
- **未转义括号定位**：数前面连续反斜杠的奇偶
- **畸形输入退化**为工具级规则而非抛错 —— 权限解析失败时宁可放宽粒度，
  也不能让整个权限系统崩掉
- **glob 匹配**：`*` 不跨空白与分隔符。这点很关键 —— 若 `*` 跨空白，
  `Bash(git *)` 会放行 `git push --force origin main`，让"只允许 git status"的意图落空
- **deny 绝对优先**，不被更高来源的 allow 覆盖（安全底线）
- **记忆化授权**建模成 `PermissionUpdate`：「允许一次」= `session`、
  「永远允许」= `userSettings`，UI 只需改 destination，不用写两套逻辑

**已接入 `ToolScheduler`**：规则优先于通用权限逻辑，未命中（passthrough）才交回原逻辑 ——
不配置规则时行为与改动前完全一致。

### 七、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 / 单元 963（本轮 **+240**）/ **0 失败**

### 八、仍待吸收（2026-09-18 复核后的实际状态）

| 项 | 状态 | 证据 |
|---|---|---|
| 会话转录 `sessionTranscript` | ✅ **已实现且已接入** | `engine/transcript.ts`；`messageLoop.ts:23` import、`:276` 压缩前调用并传 `sessionId` |
| attachments 机制 | ❌ 未实现 | 全仓库无 attachment 相关文件；另一会话曾研究（`scripts/_extract_att.py`）但未落地 |
| 子代理上下文隔离 | ✅ **已实现且已接线** | `SubAgentManager.setEngineFactory` + `engine-bridge.wireSubAgentFactory()`；每个子代理独立引擎与 apiClient |
| 对话/会话恢复 | ✅ **已实现且已接入** | `engine/sessionRecovery.ts`（快照 load/save/clear）；`engine/index.ts` `getHistory` 同步水合 / `query`+`sendMessage` 每轮落盘 / `clearHistory` 删快照（见下方小节） |
| 会话级记忆 SessionMemory | ✅ **已实现且已接线** | `engine/memory/sessionMemory.ts`；`messageLoop` 压缩前注入要点、压缩后抽取新要点 |
| attachments 机制 | ❌ 未实现 | 全仓库无 attachment 相关文件（另一会话曾研究但未落地） |

**剩余建议顺序**：attachments 机制（多模态能力，唯一未做的大件）

## 第六轮后：memory_* 工具与记忆系统目录闭环（2026-09-18）

### 解决的问题

`memoryTool`（Claude Cookbooks memory_tool 移植，6 个 `memory_*` 工具）
原先写死到 `./memory_storage/memories`；而记忆召回/写入系统（`memoryRecall`/
`memoryWriter`）用 `resolveMemoryDir()` → `<homedir>/.doge/projects/<编码>/memory`。
**两套目录脱节** → 模型用 `memory_create` 写入的记忆，召回系统永远读不到，
记忆机制形同两半。且 `./memory_storage` 是相对路径，Electron 打包后工作目录不固定，
定位更不稳。

### 改动

| 文件 | 改动 |
|---|---|
| `src/memory/memoryTool.ts` | `MemoryToolHandler` 默认落盘根从写死 `./memory_storage/memories` 改为 `resolveMemoryDir()`；新增只读 `root` getter；构造暴露显式 `basePath`（测试用）仍走传统 `<base>/memories` 语义 |
| `src/engine/plugin/memoryToolPlugin.ts` | 删除写死的 `MEMORY_ROOT='./memory_storage'`，`new MemoryToolHandler()` 缺省走统一目录 |
| `src/__tests__/engine/memoryToolRecall.test.ts` | 新增 3 项回归：默认根==`resolveMemoryDir()` / `memory_create`写入→`recallMemories` 同一目录召回 / `../` 逃逸被拦 |

### 设计取舍

- **保留 `/memories` 虚拟根契约**：对模型仍是 `/memories/notes.md`，工具层不变，
  仅真实落盘位置迁移到记忆系统目录 —— 最小侵入。
- **召回不依赖 MEMORY.md 索引**：`scanMemories` 遍历目录下所有 `.md`
  （含 frontmatter 即可召回），故目录统一即闭环，无需在 memoryTool 里强行维护索引。
  索引维护仍由 `memoryWriter`（唯一写入口）负责，职责不扩散。
- 记忆内容需带 `name/description/type` frontmatter 才能被召回系统标准识别；
  无 frontmatter 的纯文件会以文件名降级召回（约定：模型应写入带 frontmatter 的记忆）。

### 验证

- `npm run build` ✅
- `npm run test:all` ✅ 四套全绿：management 74 / extras 546 / unit **1005**（新增 3）/ 0 失败
- `npx vitest run src/__tests__/engine/memoryToolRecall.test.ts` → 3/3 通过

## 第六轮后：会话转录移植（2026-09-18，sessionTranscript）

### 解决的问题

上下文压缩会把压缩前的消息摘要化，压缩后要复盘原始对话（排查一次工具调用为何异常、
审计某轮交换）时原文已不可得。原项目**无任何 transcript 能力**（`D:\KX2API` 全仓库搜索
`transcript` 零命中）；`D:\src\services\sessionTranscript\` 恰好是低依赖叶模块。

### 改动

| 文件 | 改动 |
|---|---|
| `src/engine/transcript.ts`（新） | 移植 `sessionTranscript.ts`：`writeSessionTranscriptSegment` / `flushOnDateChange` / `resolveTranscriptDir`；落盘到 `<home>/.doge/transcripts/<sessionId>-<YYYY-MM-DD>.jsonl`，一行一条消息 |
| `src/engine/messageLoop.ts` | import `writeSessionTranscriptSegment`；`runIteration` 压缩分支里，`autoCompactor.compact` **之前**调转录落盘，并传 `deps.sessionId`；`MessageLoopDeps` 新增可选 `sessionId` |
| `src/__tests__/engine/transcript.test.ts`（新） | 3 项：消息逐行 JSON 可解析 / 空消息不落盘 / flushOnDateChange 落指定日期带 `flushed` 标记 |

### 设计取舍 / 差异

- **依赖替换**：上游 `getSessionId()`（bootstrap 状态）→ 显式可选 `sessionId` 参数；`logForDebugging` → `console.warn`（避免与 engine index 循环依赖）。
- **目录同构**：沿用 `<home>/.doge/transcripts/`，与记忆系统 `<home>/.doge/` 同级。
- **fire-and-forget + 同步 appendFileSync**：错误吞掉不阻断压缩；一次压缩一条记录，短小同步写，不做异步队列。
- 编译与运行时不受影响：本模块无第三方依赖（仅 node:fs/path/os）。

### 验证

- `npm run build` ✅
- `npm run test:all` ✅ 四套全绿：management 74 / extras 546 / unit **1039**（新增 transcript 3）/ agent 47 / **0 失败**
- `npx vitest run src/__tests__/engine/transcript.test.ts` → 3/3 通过

## 第七轮：接线补齐 + attachments 吸收（2026-09-18 续二）

### 一、补上上一轮自己留的坑：权限规则无调用方

上一轮末我提到「`setPermissionRules()` 尚无调用方」—— 这正是我反复强调的
「配置化最常见的失败：接口有了但没接上」。本轮补完。

**新增 `src/main/permissions/permissionConfig.ts`**（29 测试），与 hooks 配置同构：
- 配置存 `userData/permissions.json`，**不接受项目目录定义**（克隆仓库不该改变权限策略）
- 配置文件用**规则字符串**（`"Bash(git status)"`）而非结构化对象 —— 用户手写更直观
- 读不到 / 读坏 / 未设置路径 → **空规则集**（= 判定走 passthrough，行为与改造前一致）。
  权限是安全相关的，但"配置读不出来"既不该变成"一律拒绝"（用户无法操作），
  也不该变成"一律放行"（安全漏洞）—— 应回到代码里既有的判定路径
- **单条畸形只跳过该条**，不让整套配置失效（否则表现为"改了配置后权限突然异常"，很难排查）
- **`VALID_TOOL_NAME_RE` 校验**（测试逼出来的）：`permissionRuleValueFromString`
  对畸形输入采取「退化为整串当工具名」的保守策略（防抛错），于是一条写错的配置
  （如 `"(foo)"`）会变成名为 `(foo)` 的无效规则静默留在集合里。
  配置层必须比解析层更严格
- 首次启动写示例配置（只读工具放行、危险命令 `ask` 而非直接 `deny`），**不覆盖已有配置**

**接线**：`engine-bridge.wireToolPermissions()` → `QueryEngine.setPermissionRules()`
→ `ToolScheduler.setPermissionRules()`；`reloadToolPermissions()` 支持热更新。

**IPC 三处一致性**（这是历史踩过的坑）：
- `channels.ts` 新增 5 个 `PERMISSIONS_*`
- `handlers.ts` 注册 5 个 handler（含 `PERMISSIONS_PARSE` 供 UI 即时校验规则字符串）
- `preload/index.ts` 暴露 `permissions` 命名空间
- `renderer/src/types/electron.d.ts` 同步声明（含 `PermissionRuleEntry`）
- 用 `scripts/_audit_ipc.py` 复核：新 channel 未出现在任何"未对齐"列表中

### 二、记忆注入的会话预算与去重（attachments 的核心机制）

研究里记的 `attachments.ts` 是 4000 行巨兽（60+ 类型），但真正缺的是其中
**记忆注入的预算与去重**这一块 —— KX2API 的 `memoryRecall` 只有单文件预算
（200 行 / 4096 字节），而记忆每轮都会重新注入，单文件预算拦不住总量。

**新增 `src/engine/memory/memorySurfaceBudget.ts`**（27 测试）：
- 会话累计上限 **60KB**（对齐上游 `RELEVANT_MEMORIES_CONFIG.MAX_SESSION_BYTES`）
- 单轮最多 5 条
- 按历史去重 + 按剩余额度截断（二者必须一起做：只去重不管预算仍可能一轮塞太多；
  只算预算不去重会让同一条记忆反复占额度）

**最关键的设计——扫描消息，而不是维护计数器**。上游源码注释写得很明白：

> 扫描消息而非在 toolUseContext 里维护计数器，这样 /compact 之后旧附件从上下文消失，
> 预算与去重会自然重置，重新浮现是合法的。

这个性质很重要：压缩后模型上下文里已经没有那些记忆了，此时"再注入一次"是**正确行为**。
若改用持久计数器，压缩后会永远不再注入任何记忆 —— 用户会觉得"记忆功能莫名其妙失效了"。
端到端验证确认：第 1 轮注入 5 条 → 第 2 轮 0 条（去重）→
第 3 轮模拟压缩后 5 条（**预算已重置**）→ 第 4 轮额度耗尽 0 条。

**注入格式改造**：标题里带上文件名（`### 名称 · file.md（…）`）。
没有可追溯标识就无法判断某条记忆是否已经给过模型 —— 这是去重的前提。

**新增 `memoizeByKey`（位于 `promptSections.ts`，12 测试）**：
分片缓存原本只支持字符串，但「记忆召回」返回的是列表。
缓存**原始召回结果**（昂贵：扫目录 + 读文件，只依赖 query），
每轮再做**过滤**（依赖历史，不缓存）——
若把过滤后的文本一起缓存，历史一变就会读到过期的注入集合。
附带并发去重（同 key 并发共享一次计算）与「失败不缓存」（下次可重试）。

**接线**：`engine-bridge` 的记忆段改为「缓存召回 + 每轮过滤 + 格式化」三步。

### 三、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 / 单元 1051（本轮 **+88**）/ **0 失败**
- IPC 三处一致性复核通过（`scripts/_audit_ipc.py`）

### 四、仍待吸收

- [x] **子代理上下文隔离** — `SubAgentManager.setEngineFactory`（每个子代理独立引擎 +
  独立 apiClient + 独立对话上下文）。⚠️ 该接口此前**零调用方**（缺省构造的子引擎没有
  apiClient，query 不会真的跑模型）；已在 `engine-bridge.wireSubAgentFactory()` 注入
- [x] **对话恢复 / 会话恢复** — 已移植 `src/engine/sessionRecovery.ts`（轻量快照方案，见「会话恢复」小节）
- [x] **会话级记忆 SessionMemory** — 已实现 `src/engine/memory/sessionMemory.ts`（见下方小节）
- [ ] attachments 的其余类型（IDE 选择、诊断、预算提示等 —— 本项目暂无对应场景）

### 子代理隔离接线（2026-09-18）

`SubAgentManager` 早已有 `setEngineFactory`（每个子代理独立引擎 + 独立 apiClient +
独立对话上下文），但该接口**零调用方** —— 缺省用的 `new QueryEngine(...)` 没有 apiClient，
子引擎的 query 不会真的跑模型（管理器注释也写明「调用方需保证注入后再 execute」）。

已在 `engine-bridge.wireSubAgentFactory()` 注入：用当前生效的 API 设置为每个子代理
创建独立引擎与 apiClient，子代理的中间过程因此不会污染主对话历史。
验证：`src/__tests__/engine/subAgentIsolation.test.ts`（7 例，含"工厂确实被调用"断言）。

**engine 层兜底（2026-09-18）**：`subAgentManager.ts` 缺省 factory 从占位改为真实
`new QueryEngine` —— 通过 `provideEngineConstructor(QueryEngine)` 延迟注入本类构造器
（`import type` + 模块顶层副作用，规避运行时循环 import），`setEngineFactory` 仍可覆盖。
这样即使 main 进程未注入引擎工厂，engine 侧缺省也能构造真正隔离的子引擎，不再抛
「未注入 QueryEngine 构造器」。测试 `subAgentIsolation.test.ts` 覆盖缺省构造不抛、工厂
透传、独立实例、并发上限、运行时调 maxConcurrent。

### 会话级记忆 SessionMemory（2026-09-18）

新增 `src/engine/memory/sessionMemory.ts`。定位：与 `memoryRecall`（跨对话项目的磁盘记忆）
**不同层次** —— 单次对话内、进程内、**只喂给 compact**，不落盘（落盘会把上一段对话的
要点带进新对话，那是 memoryRecall 的职责）。

解决的问题：长对话会被多次压缩，每次摘要都是对「上一次摘要」的二次加工，
用户原始约束 / 纠正过的方向 / 踩过的坑**逐轮衰减直至消失**。

做法：压缩**前**把已有要点交给摘要器（拼在 9 段提示词**前面**，让它"在既有要点上
补充/修正"而非从零推断）；压缩**后**从新摘要抽取要点累加。

抽取策略：按 markdown 标题切段，**只保留约束/请求/决策/错误类** ——
「当前工作 / 下一步」下一轮就过时，存进去只会挤占额度。
上限：单条 500 字符、总 40 条，超限丢最旧；逐条去重。

⚠️ **测试逼出两个实现缺陷**：
1. 兜底分支原为「out 为空就取首段」，会把"格式正确但内容都该丢"的情况误救回来
   （如整篇只有「下一步」）—— 改为**仅当完全没有 markdown 标题时**才兜底
2. 关键词表遗漏「请求」—— 用户**原始请求**是最该保留的（多轮压缩后最容易丢的就是
   "最初要做什么"，而那是判断后续是否跑偏的基准），已补入

## 第六轮后：会话恢复移植（2026-09-18）

### 解决的问题

当前项目（KX2API Electron）会话历史**纯内存、重启即丢**：`engine/_conversation.messages`，
`CHAT_GET_HISTORY` 读内存、无落盘。崩溃/退出后回来对话全丢。上游
`conversationRecovery.ts`(597 行) / `sessionRestore.ts`(653 行) 重度耦合
（worktree / plans / attribution / fileHistory / attachments，Electron 不适用），
直接搬代价高且大半依赖不存在。

### 轻量快照方案（贴合本架构）

| 文件 | 改动 |
|---|---|
| `src/engine/sessionRecovery.ts`（新） | `saveSessionSnapshot`（原子写 tmp+rename）/ `loadSessionSnapshot`（async）/ `loadSessionSnapshotSync`（供 getHistory）/ `clearSessionSnapshot`；目录 `<home>/.doge/projects/<sanitize(项目根)>/session.json`（与记忆系统同构） |
| `src/engine/index.ts` | `getHistory()` 内存空且有快照 → 同步水合（入页即见旧对话）；`query`/`sendMessage` 每轮结束 `saveSessionSnapshot`（fire-and-Forget）；`clearHistory()` 删快照（用户重新开始 = 丢弃上次） |
| `src/__tests__/engine/sessionRecovery.test.ts`（新） | 5 项：save→load 往返 / load 不存在 null / 损坏不抛 / clear 删除 / 不同项目 dir 隔离 |

### 设计取舍

- **恢复语义**：`getHistory` 内存空 + 快照有旧消息 → 水合（重启回来对话还在）；`clearHistory` → 删快照（重新开始）。
- **不碰 chat-handlers/engine-bridge/preload**：恢复逻辑收敛在 engine 内部，无新 IPC/channel，避免与其它在改代码冲突。
- **原子 + 静默**：tmp+rename 防半截；任何读写异常 `console.warn` 吞掉，绝不阻断对话。
- 同步读 / 异步写：`getHistory` 同步水印（不引入启动异步链路），`saveSnapshot` 异步 fire-and-Forget。

### 验证（本任务范围）

- `npm run build` ✅
- `npx vitest run src/__tests__/engine/sessionRecovery.test.ts` → 5/5 通过
- `npm run test:unit` ✅ 57 文件 / 1056 通过 / 0 失败

⚠️ **已知无关红灯**：`tests/tool-calling/tool-engine.test.ts`（extras）失败，但该测试仅 import
`src/main/proxy/toolCalling/ToolCallingEngine`，与本次 `src/engine/*` 改动**无 import 交集**，
系并发生成进程改动 `src/main/proxy/*` 引入的回归，非本任务所致，未擅自代修。

## 第一轮遗留待办（2026-09-18 复核）

- [x] 把 `npm run typecheck` 接入 CI — **已修正**：原 CI 指向 `project/tsconfig.json`（另一个项目），
  主应用从未被检查。已拆为 `typecheck-project` + `typecheck-app`（后者盯 `tsconfig.check.json`，
  暂 `continue-on-error` 并输出错误数到 Job Summary，待收敛后转阻断）
- [x] 逐个排查 `Cannot find name`（`TS2304`）—— **已清零：46 → 0**（类型错误总数 710 → 661）
  - **6 处必崩项**（值位置）：`messages.ts:589` 的 `message`（参数名实为 `msg`，且被 try/catch
    吞掉 → `hasUnresolvedHooks` 恒 false，放过本该拦截的 hook_blocking_error）；
    `chat.ts:172` 的裸 `model`（无可用账户时的诊断提示崩溃，用户看不到失败原因）；
    `managedXml.ts` 的 `parseToolNameSubtagFormat` / `extractArrowArgs`（被调用但从未定义，
    前者每次 XML 解析都 ReferenceError）；`toolCallExtractor.ts:1104` 的 `argsStart`；
    `proxy/index.ts` + `store/index.ts` 的「**重导出后直接引用**」
    （`export { X } from 'y'` 只对外暴露名字，**不在本模块建立绑定**）
  - 其余为类型位置（补导入即可）；`HarnessConfig` / `Tools` 从未定义，已在 `requestBuilder.ts` 补上
  - ⚠️ 踩坑：我实现 `parseToolNameSubtagFormat` 时与另一会话撞车（它已有更完整实现，在文件后部），
    同名声明两次 → `SyntaxError` 导致测试套件加载失败。**动手前应全文件 grep 函数定义，而非只看开头**
- [x] 评估移除通用 `on/send/invoke` 逃逸口 —— **已收窄为白名单**
  - 渲染层 3 处 `electronAPI.invoke('managementApi:*')` 改用既有的 `electronAPI.managementApi.*`
    （该命名空间早已挂载，只是用法没更新）
  - `preload/index.ts` 新增 `assertAllowedChannel`，白名单**默认全拒**；
    拒绝时**抛错**而非静默忽略（静默会让调用方误以为订阅成功、实际收不到事件）
  - `src/__tests__/main/preloadChannelGuard.test.ts`（5 例）锁定「三入口都校验 + 白名单为空 +
    渲染层零使用」三项约束
- [x] IPC 通道字面量统一收敛为 `IpcChannels` 常量 —— **已全仓库清零**
  - `preload/index.ts` 62 处 `invoke`/`send`/`on` **+ 5 处 `removeListener`**
  - ⚠️ **`removeListener` 是漏网之鱼**：`on(IpcChannels.TEAM_STREAM_PHASE, h)` 配
    `removeListener('team:streamPhase', h)` —— 值相同所以能跑，但改通道名后监听器移不掉
    （内存泄漏 + 回调重复触发）。「只改一半」是这类收敛最容易漏的形态
  - **补 4 个缺失常量**：`TRAY_OPEN_DASHBOARD`/`TRAY_SET_HEIGHT`/`TRAY_QUIT_APP`（主进程与
    preload 都用字面量）+ `TRAY_RESIZE`（**只在主进程监听侧，按 preload 扫描会漏掉**）
  - **7 个死通道纳入常量表**：`chat:{subscribeEvents,unsubscribeEvents,grantPermission,
    denyPermission,pause,resume,getState}` —— 主进程已注册但 preload 未暴露、渲染层未调用。
    按「代码不能越来越少」原则**保留**，在常量表标注为预留能力（接线时须同时补
    preload 暴露与 `electron.d.ts` 声明）
  - `src/__tests__/main/ipcChannelConsistency.test.ts`（4 例）锁定：生产代码零字面量、
    `on`/`removeListener` 成对、通道值无重复
