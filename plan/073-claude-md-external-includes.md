# Plan-073: CLAUDE.md 外部引用 (External Includes)

## 目标
实现 D:\src\utils/claudemd.ts 中的外部引用功能。

## 现状分析
- getExternalClaudeMdIncludes() 获取外部引用的 CLAUDE.md
- getMemoryFiles() 获取记忆文件
- shouldShowClaudeMdExternalIncludesWarning() 检查是否需要显示警告
- KX2API 的 /init 生成 CLAUDE.md 但不支持外部引用

## 实施步骤

### Step 1: 外部引用解析
- 实现 `getExternalClaudeMdIncludes(claudeMdContent): string[]`
- 解析 @include 指令

### Step 2: 记忆文件获取
- 实现 `getMemoryFiles(projectPath): MemoryFile[]`
- 扫描记忆目录

### Step 3: 警告系统
- 实现 `shouldShowClaudeMdExternalIncludesWarning(): boolean`
- 检测外部引用是否存在

## 验收标准
- 外部引用正确解析
- 记忆文件正确获取
- 警告正确触发

## 风险/依赖
- 低风险：文件解析
