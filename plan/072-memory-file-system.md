# Plan-072: 记忆文件系统 (Memory Files)

## 目标
实现 D:\src\utils/claudemd.ts 中的记忆文件系统。

## 现状分析
- claudemd.ts 有 getMemoryFiles(), clearMemoryFileCaches() 等函数
- 管理 .claude/memories/ 目录下的记忆文件
- KX2API 有 /init 命令但没有记忆文件管理

## 实施步骤

### Step 1: 记忆文件类型
- 定义 MemoryFile interface（path, content, scope, lastAccessed）

### Step 2: getMemoryFiles 实现
- 实现 `getMemoryFiles(projectPath): MemoryFile[]`
- 扫描 .claude/memories/ 目录
- 读取所有记忆文件

### Step 3: 记忆文件管理
- 实现记忆文件的读写
- 实现 clearMemoryFileCaches 清理缓存
- 支持记忆文件的热重载

## 验收标准
- 记忆文件正确扫描
- 缓存正确清理
- 热重载正常

## 风险/依赖
- 低风险：文件 I/O
