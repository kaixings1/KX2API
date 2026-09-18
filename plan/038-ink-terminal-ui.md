# Plan-038: Ink 终端 UI (ink.ts)

## 目标
确认 KX2API 是否需要移植 `D:\src\ink.ts` 中的 Ink 终端 UI 组件。

## 现状分析
- **KX2API 是 Electron + React 桌面应用**，使用 Web 渲染层
- **D:\src 是 CLI/终端应用**，使用 Ink（React for Terminal）
- 两者渲染层完全不同，**无需移植 Ink**

## 结论：❌ 不需要移植

### 理由
1. **渲染层不匹配**：KX2API 有完整的 Electron renderer（React DOM + CSS），Ink 是终端渲染
2. **功能不重叠**：Ink 提供 `Box`、`Text`、`useInput`、`useApp` 等终端组件，KX2API 使用 HTML 元素
3. **已有替代**：KX2API 的 shadcn/ui + Tailwind 覆盖了所有 Ink 能提供的 UI 能力

### 如果未来需要终端 UI
- 方案 A：在 Electron 的 BrowserWindow 中嵌入 xterm.js
- 方案 B：在调试/开发者模式中提供终端视图
- 方案 C：单独的 TUI 模式（类似 `electron-vite` 的 dev 终端）

## 决策建议
**跳过此模块**。KX2API 的渲染层（`src/renderer/`）已经是完整的前端应用，Ink 的功能完全没有移植必要。

## 相关但不移植的内容
- `D:\src\ink.ts` 中的 `render()` / `createRoot()` — 用于 CLI 的渲染入口
- `Box` / `Text` 组件 — 替代：HTML div / span
- `useInput` — 替代：React event handlers
- `useApp` — 替代：Zustand store + hooks
