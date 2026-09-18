# Plan-036: Mongo 规则引擎 (mongrule.ts)

## 目标
实现 `D:\src\mongrule.ts` 中的 `evalCondition()` 函数，提供 MongoDB 查询语法的规则求值能力。

## 现状分析
- KX2API 有 `permissions/permissionRules.ts` 权限规则系统
- 但缺少类似 MongoDB 查询语法的通用规则引擎
- `evalCondition` 用于权限规则中

## 实施步骤

### Step 1: 条件类型定义
- 新建 `src/engine/rules/mongrule.ts`
- 定义 `MongoCondition`：
  ```typescript
  type MongoCondition = {
    $and?: MongoCondition[]
    $or?: MongoCondition[]
    $not?: MongoCondition
    [key: string]: unknown
  }
  ```

### Step 2: evalCondition
- 实现 `evalCondition(condition: MongoCondition, data: Record<string, unknown>): boolean`
- 支持的操作符：
  - `$eq`, `$ne` — 等于/不等于
  - `$gt`, `$gte`, `$lt`, `$lte` — 比较
  - `$in`, `$nin` — 在/不在数组中
  - `$regex` — 正则匹配
  - `$exists` — 字段存在
  - `$and`, `$or`, `$not` — 逻辑组合

### Step 3: 字段匹配
- 实现 `matchField(condition, value, fieldPath)` 递归匹配
- 支持嵌套对象（`user.role` 格式）

### Step 4: 集成到权限系统
- 在 `permissionRules.ts` 中使用 `evalCondition`
- 权限规则格式改为 MongoDB 条件格式

### Step 5: 扩展操作符
- `$contains` — 字符串包含
- `$startsWith` / `$endsWith` — 前后缀
- `$type` — 类型检查

## 验收标准
- `evalCondition({ age: { $gt: 18 } }, { age: 25 })` → true
- `evalCondition({ $and: [{ active: true }, { role: 'admin' }] }, data)` → 正确求值
- 嵌套对象正确匹配
- `$regex` 正确匹配

## 风险/依赖
- 中风险：需完整实现 MongoDB 查询子集
