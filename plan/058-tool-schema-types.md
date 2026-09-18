# Plan-058: 工具 Schema 类型 (Tool.ts re-exports)

## 目标
实现 D:\src\Tool.ts 中 re-export 的类型定义。

## 现状分析
- Tool.ts 大量 re-export 来自 types/ 目录的类型：
  - ToolInputJSONSchema, ToolInfo, ToolPermissionRulesBySource
  - ToolPermissionContext, ToolProgressData, ToolProgress
  - AgentToolProgress, MCPProgress, REPLToolProgress
- 这些类型在 KX2API 中可能有对应但不完整的定义

## 实施步骤

### Step 1: 类型整理
- 新建 `src/engine/tools/types.ts`
- 统一定义所有工具相关类型
- 与 KX2API 现有类型对齐

### Step 2: 缺失类型实现
- 补全 ToolPermissionContext
- 补全 ToolProgress 系列类型
- 补全 QueryChainTracking, ValidationResult

### Step 3: 导出统一
- 统一从 tools/types.ts 导出
- 替代分散的类型定义

## 验收标准
- 所有工具类型完整定义
- 类型间关系正确

## 风险/依赖
- 低风险：纯类型定义
