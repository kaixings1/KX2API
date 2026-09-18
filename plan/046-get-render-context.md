# Plan-046: 渲染上下文 (getRenderContext)

## 目标
实现 `D:\src\interactiveHelpers.tsx` 中的 `getRenderContext()` 函数。

## 现状分析
- D:\src 的 getRenderContext 创建渲染选项 + FPS 追踪器 + stats store
- 包含帧时序日志、闪烁检测等性能监控
- KX2API 缺少类似的性能监控基础设施

## 实施步骤

### Step 1: 类型定义
- 定义 `RenderContext`（renderOptions, getFpsMetrics, stats）

### Step 2: getRenderContext 实现
- 实现 `getRenderContext(exitOnCtrlC): RenderContext`
- 获取基础渲染选项
- 创建 FpsTracker
- 创建 StatsStore
- 配置 onFrame 回调

### Step 3: 帧时序日志
- 支持 CLAUDE_CODE_FRAME_TIMING_LOG 环境变量
- 同步写入帧时序 JSONL

### Step 4: 闪烁检测
- 检测终端大小不匹配
- 上报 flicker 事件

## 验收标准
- 返回完整的渲染上下文
- FPS 指标正确计算
- 帧时序日志正常写入

## 风险/依赖
- 低风险：纯监控逻辑
