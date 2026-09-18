# Plan-035: 技能源管理 (source-manager.ts)

## 目标
实现 `D:\src\source-manager.ts` 中的技能源管理系统。

## 现状分析
- KX2API 有 plugin/skill 系统（`engine/plugin/`）
- 但缺少：
  - 多源技能管理
  - 源冲突检测
  - 批量安装

## 实施步骤

### Step 1: 核心类型
- 新建 `src/engine/skills/sourceManager.ts`
- 定义 `SkillSource` interface：
  - `id: string`
  - `name: string`
  - `type: 'npm' | 'git' | 'local' | 'url'`
  - `url: string`
  - `enabled: boolean`
- 定义 `SkillItem` interface：
  - `name: string`
  - `sourceId: string`
  - `description: string`
  - `version: string`

### Step 2: ensureDir
- 实现 `ensureDir(path: string): Promise<void>`
- 确保技能安装目录存在
- 创建 `skills/` 目录在项目根

### Step 3: 源管理
- 实现 `getAllSources(): SkillSource[]`
- 实现 `addSource(source): void`
- 实现 `removeSource(id): void`

### Step 4: 技能管理
- 实现 `getSourceSkills(sourceId): SkillItem[]`
- 实现 `installSourceSkills(sourceId): Promise<SkillItem[]>`
- 实现 `installAllSources(): Promise<SkillItem[]>`

### Step 5: 冲突检测
- 实现 `getConflicts(skills): Conflict[]`
- 检测同名的不同版本技能
- 检测依赖冲突

## 验收标准
- `getAllSources()` 返回所有已注册源
- `installSourceSkills()` 安装技能
- `getConflicts()` 检测同名冲突
- `installAllSources()` 批量安装

## 风险/依赖
- 中风险：git/npm 安装逻辑需完善
