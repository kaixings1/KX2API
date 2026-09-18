# Plan-033: 历史记录系统 (history.ts)

## 目标
实现 `D:\src\history.ts` 中的完整历史记录系统，包括引用解析、粘贴文本处理、时间戳历史。

## 现状分析
- KX2API 有消息历史（`QueryEngine._conversation.messages`）
- 有 `makeHistoryReader` 类似的生成器
- 但缺少：
  - 粘贴文本引用解析
  - 图片引用处理
  - 时间戳历史
  - 历史记录的 CRUD 操作

## 实施步骤

### Step 1: 引用解析
- 新建 `src/engine/history/references.ts`
- 实现 `parseReferences(text: string): Reference[]`
- 引用格式：
  - `@/path/to/file:10-20` — 文件范围引用
  - `@img/path/to/image.png` — 图片引用
  - `@paste` — 粘贴文本引用

### Step 2: 粘贴文本处理
- 实现 `formatPastedTextRef(index: number): string`
- 实现 `getPastedTextRefNumLines(ref: string): number`
- 实现 `expandPastedTextRefs(text: string): string`
- 将 `@paste` 引用替换为实际内容

### Step 3: 图片引用
- 实现 `formatImageRef(path: string): string`
- 图片转 base64 内联
- 支持本地路径和 URL

### Step 4: 时间戳历史
- 定义 `TimestampedHistoryEntry`：
  - `timestamp: number`
  - `role: 'user' | 'assistant' | 'system'`
  - `content: string`
  - `metadata?: Record<string, unknown>`
- 实现 `getTimestampedHistory(): AsyncGenerator<TimestampedHistoryEntry>`
- 实现 `makeHistoryReader()` — 创建历史读取器生成器

### Step 5: 历史 CRUD
- 实现 `getHistory(): AsyncGenerator<HistoryEntry>` — 获取完整历史
- 实现 `addToHistory(entry): void`
- 实现 `clearPendingHistoryEntries(): void`
- 实现 `removeLastFromHistory(): void`

## 验收标准
- `parseReferences("@/src/index.ts:10-20")` 正确提取引用
- `expandPastedTextRefs` 正确展开粘贴引用
- 时间戳历史按时间排序
- `addToHistory` / `removeLastFromHistory` 操作正确

## 风险/依赖
- 中风险：引用解析的格式设计
