# Plan-062: SetToolJSXFn 类型

## 目标
实现 D:\src\Tool.ts 中 SetToolJSXFn 类型。

## 现状分析
- SetToolJSXFn 用于设置工具的 JSX 渲染函数
- 这是 Ink 终端 UI 特有的功能（React 组件渲染）
- KX2API 使用 Web 渲染，不直接需要此功能

## 实施决定
- **不移植**。KX2API 的渲染层完全不同
- 如果需要工具进度可视化，使用 Web 组件替代

## 替代方案
- 使用 React 组件渲染工具进度
- 通过 IPC 传递进度数据

## 风险/依赖
- 无风险：不需要
