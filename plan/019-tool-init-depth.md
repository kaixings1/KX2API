# Plan-019: 工具初始化深度与标记 (getToolInitDepth / _markToolInitStart / _markToolInitEnd)

## 目标
实现 `D:\src\tools.ts` 中的 `getToolInitDepth()`、`_markToolInitStart()`、`_markToolInitEnd()`，管理工具的异步初始化深度和标记。

## 现状分析
- KX2API 工具初始化是同步的（`importCommands()` → `syncFromRegistry()`）
- 缺少异步初始化深度控制
- 某些工具需要异步初始化（如 MCP 连接、插件加载）

## 实施步骤

### Step 1: 初始化深度计数器
- 新建 `src/engine/tools/initDepth.ts`
- 实现 `let _toolInitDepth = 0`
- 实现 `getToolInitDepth(): number` — 返回当前深度
- 实现 `_markToolInitStart(): void` — 深度 +1
- 实现 `_markToolInitEnd(): void` — 深度 -1

### Step 2: 工具初始化流程
- 在 `importCommands()` 中：
  - `_markToolInitStart()` → 加载命令 → `_markToolInitEnd()`
  - 嵌套初始化（命令 A 触发命令 B）时深度递增
- 在 `toolCollection.syncFromRegistry()` 中同样标记

### Step 3: 异步初始化守卫
- 实现 `withInitDepth<T>(fn: () => Promise<T>): Promise<T>`
- 自动管理 start/end 配对
- 即使异步函数中也能正确追踪

### Step 4: 调试输出
- 当深度 > 0 时，在 engineLog 中输出深度信息
- 便于排查循环初始化问题

### Step 5: 集成
- 在 `QueryEngine.init()` 中使用深度标记
- 插件工具加载时自动追踪

## 验收标准
- `getToolInitDepth()` 在初始化期间返回正确值
- 嵌套初始化深度正确递增/递减
- 初始化完成后深度回到 0
- 异常时深度能正确回退（try-finally）

## 风险/依赖
- 低风险：计数追踪
