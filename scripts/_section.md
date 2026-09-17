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

### 八、仍待吸收（未做）

按价值排序：
- [ ] **attachments 机制**（60+ 类型 + 扫描式去重 + 双层预算，上游 `utils/attachments.ts`）
- [ ] **子代理上下文隔离**（`createSubagentContext` + CacheSafeParams 共享槽位）
- [ ] **会话转录**（`sessionTranscript` 落盘压缩前原文，供事后追溯）
- [ ] **对话恢复 / 会话恢复**（`conversationRecovery` + `sessionRestore` 的容错四层）
- [ ] **会话级记忆 SessionMemory**（与 memdir 不同层次：单次对话内、只喂给 compact）

