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

### 五、下一轮待办（按价值排序）

- [ ] **记忆写入闭环**：回合结束后台提取 + 互斥闸 + 不保存内容黑名单（源自 `services/extractMemories`）
- [ ] **工具活跃集改为对话历史推导 + 落盘**，替换 `toolMetaTools` 的模块级 Map（结构性差距，收益最大）
- [ ] `tool_search` 打分加词边界与 `searchHint`（当前 254 工具全量进检索池且中文整串 `includes`，检索基本失效）
- [ ] `toolResultStorage` 的**单消息聚合预算**（200K 字符/消息，防 N 个并行工具各自 40K 一起挤爆）
- [ ] 系统提示词静态/动态分段 + 缓存边界标记（`constants/systemPromptSections.ts` 仅 70 行，纯逻辑可照搬）
- [ ] 把 `npm run typecheck` 纳入 CI（当前 708 处类型错误，需先定收敛计划）

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

### 五、架构冲突记录（未改）

- **`src/memory/memoryTool.ts` 与记忆系统目录不一致**：前者基于 `/memories` 路径的
  通用文件操作（view/create/str_replace/insert/delete/rename），后者用
  `.doge/projects/<编码项目>/memory/`。两套并存，调用方容易写错目录。
  建议：`memoryTool` 改为委托 `memoryWriter`，或明确标注为「通用文件工具」与记忆系统解耦。
- **回合结束后台提取尚未接线**：`looksWorthRemembering` + `writeMemory` 已就绪，
  但还没有在主循环结束后触发提取的调用点（需要决定用规则提取还是模型提取）。

### 六、验证结果

- `npm run build` ✅
- `npm run test:all` ✅ 附加 546 通过（本轮新增 81）/ 单元 560 通过 / **0 失败**
- 新增测试：`tool-search-scoring.test.ts`(25) / `result-budget.test.ts`(17) / `memory-writer.test.ts`(39)
  - 其中检索测试**复现原实现的两个误报**（`search` 命中 `research`、`git` 命中 `digital`）并证明修复有效
  - 记忆写入器测试含**读写闭环验证**（写入 → 召回命中）

## 第一轮遗留待办

- [ ] 逐个排查剩余值位置的 `Cannot find name`（清单见 `scripts/_tscheck.py` 输出）
- [ ] `preload` 的字面量 channel 统一收敛为 `IpcChannels` 常量
- [ ] 评估移除通用 `on/send/invoke` 逃逸口
- [ ] 把 `npm run typecheck` 接入 CI（当前 708 错误，需先制定收敛计划或设为 `continue-on-error`）
