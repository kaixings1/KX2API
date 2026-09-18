# Plan-051: Teleport 恢复包装器 (launchTeleportResumeWrapper)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchTeleportResumeWrapper()` 函数。

## 现状分析
- 交互式 teleport 会话选择器
- KX2API 无 teleport/远程会话恢复功能
- 依赖 TeleportRemoteResponse 类型

## 实施步骤

### Step 1: launchTeleportResumeWrapper 实现
- 实现 `async function launchTeleportResumeWrapper(root): Promise<TeleportRemoteResponse | null>`
- 动态导入 TeleportResumeWrapper

### Step 2: 会话选择
- 展示可恢复的 teleport 会话
- 处理选择和取消

## 验收标准
- 会话列表正确展示
- 恢复结果正确返回

## 风险/依赖
- 中风险：依赖 teleport 远程功能
