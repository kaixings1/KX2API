# core-harness — 关键核心代码的离线调试层

把「关键核心代码」变成**纯数据进、纯数据出**：喂一段文本或一组消息，直接拿到解析结果，与期望对比。不需要起 Electron、不需要连上游、不需要等模型返回。

## 为什么需要

工具调用/消息配对这几条链路，此前只能靠「启动应用 → 连真实上游 → 等模型返回」来观察。出问题时：

- 慢：一轮观察要几十秒
- 不可复现：模型的返回每次都不一样
- 不可定位：报错在深层链路，看不到中间产物

结果是同一类 bug（协议不匹配、配对断裂、归一化错向）反复出现却难以在改之前验证。本层把这些问题变成**一次输入、一次输出、一次断言**。

## 用法

### 1. 场景文件（带期望值，可做回归）

```bash
node tools/core-harness/run.mjs --case tools/core-harness/cases/extract-json-openai.json
node tools/core-harness/run.mjs --dir  tools/core-harness/cases
```

场景文件格式：

```json
{
  "target": "extract",
  "input":  { "text": "<tool_call>...</tool_call>" },
  "expect": { "toolCalls": [ { "name": "ls" } ] }
}
```

`expect` 采用**子集匹配**：只校验列出的字段，未列出的不参与比较。所以你可以只断言关心的部分。

### 2. 直接喂数据（调试用）

```bash
# 从文本文件读
node tools/core-harness/run.mjs --target extract --input ./raw.txt

# 内联文本
node tools/core-harness/run.mjs --target extract --text "..."

# 管道（内容若本身是 JSON 对象，会当作 input 用；否则当作待处理文本）
cat raw.txt | node tools/core-harness/run.mjs --target extract
```

注意：需经 `tsx` 才能加载 `.ts` 被测模块，即实际命令是

```bash
npx tsx tools/core-harness/run.mjs --target extract --input ./raw.txt
```

已接入 npm script，可直接用 `npm run core -- ...`（见下）。

### 3. 查看可用目标

```bash
node tools/core-harness/run.mjs --list
```

## 可用 target

| target | 测什么 | 输入 |
| --- | --- | --- |
| `extract` | 从整段文本提取工具调用（非流式） | `{ text }` |
| `extract-stream` | 按 chunk 分片喂入，模拟流式到达 | `{ text, chunkSize? }` |
| `plain-parse` | 整段纯文本工具调用解析（全匹配才返回） | `{ text, allowedNames? }` |
| `plain-extract` | 混杂正文中抽取 + 剥离 | `{ text, allowedNames? }` |
| `pairing` | tool_use / tool_result 配对与顺序修复 | `{ messages }` |
| `stream-parse` | 流式解析器：观察工具调用如何被逐步发出 | `{ text, chunkSize?, protocol? }` |
| `detect` | 客户端类型识别（提示词注入痕迹） | `{ text }` |
| `tool-name` | 工具名归一化 | `{ name }` |

## 退出码

- `0`：全部通过
- `1`：有 case 失败（可直接用于 CI / pre-commit）

## 已知阻断项

以下问题由本层**发现并已定位**，但涉及产品语义，需人工决策后才改：

### 1. 工具名归一化方向错误（影响面最大）

`src/main/proxy/toolCalling/protocols/shared.ts` 的 `TOOL_NAME_MAPPING`（31 条）把工具名映射到
**Claude Code 风格**的名字：

```
ls → ListFiles    cat → Read    find → Glob    bash → Bash    ...
```

而本项目的注册命令（`src/engine/agent/command-runners.ts`）是它自己的名字：`ls`、`cat`、`find`、`bash`…

量化结果（见 `scripts/_probe_toolmap.mjs` 的思路）：

```
映射目标名共 11 个：Bash, Read, Write, Edit, Glob, Grep, ListFiles, ...
其中存在于本项目注册表的：0 / 11
```

也就是说，**凡走 normalizeToolName 的工具调用，名字必然对不上本项目工具**。

同一个映射表还有第二份副本：`toolCallExtractor.ts` 的 `TOOL_NAME_MAP_LOOSE`（同样 `ls → ListFiles`），
以及 `ruleToolDeclareCn` / `ruleLooseToolDeclare` 里硬编码的 `'ListFiles'` / `'Read'` / `'Bash'`。

**待决策**：归一化的目标应是「本项目注册命令名」（即 `ls` 保持 `ls`），
还是「上游/Claude Code 风格名」（则注册表需同步改名）。

### 2. 已修复的相关问题（留作回归）

- `<tool_call><toolName>ls</toolName><arguments>…</arguments></tool_call>` 此前**完全无法解析**
  —— 提取器的 pattern 只认 `<name>`，而 `BASE_SYSTEM_PROMPT` 教的是 `<toolName>`（一字之差）。
  已补 pattern 8b。
- `ruleSurgeTagXml`（声明式意图规则）会把 `<toolName>` 这个**容器标签**当成工具名，
  且它在结构化解析**之前**执行，抢匹配标准格式。已加容器标签守卫。
- `looksLikeToolCall` 对「以 `{` 开头」一刀切返回 true，导致**完整的 JSON 工具调用被整段丢弃**
  （正文与工具调用双双丢失）。已改为区分「配平完整」与「中间态」。

## 加新 target / 新 case

- 新 target：在 `run.mjs` 的 `TARGETS` 里加一项，实现 `run(input)` 返回可序列化结果即可。
- 新 case：往 `cases/` 放一个 `.json`，`--dir` 会自动收集（含子目录）。

## 设计取舍

- **只读**：harness 不改被测状态、不写文件、不发网络请求（除被测代码自身的副作用）。
- **不 import Electron**：所有 target 都绕开 Electron 依赖，因此可脱离应用运行。
  若某模块强依赖 Electron，应先在源码里把它拆成可独立测试的纯函数，再加 target。
- **失败时打印实际结果**：便于直接定位，而不是只给一句断言失败。
