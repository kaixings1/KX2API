# Plan-054: Bootstrap 宏 (bootstrapMacro.ts)

## 目标
实现 `D:\src\bootstrapMacro.ts` 中的 `ensureBootstrapMacro()` 函数。

## 现状分析
- KX2API 使用 `app.getVersion()` 获取版本信息
- D:\src 使用 MACRO 全局对象存储版本、构建时间、包 URL 等
- ensureBootstrapMacro 确保 MACRO 在 globalThis 上可用

## 实施步骤

### Step 1: 类型定义
- 定义 `MacroConfig` interface（VERSION, BUILD_TIME, PACKAGE_URL 等）

### Step 2: ensureBootstrapMacro 实现
- 新建 `src/engine/bootstrap/macro.ts`
- 实现 `ensureBootstrapMacro(): void`
- 如果 globalThis.MACRO 不存在则初始化
- 从 package.json 读取版本

### Step 3: KX2API 集成
- 在 main 进程启动时调用 ensureBootstrapMacro
- 通过 preload 暴露给 renderer

## 验收标准
- MACRO 在全局可用
- 版本信息正确

## 风险/依赖
- 低风险：全局状态初始化
