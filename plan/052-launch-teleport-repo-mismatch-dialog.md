# Plan-052: Teleport 仓库不匹配对话框 (launchTeleportRepoMismatchDialog)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchTeleportRepoMismatchDialog()` 函数。

## 现状分析
- 选择目标仓库的本地检出路径
- KX2API 无 teleport 仓库管理功能

## 实施步骤

### Step 1: launchTeleportRepoMismatchDialog 实现
- 实现 `async function launchTeleportRepoMismatchDialog(root, props): Promise<string | null>`
- props: { targetRepo: string, initialPaths: string[] }
- 动态导入 TeleportRepoMismatchDialog

### Step 2: 路径选择
- 展示可用本地路径
- 处理选择和取消

## 验收标准
- 路径列表正确展示
- 选择结果正确返回

## 风险/依赖
- 低风险：纯对话框逻辑
