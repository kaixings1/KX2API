/**
 * engine/skills/sourceManager.ts — 技能源管理器
 *
 * 吸收自 D:\src\source-manager.ts 的多源技能管理能力。
 * KX2API 为 Electron 桌面应用，不执行 npm/git install，
 * 改为内存管理 + 配置持久化接口。
 */

/** 技能源类型 */
export type SkillSourceType = 'npm' | 'git' | 'local' | 'url'

/** 技能源 */
export interface SkillSource {
  id: string
  name: string
  type: SkillSourceType
  url: string
  enabled: boolean
}

/** 技能项 */
export interface SkillItem {
  name: string
  sourceId: string
  description: string
  version: string
}

/** 技能冲突 */
export interface Conflict {
  type: 'name_collision' | 'dependency'
  skillName: string
  sources: string[]
  detail: string
}

/** 技能源管理器状态 */
export interface SourceManagerState {
  sources: SkillSource[]
  installedSkills: SkillItem[]
}

class SkillSourceManager {
  private state: SourceManagerState = {
    sources: [],
    installedSkills: [],
  }

  /** 获取所有已注册源（元素为副本，外部修改不影响内部） */
  getAllSources(): SkillSource[] {
    return this.state.sources.map(s => ({ ...s }))
  }

  /**
   * 添加技能源。
   *
   * 显式传入的 id 若已存在则**抛错**而非静默追加：重复 id 会让后续
   * find/removeSource 只命中第一个，另一个成为"幽灵源"（列表里看得见、
   * 删不掉、且同名技能会被误判为跨源冲突）。
   */
  addSource(source: Omit<SkillSource, 'id'> & { id?: string }): SkillSource {
    const id = source.id || `${source.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    if (source.id && this.state.sources.some(s => s.id === source.id)) {
      throw new Error(`技能源 id 已存在：${source.id}`)
    }
    const newSource: SkillSource = { ...source, id }
    this.state.sources.push(newSource)
    return { ...newSource }
  }

  /** 移除技能源 */
  removeSource(id: string): boolean {
    const idx = this.state.sources.findIndex(s => s.id === id)
    if (idx === -1) return false
    this.state.sources.splice(idx, 1)
    // 同时移除该源的已安装技能
    this.state.installedSkills = this.state.installedSkills.filter(s => s.sourceId !== id)
    return true
  }

  /** 获取指定源的已安装技能 */
  getSourceSkills(sourceId: string): SkillItem[] {
    return this.state.installedSkills.filter(s => s.sourceId === sourceId)
  }

  /** 安装指定源的技能（模拟） */
  async installSourceSkills(sourceId: string): Promise<SkillItem[]> {
    const source = this.state.sources.find(s => s.id === sourceId)
    if (!source) return []

    // 实际安装由外部（main 进程或插件系统）完成
    // 这里仅记录源关联
    const items: SkillItem[] = []
    // 返回已记录的技能
    items.push(...this.getSourceSkills(sourceId))
    return items
  }

  /** 批量安装所有启用的源 */
  async installAllSources(): Promise<SkillItem[]> {
    const all: SkillItem[] = []
    for (const source of this.state.sources.filter(s => s.enabled)) {
      const items = await this.installSourceSkills(source.id)
      all.push(...items)
    }
    return all
  }

  /** 检测技能冲突 */
  getConflicts(skills?: SkillItem[]): Conflict[] {
    const list = skills ?? this.state.installedSkills
    const conflicts: Conflict[] = []
    const byName = new Map<string, SkillItem[]>()

    for (const skill of list) {
      const group = byName.get(skill.name) || []
      group.push(skill)
      byName.set(skill.name, group)
    }

    for (const [name, items] of byName) {
      if (items.length > 1) {
        const sources = items.map(i => i.sourceId)
        conflicts.push({
          type: 'name_collision',
          skillName: name,
          sources,
          detail: `技能 "${name}" 在多个源中存在：${sources.join(', ')}`,
        })
      }
    }

    return conflicts
  }

  /**
   * 从状态快照恢复（用于持久化）。
   *
   * 元素做深一层拷贝：只 `[...state.sources]` 的话，快照里的对象与内部
   * 共享引用，调用方随后改动快照（或反过来）会静默改到对方 —— 这类
   * "改了 A 影响了 B" 在持久化场景里极难排查。
   */
  restore(state: SourceManagerState): void {
    this.state = {
      sources: (state.sources ?? []).map(s => ({ ...s })),
      installedSkills: (state.installedSkills ?? []).map(s => ({ ...s })),
    }
  }

  /** 获取可序列化状态（元素为副本） */
  getState(): SourceManagerState {
    return {
      sources: this.state.sources.map(s => ({ ...s })),
      installedSkills: this.state.installedSkills.map(s => ({ ...s })),
    }
  }

  /** 注册已安装技能 */
  registerInstalledSkill(skill: Omit<SkillItem, 'sourceId'> & { sourceId: string }): void {
    this.state.installedSkills.push(skill as SkillItem)
  }
}

/** 全局技能源管理器实例 */
export const skillSourceManager = new SkillSourceManager()
