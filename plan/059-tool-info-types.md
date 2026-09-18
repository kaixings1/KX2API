# Plan-059: ToolInfo 和 ToolDef 类型

## 目标
补全 D:\src\Tool.ts 中 ToolInfo 和 ToolDef 类型的完整实现。

## 现状分析
- ToolInfo 包含工具的完整元数据
- ToolDef 是工具定义的简化版本
- KX2API 有基础工具定义但缺少完整元数据

## 实施步骤

### Step 1: ToolInfo 定义
- 定义 ToolInfo interface（name, description, schema, provider 等）

### Step 2: ToolDef 定义
- 定义 ToolDef type（简化版工具定义）
- 用于配置和注册

### Step 3: 集成到工具系统
- 在工具注册时生成 ToolInfo
- 支持从 ToolDef 构建 ToolInfo

## 验收标准
- ToolInfo 包含所有必需字段
- ToolDef 可正确构建 ToolInfo

## 风险/依赖
- 低风险：纯类型定义
