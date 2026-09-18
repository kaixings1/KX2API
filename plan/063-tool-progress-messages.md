# Plan-063: 工具进度消息过滤 (filterToolProgressMessages)

## 目标
实现 D:\src\Tool.ts 中 filterToolProgressMessages() 函数。

## 现状分析
- filterToolProgressMessages 过滤和整理工具进度消息
- KX2API 有类似的消息处理但没有专门的进度过滤

## 实施步骤

### Step 1: filterToolProgressMessages 实现
- 实现 `filterToolProgressMessages(messages, options): ToolProgress[]`
- 过滤冗余进度消息
- 合并连续进度

### Step 2: 进度去重
- 识别重复的进度更新
- 只保留最新状态

### Step 3: 集成
- 在消息循环中应用过滤
- 减少 renderer 更新频率

## 验收标准
- 进度消息正确过滤
- 无重复或冗余消息

## 风险/依赖
- 低风险：消息处理逻辑
