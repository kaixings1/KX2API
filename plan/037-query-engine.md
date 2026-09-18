# Plan-037: 查询引擎 (query.ts / QueryEngine.ts)

## 目标
实现 `D:\src\query.ts` 中的 `query()` 生成器和 `QueryEngine.ts` 中的完整查询引擎。

## 现状分析
- KX2API `engine/index.ts` 已有 `QueryEngine` 类
- 已有 `query()` 方法（非生成器）
- D:\src 的 `query()` 是异步生成器（`async function*`），支持可暂停迭代
- 缺少此模式

## 实施步骤

### Step 1: query 生成器
- 新建 `src/engine/query/queryGenerator.ts`
- 实现 `async function* query(params: QueryParams): AsyncGenerator<QueryChunk>`
- `QueryParams`：
  - `query: string` — 用户查询
  - `options?: { maxRounds?, tools?, systemPrompt? }`
- `QueryChunk`：
  - `type: 'message' | 'tool_use' | 'tool_result' | 'done' | 'error'`
  - `data: unknown`

### Step 2: 可暂停执行
- 生成器在每次 yield 后暂停
- 调用方通过 `.next()` 继续
- 支持外部中断（`return()`）

### Step 3: QueryEngine 集成
- 在现有 `QueryEngine.query()` 基础上添加生成器模式
- 内部使用 `MessageLoop` 的流式输出
- 将流式事件转换为生成器 yield

### Step 4: QueryEngineConfig
- 定义 `QueryEngineConfig`（Plan-037 的 type）：
  - `model`, `provider`, `apiKey`
  - `maxRounds`, `maxTokens`
  - `tools`, `systemPrompt`
  - `onChunk?: (chunk) => void`

### Step 5: 使用示例
```typescript
const gen = query({ query: '列出目录文件' })
for await (const chunk of gen) {
  if (chunk.type === 'tool_use') console.log('调用工具:', chunk.data)
}
```

## 验收标准
- `query()` 返回 AsyncGenerator
- 每次 yield 产出有意义的 chunk
- 外部可中断执行
- 与现有 QueryEngine.query() 行为一致

## 风险/依赖
- 中风险：生成器模式与现有消息循环的适配
