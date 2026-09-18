# Plan-008: 实验系统 (runExperiment / getExperimentResult)

## 目标
实现 `D:\src\core.ts` 中的 `runExperiment()` 和 `getExperimentResult()`，提供 A/B 实验运行和结果查询能力。

## 现状分析
- KX2API 无实验系统
- 依赖于 Plan-005 的 GrowthBook 核心

## 实施步骤

### Step 1: 实验类型定义
- 新建 `src/engine/featureFlag/experiments.ts`
- 定义：
  - `Experiment` (name, variations, coverage, status)
  - `ExperimentResult` (name, variation, value, meta)
  - `ExperimentStatus` (draft, running, stopped, archived)

### Step 2: runExperiment
- 实现 `runExperiment(name: string, options): ExperimentResult`
- 流程：
  1. 查找已注册实验（或创建新实验）
  2. 获取用户 attributes（userId, sessionId 等）
  3. 使用 `getHashAttribute()` 计算分桶
  4. 根据 coverage 判断用户是否在实验组
  5. 分配 variation
  6. 记录曝光事件
- 返回：`{ name, variation, value, source: 'experiment' }`

### Step 3: getExperimentResult
- 实现 `getExperimentResult(experimentName): ExperimentResult | null`
- 从实验状态存储中读取结果
- 如果实验不存在或未运行，返回 null

### Step 4: 实验持久化
- 实现 `saveExperimentResult(result): void` — 写入实验存储
- 实现 `getAllExperimentResults(): ExperimentResult[]` — 读取全部

### Step 5: 去重
- 实现 `getExperimentDedupeKey(name, attributes): string`
- 同一用户同一实验只曝光一次

## 验收标准
- `runExperiment('button-color', { variations: ['red', 'blue'], coverage: 0.5 })`
- 50% 用户得到 'red'，50% 得到 'blue'
- 同一用户多次调用始终得到相同结果
- `getExperimentResult()` 返回上次结果
- 去重键确保同一会话不重复曝光

## 风险/依赖
- 依赖 Plan-005 的哈希和分桶系统
- 实验状态存储：内存（可扩展到 DB）
