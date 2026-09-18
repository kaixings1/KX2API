# Plan-055: Auto Wrapper (auto-wrapper.ts)

## 目标
分析 `D:\src\auto-wrapper.ts` 中的默认导出（GrowthBook 实例）。

## 现状分析
- auto-wrapper.ts 是 GrowthBook 的浏览器端自动初始化包装器
- 创建单例 GrowthBook 实例
- 配置 plugins（auto-attributes, tracking, sticky-bucket）
- 处理 anti-flicker、growthbook_queue 等

## 实施决定
- **KX2API 不使用此模块**。auto-wrapper 是浏览器端 SDK 的入口，依赖 DOM API（document, window）
- KX2API 使用 Electron，已有独立的特性标记方案
- 如需要特性标记，使用 Plan-005 到 Plan-011 中定义的 Electron 适配方案

## 替代方案
- 使用 `src/engine/feature/` 目录下的 Electron 适配实现
- 通过 IPC 在 main/renderer 间传递特性状态

## 风险/依赖
- 无风险：明确不移植
