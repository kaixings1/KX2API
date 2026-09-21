# 工具暴露机制规格（按需加载 / 分层暴露）

> 本文原为仓库根目录的 `dev.txt`。因根目录不宜存放文档，且该文件记录了
> 完整的工具暴露设计（16 章），故移入 `docs/` 归位。
>
> **性质：这是设计规格，不是待办需求清单。** 项目当前的实现状态见
> `TASK.md`，两者的差异对照见记忆 `devtxt-tool-exposure-spec.md`：
> 代码已实现但默认关闭（环境变量 `KX2_TOOL_CONTEXT=layered` 才启用分层模式）。

---

这个思路严格化后，不是“把工具写进文件然后分组”这么简单，而是要做一套**工具注册、发现、暴露、加载、执行、卸载、权限、审计**的运行时机制。核心目标是：在保证任务成功率的前提下，最小化每轮上下文中的工具定义 token，并降低无关工具对模型选择的干扰。

下面给一套可落地的实施方案。

---

## 1. 问题形式化

设工具总数为 \(N\)，每个工具的 schema 在上下文中的 token 成本为 \(c(t)\)。全量暴露成本：

\[
C_{full} = \sum_{t \in T} c(t)
\]

按需暴露成本：

\[
C_{dyn} = C_{core} + C_{catalog} + \sum_{a \in A} c(a) + L \cdot c_{load} + R \cdot c_{round}
\]

其中：

- \(A\)：当前活跃工具集，\(|A| \ll N\)
- \(C_{core}\)：核心元工具常驻成本
- \(C_{catalog}\)：工具组目录常驻成本
- \(L\)：加载工具额外轮次
- \(R\)：搜索/选择工具额外轮次
- \(c_{load}, c_{round}\)：每轮成本

净收益：

\[
\Delta = C_{full} - C_{dyn} - C_{误选} - C_{延迟}
\]

结论：

- 当 \(N\) 很大、任务只需要小子集、预加载准确时，按需暴露收益明显。
- 当 \(N\) 只有几十个、任务高频使用大部分工具时，全量常驻可能更简单、更快。
- 动态加载不是免费的，它会增加轮次和延迟。必须用预加载和缓存抵消。

所以方案必须是**混合式**：核心常驻 + 组目录常驻 + schema 按需加载 + 长尾搜索。

---

## 2. 总体架构

建议分成七层：

1. **工具源文件层**：YAML/JSON 描述工具，版本控制。
2. **注册表层**：启动时加载到内存/SQLite，提供搜索和索引。
3. **分组与角色层**：定义工具组、角色、权限、默认加载策略。
4. **上下文构建层**：每轮决定给模型看哪些工具。
5. **元工具层**：搜索、加载、卸载、查看文档。
6. **执行层**：参数校验、权限检查、沙箱执行、输出结构化。
7. **审计与评估层**：记录调用、权限决策、token、成功率、误选率。

---

## 3. 工具描述与序列化格式

不要只把工具“序列化到文件”。文件是源，运行时必须有索引。

推荐目录：

```text
tools/
  registry.yaml
  groups/
    crypto.yaml
    binary.yaml
    fs.yaml
    shell.yaml
  schemas/
    crypto.md5_compare.yaml
    binary.diff.yaml
  docs/
    crypto.md5_compare.md
    binary.diff.md
  index/
    tools.sqlite
    embeddings.bin
```

单个工具定义示例：

```yaml
id: crypto.md5_compare
version: 1.0.0
name: MD5 比较
group: crypto
tags:
  - role:verifier
  - purpose:verify
  - risk:readonly
  - cost:low
  - env:local
summary: 比较两个文件或字符串的 MD5
when_to_use:
  - 校验文件完整性
  - 比较两个哈希是否一致
when_not_to_use:
  - 需要加密安全哈希时，用 sha256
input_schema:
  type: object
  properties:
    left:
      type: string
      description: 文件路径或文本
    right:
      type: string
      description: 文件路径或文本
  required: [left, right]
output_schema:
  type: object
  properties:
    equal:
      type: boolean
    md5_left:
      type: string
    md5_right:
      type: string
handler:
  type: cli
  command: ["python", "-m", "toolbox.md5_compare", "--json"]
  args: ["--left", "{left}", "--right", "{right}"]
  timeout_ms: 5000
  max_output_bytes: 4096
permissions:
  - fs:read:/workspace
```

二进制对比工具：

```yaml
id: binary.diff
version: 1.0.0
name: 二进制对比
group: binary
tags:
  - role:verifier
  - purpose:verify
  - risk:readonly
  - cost:medium
summary: 比较两个二进制文件，返回首个差异偏移和差异摘要
input_schema:
  type: object
  properties:
    left:
      type: string
    right:
      type: string
    max_diff_samples:
      type: integer
      default: 16
  required: [left, right]
output_schema:
  type: object
  properties:
    equal:
      type: boolean
    first_diff_offset:
      type: integer
    diff_count:
      type: integer
    sample_hex_left:
      type: string
    sample_hex_right:
      type: string
    truncated:
      type: boolean
handler:
  type: cli
  command: ["python", "-m", "toolbox.binary_diff", "--json"]
permissions:
  - fs:read:/workspace
```

关键原则：

- 每个工具有唯一 ID。
- 必须有 `when_to_use` 和 `when_not_to_use`，降低误选。
- 输出必须是结构化 JSON，不能把原始 CLI 输出直接塞回上下文。
- 大输出写文件，返回路径和摘要。
- 权限、风险、成本必须显式声明。

---

## 4. 分组、标签与角色

固定按“角色/目的”分组太粗。建议：

- **主分组**：用于预加载和权限边界，如 `fs`、`shell`、`crypto`、`binary`、`net`、`db`。
- **多标签**：用于搜索和动态检索。
- **角色配置**：定义默认组、允许组、禁止标签。
- **目的配置**：任务模板映射到工具组。

标签维度：

| 维度 | 示例 |
|---|---|
| 角色 | role:developer, role:verifier, role:operator |
| 目的 | purpose:read, purpose:write, purpose:verify, purpose:deploy |
| 能力域 | domain:fs, domain:git, domain:crypto |
| 风险 | risk:readonly, risk:write, risk:destructive, risk:network |
| 成本 | cost:low, cost:medium, cost:high |
| 环境 | env:local, env:remote, env:k8s |
| 权限 | perm:fs_read, perm:net, perm:exec |

角色配置示例：

```yaml
roles:
  developer:
    default_groups: [fs, shell, git, test]
    allowed_groups: [fs, shell, git, test, crypto, binary, net]
    denied_tags: [risk:destructive, cost:high]

  verifier:
    default_groups: [crypto, binary, test]
    allowed_groups: [crypto, binary, test, fs_readonly]
    denied_tags: [risk:write, risk:network]
```

组大小建议 5～20 个工具。太大失去按需意义，太小加载轮次多。角色默认加载 1～3 组，活跃工具上限 20～30 个。

---

## 5. 三层工具暴露协议

推荐三层，而不是把所有工具索引都常驻。

### L0：核心常驻工具

始终在上下文，约 5～10 个：

- `fs.read`
- `fs.write`
- `shell.run_safe`
- `tool.search`
- `tool.load`
- `tool.unload`
- `tool.active`
- `tool.describe`

这些是元工具和基础工具，必须稳定。

### L1：组目录常驻

只给组名、描述、工具数量，不给每个工具 schema：

```text
可用工具组：
- fs: 文件读写、目录操作 (12)
- crypto: 哈希、签名、校验 (8)
- binary: 二进制比较、十六进制分析 (6)
- git: 版本控制 (15)
- net: HTTP、下载、API 调用 (10)
```

这样模型知道“有什么类”，但不知道每个工具细节。组数量通常几十个以内，token 可控。

### L2：活跃工具完整 schema

只有当前加载的工具才给完整 schema。模型可以直接调用它们。

### L3：工具文档按需

`tool.describe(id)` 返回详细文档、示例、限制。不默认进上下文。

不建议把完整工具索引常驻，除非 \(N < 100\)。否则索引本身也会膨胀。

---

## 6. 元工具与交互流程

元工具定义：

- `tool.search(query, group?, tags?, limit=5)`  
  返回工具卡片：`id | summary | group | tags | risk | cost`

- `tool.load(ids[])`  
  加载完整 schema 到活跃集。

- `tool.unload(ids[])`  
  卸载。

- `tool.active()`  
  列出当前活跃工具。

- `tool.describe(id)`  
  获取详细文档。

典型流程：

1. Agent 启动，根据角色加载默认组。
2. 用户提出任务。
3. 若默认组够用，直接调用。
4. 若不够，模型调用 `tool.search("md5 compare")`。
5. 返回工具卡片。
6. 模型调用 `tool.load(["crypto.md5_compare"])`。
7. 下一轮完整 schema 进入上下文。
8. 模型调用该工具。
9. 任务阶段结束，卸载或 LRU 淘汰。

关键点：文件不是发现机制。必须有 `search/load/describe` 元工具，否则模型不知道文件里有什么。

---

## 7. 上下文构建与缓存优化

每轮 LLM 调用的工具部分按以下顺序：

```text
[固定前缀]
系统提示 + 角色 + 权限
L0 核心工具 schema
L1 组目录

[动态部分]
L2 活跃工具 schema
最近工具调用结果
当前任务状态
```

原则：

- 固定前缀放前面，利用 prompt caching。
- 活跃工具 schema 放动态部分，避免加载/卸载破坏前缀缓存。
- 工具 schema 可以压缩：去掉冗长描述，只保留必要字段。
- 活跃工具超过预算时，按 LRU + 优先级淘汰。
- 工具输出必须截断，大输出写文件。

Token 预算示例：

| 部分 | 预算占比 |
|---|---|
| 系统提示与任务 | 30% |
| 核心工具 | 5% |
| 组目录 | 5% |
| 活跃工具 schema | 20% |
| 历史与结果 | 40% |

如果工具 schema 超过 20%，强制卸载低优先级工具。

---

## 8. 运行时生命周期

每个 Agent 会话有独立的 `ToolContext`：

```python
class ToolContext:
    active_tools: set[str]
    allowed_groups: set[str]
    allowed_tags: set[str]
    denied_tags: set[str]
    token_budget: int
```

加载策略：

- 角色启动：加载默认组。
- 任务分类：根据用户意图预加载 top-1 组。
- 模型主动搜索加载。
- 高风险组必须用户确认。

卸载策略：

- 显式卸载：任务阶段完成。
- LRU：活跃集超过上限，淘汰最久未用。
- 预算：工具 schema token 超限，淘汰低优先级。
- 任务结束：清空非核心工具。

执行流程：

```python
def call_tool(agent, tool_id, args):
    tool = registry.get(tool_id)
    if not agent.can_use(tool):
        raise PermissionError
    validate(args, tool.input_schema)
    cmd = build_command(tool, args)
    result = sandbox.run(cmd, limits)
    return tool.parse_output(result)
```

权限检查必须在调用时再次执行，不能只在加载时检查。

---

## 9. 权限、安全与沙箱

这是最容易出事的部分。

必须做：

- **最小权限**：角色只允许特定组和标签。
- **能力令牌**：如 `fs:read:/workspace/**`、`net:connect:api.github.com`、`exec:git`。
- **沙箱**：容器、gVisor、Firecracker，只读根，临时工作区，网络默认关。
- **命令注入防护**：不用 `shell=True`，参数数组传递。
- **路径校验**：`realpath` 必须在允许根内。
- **输出注入防护**：工具输出标记为不可信，不作为指令。
- **提示注入防护**：工具文档和搜索结果需审核/签名。
- **审计**：记录谁、何时、加载什么、调用参数、结果摘要、权限决策。
- **危险操作确认**：删除、写入、网络、部署需用户确认。

高风险工具组单独隔离，如 `shell.destructive`、`net.external`、`k8s.deploy`。

---

## 10. CLI 工具包装规范

CLI 是扩展能力的好方式，但不能直接暴露原始命令。必须包装。

规范：

- 每个 CLI 支持 `--json` 输出。
- 输出必须是结构化 JSON。
- 退出码语义明确。
- 无交互，无 TUI。
- 日志到 stderr，结果到 stdout。
- 超时、内存、输出大小限制。
- 幂等性尽量保证。
- 跨平台差异在包装器内处理。

MD5 比较：

```json
{
  "equal": true,
  "md5_left": "abc...",
  "md5_right": "abc..."
}
```

二进制对比：

```json
{
  "equal": false,
  "first_diff_offset": 1024,
  "diff_count": 37,
  "sample_hex_left": "00 01 02",
  "sample_hex_right": "00 01 03",
  "truncated": false
}
```

绝对不要返回完整二进制 diff。大输出写文件，返回路径和摘要。

---

## 11. 多 Agent 角色与交接

- 全局注册表只读共享。
- 每个 Agent 有自己的 ToolContext。
- Agent 启动时生成工具上下文快照。
- 交接时传递活跃工具集、未完成任务、权限上下文。
- 不要每个 Agent 都全量工具。

示例：

- Developer：默认 `fs, shell, git, test`
- Verifier：默认 `crypto, binary, test`
- Operator：默认 `k8s, net, shell_safe`
- Researcher：默认 `net, browser, fs_read`

角色重叠的工具通过标签共享，但权限独立。

---

## 12. 实施路线图

### 阶段 0：盘点与规范

- 盘点现有工具。
- 定义工具 schema。
- 定义核心元工具。
- 定义标签体系。

### 阶段 1：注册表与序列化

- YAML/JSON 源文件。
- 构建 SQLite FTS 索引。
- 启动加载到内存。
- 实现 `tool.search/load/unload/active/describe`。

### 阶段 2：三层暴露与上下文构建

- L0 核心常驻。
- L1 组目录常驻。
- L2 活跃 schema 动态。
- 实现 Token 预算和 LRU。

### 阶段 3：角色与权限

- 角色配置。
- 默认组预加载。
- 加载和调用双重权限检查。
- 多 Agent ToolContext。

### 阶段 4：CLI 包装与沙箱

- CLI 包装器。
- 结构化输出。
- 沙箱执行。
- 审计日志。

### 阶段 5：评估与优化

- A/B 测试：全量 vs 按需。
- 指标：成功率、token、轮次、延迟、误选率、安全事件。
- 混合检索：标签 + BM25 + 向量。
- 自动优化分组和默认加载。

---

## 13. 评估指标

| 指标 | 说明 |
|---|---|
| 任务成功率 | 最终是否完成 |
| 工具选择准确率 | 是否选了正确工具 |
| 误选率 | 选了无关工具 |
| 平均轮次 | 动态加载是否增加轮次 |
| Token/任务 | 上下文成本 |
| 延迟 | 端到端时间 |
| 缓存命中率 | prompt caching 效果 |
| 安全事件 | 越权、注入、危险操作 |
| 加载/卸载次数 | 动态机制是否过频 |

评估方法：

- 离线：历史任务标注所需工具。
- 在线：A/B 全量 vs 按需。
- 成本模型：节省 token 收益 vs 增加轮次延迟。

如果任务平均轮次少、工具库小，按需可能不划算。如果工具库大、任务长、多 Agent，按需收益明显。

---

## 14. 失败模式与对策

| 失败模式 | 对策 |
|---|---|
| 模型不知道有什么工具 | 常驻组目录 + `tool.search` |
| 搜索无结果 | 标签规范化，同义词，向量检索 |
| 加载轮次过多 | 角色默认组 + 任务意图预加载 |
| 加载后不卸载 | LRU + 预算 + 显式卸载 |
| 动态 schema 破坏缓存 | 固定前缀，动态放后 |
| 工具组爆炸 | 组大小 5～20，定期合并 |
| 权限绕过 | 调用时二次检查，沙箱 |
| CLI 注入 | 参数数组，白名单，转义 |
| 输出爆炸 | 结构化输出，截断，写文件 |
| 版本漂移 | 语义化版本，弃用周期 |
| 提示注入 | 工具输出不可信，文档审核 |

---

## 15. 示例：MD5 与二进制对比

用户任务：校验两个文件 MD5，并做二进制对比。

Verifier Agent 启动：

- 默认加载 `crypto`、`binary`。
- 上下文包含：核心工具 + 组目录 + `crypto.md5_compare` + `binary.diff` 的 schema。

调用：

```json
{"tool": "crypto.md5_compare", "args": {"left": "a.bin", "right": "b.bin"}}
```

返回：

```json
{"equal": false, "md5_left": "...", "md5_right": "..."}
```

调用：

```json
{"tool": "binary.diff", "args": {"left": "a.bin", "right": "b.bin", "max_diff_samples": 16}}
```

返回：

```json
{"equal": false, "first_diff_offset": 1024, "diff_count": 37, "sample_hex_left": "00 01 02", "sample_hex_right": "00 01 03"}
```

任务完成，卸载非核心工具。

如果默认组没加载，模型先 `tool.search("md5 compare")`，得到卡片，再 `tool.load`。

---

## 16. 最终建议

这个方向是对的，但必须做成混合式：

- 核心工具常驻。
- 组目录常驻。
- 活跃工具 schema 按需加载。
- 长尾工具通过搜索发现。
- 角色和权限决定默认加载和允许范围。
- CLI 必须结构化包装。
- 沙箱、审计、输出截断是硬要求。
- 用评估指标决定哪些组预加载、哪些动态加载。

不要走两个极端：

- 不要全量常驻几百个工具。
- 不要所有工具都动态加载，导致轮次爆炸、模型不知道有什么。

最稳的落地方式是：**少量核心常驻 + 组目录 + 按需 schema + 标签检索 + 权限沙箱 + 评估驱动调优。**