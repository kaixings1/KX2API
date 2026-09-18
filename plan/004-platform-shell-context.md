# Plan-004: 平台 Shell 上下文

## 目标
实现 `D:\src\context.ts` 中的平台检测和 Shell 信息输出，已在 KX2API 全局 context 中部分实现，需确认完整性。

## 现状分析
- KX2API 系统提示词注入中已有 `platformShell` 信息（Windows/Mac/Linux）
- 格式已对齐：Windows → cmd 格式，其他 → bash 格式
- **此功能已基本完成**，但需确认以下细节：

## 核查清单

### 已实现 ✅
- `process.platform` 检测（win32/darwin/linux）
- Shell 检测（CLAUDE_CODE_SHELL / SHELL / 默认）
- 命令格式提示已注入到上下文

### 待完善 ⚠️
1. **MSYS2 Git Bash 特殊处理**：KX2API 运行在 Git Bash 环境中，但用户需要 cmd 格式命令。需确认上下文中的 "默认 Shell" 显示的是 Git Bash 还是 cmd
2. **PowerShell 识别**：如果用户使用 pwsh 而非 cmd，应提示 PowerShell 语法
3. **命令格式转换提示**：当检测到非 cmd shell 时，应在系统提示中强调"返回 cmd 格式命令"

## 实施步骤（如需完善）

### Step 1: 检测实际 Shell
```typescript
const actualShell = process.env.SHELL || process.env.CLAUDE_CODE_SHELL || ''
const isGitBash = actualShell.includes('git-bash') || actualShell.includes('msys')
const isPowerShell = actualShell.includes('pwsh') || actualShell.includes('powershell')
```

### Step 2: 增强 platformShell 信息
- Git Bash → 提示返回 Windows cmd 格式
- PowerShell → 提示返回 PowerShell 格式
- CMD → 提示返回 cmd 格式

## 验收标准
- 在 Git Bash 中运行，系统提示正确指示"返回 Windows cmd 格式命令"
- 在 PowerShell 中运行，系统提示正确指示 PowerShell 语法
- 不影响已有平台检测逻辑

## 风险/依赖
- 极低风险：纯展示层调整
