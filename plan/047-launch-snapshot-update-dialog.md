# Plan-047: 快照更新对话框 (launchSnapshotUpdateDialog)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchSnapshotUpdateDialog()` 函数。

## 现状分析
- 代理内存快照更新提示对话框
- KX2API 没有代理记忆/快照系统
- 需要在 D:\src 功能吸收时完整实现

## 实施步骤

### Step 1: 类型定义
- 定义 SnapshotUpdateDialogProps
- 定义返回值类型 'merge' | 'keep' | 'replace'

### Step 2: launchSnapshotUpdateDialog 实现
- 实现 `async function launchSnapshotUpdateDialog(root, props): Promise<'merge' | 'keep' | 'replace'>`
- 动态导入 SnapshotUpdateDialog 组件
- 使用 showSetupDialog 渲染

### Step 3: KX2API 适配
- 如果 KX2API 实现了代理记忆系统，使用此启动器
- 否则标记为待实现

## 验收标准
- 对话框正确渲染
- 返回用户选择

## 风险/依赖
- 低风险：纯对话框启动逻辑
