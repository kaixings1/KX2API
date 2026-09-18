# Plan-049: 助手会话选择器 (launchAssistantSessionChooser)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchAssistantSessionChooser()` 函数。

## 现状分析
- 选择要附加的桥接会话
- KX2API 暂无桥接会话/assistant 功能
- 需要在后续阶段实现

## 实施步骤

### Step 1: launchAssistantSessionChooser 实现
- 实现 `async function launchAssistantSessionChooser(root, props): Promise<string | null>`
- props: { sessions: AssistantSession[] }
- 动态导入 AssistantSessionChooser

### Step 2: 会话列表展示
- 展示可用桥接会话
- 支持选择和取消

## 验收标准
- 会话列表正确渲染
- 选择结果正确返回

## 风险/依赖
- 低风险：依赖 assistant 系统
