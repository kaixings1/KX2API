# Plan-003: 用户上下文 (getUserContext)

## 目标
实现 `D:\src\context.ts` 中的 `getUserContext()` 功能，获取用户级上下文（Claude.md 文件内容、日期等）。

## 现状分析
- KX2API 有 `engine/claudeMdLoader.ts` 加载 CLAUDE.md
- 有 `bootstrap/state.ts` 管理会话状态
- 无统一的 `getUserContext` 组合层
- 无 `getMemoryFiles()` / `getClaudeMds()` 工具链

## 实施步骤

### Step 1: Claude.md 工具链
- 新建 `src/engine/context/claudeMd.ts`
- 实现 `getMemoryFiles(): Promise<string[]>` — 扫描 `~/.claude/` 或 `CLAUDE.md`
- 实现 `getClaudeMds(files: string[]): string | null` — 读取并合并多个 claude.md 文件
- 实现 `filterInjectedMemoryFiles(files: string[]): string[]` — 过滤系统注入文件
- 实现 `setCachedClaudeMdContent()` / `getCachedClaudeMdContent()` 缓存

### Step 2: 环境检测
- 实现 `isBareMode()` — 检测是否 bare 模式
- 实现 `getAdditionalDirectoriesForClaudeMd()` — 获取额外扫描目录
- 实现 `isEnvTruthy(env: string): boolean` — 环境变量布尔判断

### Step 3: getUserContext 主函数
- 新建 `src/engine/context/userContext.ts`
- 导出 `getUserContext(): Promise<Record<string, string>>`
- 组合 claudeMd 内容 + 当前日期
- 使用 memoize 缓存

### Step 4: 集成
- 在 `QueryEngine` 构造时注入用户上下文
- 对话开始时自动调用

## 验收标准
- `getUserContext()` 返回 `{ claudeMd: string, currentDate: string }`
- bare 模式下跳过 claude.md 自动发现
- 环境变量 `CLAUDE_CODE_DISABLE_CLAUDE_MDS` 强制关闭
- 缓存生效，同会话内不重复读取文件

## 风险/依赖
- 文件 I/O 性能：需 memoize 缓存
- 路径约定：`~/.claude/` 路径需跨平台兼容
