# Plan-064: 工具匹配 (toolMatchesName, findToolByName)

## 目标
实现 D:\src\Tool.ts 中 toolMatchesName() 和 findToolByName() 函数。

## 现状分析
- toolMatchesName 模糊匹配工具名
- findToolByName 查找工具实例
- KX2API 有工具注册表但没有名称匹配逻辑

## 实施步骤

### Step 1: toolMatchesName 实现
- 实现 `toolMatchesName(toolName, query): boolean`
- 支持精确匹配和模糊匹配
- 处理别名

### Step 2: findToolByName 实现
- 实现 `findToolByName(name, tools): Tool | undefined`
- 遍历工具列表
- 使用 toolMatchesName 匹配

### Step 3: 集成
- 在工具查找时使用
- 支持命令行工具别名

## 验收标准
- 工具名匹配正确
- 模糊搜索生效

## 风险/依赖
- 低风险：查找逻辑
