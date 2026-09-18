# Plan-050: 助手安装向导 (launchAssistantInstallWizard)

## 目标
实现 `D:\src\dialogLaunchers.tsx` 中的 `launchAssistantInstallWizard()` 函数。

## 现状分析
- `claude assistant` 命令的安装向导
- KX2API 无 assistant 功能
- 依赖 computeDefaultInstallDir

## 实施步骤

### Step 1: launchAssistantInstallWizard 实现
- 实现 `async function launchAssistantInstallWizard(root): Promise<string | null>`
- 计算默认安装目录
- 动态导入 NewInstallWizard

### Step 2: 安装流程
- 显示安装向导 UI
- 处理安装成功/失败/取消

## 验收标准
- 安装向导正常显示
- 安装结果正确处理

## 风险/依赖
- 中风险：依赖 assistant 功能实现
