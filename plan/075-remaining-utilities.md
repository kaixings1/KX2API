# Plan-075: 剩余工具函数 (Remaining Utilities)

## 目标
实现 D:\src 中剩余的零散工具函数和系统。

## 现状分析
- 前 074 个 plan 已覆盖主要功能
- 仍有零散功能未覆盖：
  - util.ts 的辅助函数（hash, inRange, inNamespace, chooseVariation 等）
  - 启动性能分析器（startupProfiler）
  - 早期输入捕获（earlyInput）
  - 工作树模式检测（worktreeModeEnabled）
  - 设置变更检测器（settingsChangeDetector）
  - 技能变更检测器（skillChangeDetector）
  - 环境变量管理（envDynamic）
  - 终端备份恢复（appleTerminalBackup, iTermBackup）
  - 会话存储（sessionStorage）
  - 发布说明检查（releaseNotes）

## 实施步骤

### Step 1: 工具函数
- 新建 `src/engine/utils/helpers.ts`
- 实现 hash, inRange, inNamespace, chooseVariation 等
- 实现 promiseTimeout, paddedVersionString

### Step 2: 启动性能
- 实现 profileCheckpoint, profileReport
- 启动时间追踪

### Step 3: 设置/技能变更检测
- 实现 settingsChangeDetector
- 实现 skillChangeDetector

### Step 4: 终端备份
- 实现 checkAndRestoreTerminalBackup（仅 macOS）
- 实现 checkAndRestoreITerm2Backup（仅 macOS）

## 验收标准
- 所有工具函数可用
- 启动性能可追踪
- 变更检测正常

## 风险/依赖
- 低风险：纯工具函数
