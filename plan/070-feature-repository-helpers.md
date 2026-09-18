# Plan-070: 特性仓库 Helpers (feature-repository.ts)

## 目标
实现 D:\src\feature-repository.ts 中的 helpers 导出对象。

## 现状分析
- feature-repository.ts 导出一个 helpers 对象
- 包含特性仓库的辅助函数
- KX2API 有特性标记但不完整

## 实施步骤

### Step 1: helpers 对象定义
- 新建 `src/engine/feature/repositoryHelpers.ts`
- 定义 helpers 对象接口
- 实现：getVisibleFeatures, getEvaluatedFeatures, refreshFeatures

### Step 2: 缓存管理
- 实现缓存读写逻辑
- 自动刷新机制

### Step 3: 可见性处理
- 实现 getVisibleFeatures 过滤不可见特性
- 处理用户权限和分组

## 验收标准
- helpers 对象完整导出
- 缓存管理正常
- 可见性过滤正确

## 风险/依赖
- 低风险：辅助函数
