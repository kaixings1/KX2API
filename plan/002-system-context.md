# Plan-002: 系统上下文 (getSystemContext)

## 目标
实现 `D:\src\context.ts` 中的 `getSystemContext()` 功能，统一组装系统级上下文：git 状态、平台信息、注入、Glossary 等。

## 现状分析
- KX2API 已有 `engine/gitContext.ts` (GitContextInjector) 但只负责 git
- `engine/index.ts` 中 `buildEnhancedSystemPrompt` 构造系统提示，但无独立上下文获取层
- 无 `memoize` 缓存机制保证上下文在对话生命周期内一致

## 实施步骤

### Step 1: 创建上下文获取层
- 新建 `src/engine/context/systemContext.ts`
- 导出 `getSystemContext(): Promise<Record<string, string>>`
- 内部调用 `getGitStatus()`（已有）、`loadGlossary()`、`getSessionEpoch()`
- 使用 `memoize` 做会话级缓存

### Step 2: Git 状态获取
- 复用/增强 `engine/gitContext.ts` 中的逻辑
- 实现 `getGitStatus(): Promise<string | null>`：
  - 获取当前分支、默认分支、工作区状态、最近 5 条提交
  - 超 2000 字符截断并提示

### Step 3: Glossary 加载
- 实现 `getGlossary()` 读取项目术语表（可复用 `utils/glossary.ts` 如果存在，否则新建）
- 返回 key-value 格式的术语定义

### Step 4: Session Epoch
- 实现 `getSessionEpoch()` 从 bootstrap/state 读取，每次压缩递增

### Step 5: 集成到引擎
- 在 `QueryEngine` 构造时注入系统上下文
- `buildEnhancedSystemPrompt` 消费上下文

## 验收标准
- `getSystemContext()` 返回包含 `gitStatus`、`platformShell`、`sessionEpoch`、`glossary` 的对象
- git 状态正确截断超长输出
- 在测试环境跳过 git 调用

## 风险/依赖
- 依赖 git 可执行文件路径
- Glossary 文件路径需约定
