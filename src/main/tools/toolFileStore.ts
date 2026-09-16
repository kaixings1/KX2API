/**
 * toolFileStore — 工具 / 分组 / 提示规则的「文件化」主存储层
 *
 * 背景：工具组数据早期全塞在 electron-store 的 config.toolManagement，既不直观、
 * 也无法按组拆分复用。本次重构改为「文件为主」：
 *
 *   userData/toolgroups/
 *   ├── tools/      <toolId>.json (+ 同名 .xml 镜像)
 *   ├── groups/     <groupId>.json (+ .xml)
 *   └── hintRules/  <ruleId>.json (+ .xml)
 *
 * 约定：
 *   - JSON 是权威格式：页面写入写 <id>.json；同时刷新 <id>.xml 镜像供外部读取。
 *   - 读取时 JSON 优先、XML 兜底（双格式都认）。
 *   - builtin 实体不落盘：它们来自 default-data.json 模板即可，避免内置默认被
 *     用户改动污染文件目录；本层只管非 builtin 的自定义实体。
 *
 * 首次启动：若目录尚无自定义文件，则把 electron-store 里已有的自定义
 * （builtin=false）迁移成文件；若其中也没有，则生成空目录（由 toolManager 用
 * 默认模板兜底）。此后文件即为权威，electron-store 里的 toolManagement 不再
 * 用作读取源。
 */

import { join } from 'path'
import { app } from 'electron'
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync,
} from 'node:fs'
import { storeManager } from '../store/store'
import type { ToolDefinition, ToolGroup, ToolHintRule, ToolManagementStore, ToolRole } from './types'

const ROOT = (): string => join(app.getPath('userData'), 'tools')

type Kind = 'tools' | 'groups' | 'hintRules' | 'roles'
const EXT_JSON = '.json'
const EXT_XML = '.xml'

/**
 * 内置实体的「覆盖层」子目录名。
 *
 * 内置工具/分组/规则来自 default-data.json + commandRegistry，本不落盘；
 * 但用户需要能自定义内置项（改描述/用法/参数/启用状态/执行模板）。为避免把
 * 255 个内置实体全量铺到磁盘、以及内置模板升级后被旧副本污染，这里只在
 * builtin/<kind>/ 下存「用户改动过的那几个」，读取时按 id 覆盖到内置模板上。
 */
const BUILTIN_DIR = 'builtin'

// ==================== XML 序列化（单向：对象 -> XML；XML -> 对象仅基础还原） ====================

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function valueToXml(key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return ''
      const childKey = singular(key)
      return value.map(v => valueToXml(childKey, v)).join('')
    }
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return `<${key}/>`
    return `<${key}>${entries.map(([k, v]) => valueToXml(k, v)).join('')}</${key}>`
  }
  return `<${key}>${esc(value)}</${key}>`
}

function singular(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y'
  if (name.endsWith('s')) return name.slice(0, -1)
  return name
}

function toXml(obj: Record<string, unknown>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${Object.entries(obj)
    .map(([k, v]) => valueToXml(k, v)).join('')}</root>\n`
}

/** 简易 XML → JSON：仅处理本系统生成的平铺标签结构，遇复杂 XML 返回 null。 */
function fromXml(xml: string): Record<string, unknown> | null {
  let body = xml
  // 去掉最外层根标签（如 <root>...</root>），只解析内部内容
  const outer = /^\s*(?:<\?xml[^>]*\?>)?\s*<([a-zA-Z0-9_-]+)>([\s\S]*)<\/\1>\s*$/.exec(body)
  if (outer) {
    body = outer[2]
  } else {
    const openRe = /<\?xml[^>]*\?>\s*<([a-zA-Z0-9_-]+)>([\s\S]*?)(<\/\1>)?\s*$/.exec(body)
    if (openRe) body = openRe[2]
  }
  const parsed = parseChildren(body)
  // 若顶层只有单一键且为对象，则认为是根包装后的内容（例如数组被包成单对象）不扁平化，
  // 直接返回内容本身，保证 readEntity 能读到实体字段
  return parsed
}

function parseChildren(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const re = /<([a-zA-Z0-9_-]+)>(.*?)<\/\1>|(<[a-zA-Z0-9_-]+\/>)/gs
  let m: RegExpExecArray | null = re.exec(text)
  while (m) {
    if (m[3]) {
      // 空标签 <x/>
      const tag = m[3].slice(1, -2)
      push(out, tag, '')
    } else {
      const tag = m[1]
      const inner = m[2]
      const childRe = /<[a-zA-Z0-9_-]+>[\s\S]*<\/[a-zA-Z0-9_-]*>|\s*<\/[a-zA-Z0-9_-]+>/.test(inner)
        || /<[a-zA-Z0-9_-]+\/>/.test(inner)
      if (inner.indexOf('<') === -1) {
        push(out, tag, unesc(inner))
      } else if (/<[a-zA-Z0-9_-]+>[\s\S]*<\/[a-zA-Z0-9_-]+>/.test(inner) || /<[a-zA-Z0-9_-]+\/>/.test(inner)) {
        push(out, tag, parseChildren(inner))
      } else {
        push(out, tag, unesc(inner.replace(/<[^>]+>/g, '')))
      }
    }
    m = re.exec(text)
  }
  return out
}

function unesc(s: string): string {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function push(out: Record<string, unknown>, key: string, value: unknown): void {
  if (key in out) {
    if (Array.isArray(out[key])) (out[key] as unknown[]).push(value)
    else out[key] = [out[key], value]
  } else {
    out[key] = value
  }
}

// ==================== 文件读 / 写 ====================

function dirOf(kind: Kind, builtin = false): string {
  return builtin ? join(ROOT(), BUILTIN_DIR, kind) : join(ROOT(), kind)
}

function ensureDir(kind: Kind, builtin = false): void {
  const d = dirOf(kind, builtin)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

function jsonFile(kind: Kind, id: string, builtin = false): string {
  return join(dirOf(kind, builtin), `${id}${EXT_JSON}`)
}

function xmlFile(kind: Kind, id: string, builtin = false): string {
  return join(dirOf(kind, builtin), `${id}${EXT_XML}`)
}

function readJson<T>(kind: Kind, id: string, builtin = false): T | null {
  const p = jsonFile(kind, id, builtin)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) as T } catch { return null }
}

function readXmlAsJson(kind: Kind, id: string, builtin = false): Record<string, unknown> | null {
  const p = xmlFile(kind, id, builtin)
  if (!existsSync(p)) return null
  try { return fromXml(readFileSync(p, 'utf-8')) } catch { return null }
}

/** JSON 优先、XML 兜底读取一个实体 */
function readEntity<T>(kind: Kind, id: string, builtin = false): T | undefined {
  const j = readJson<T>(kind, id, builtin)
  if (j && typeof j === 'object') return j
  const x = readXmlAsJson(kind, id, builtin)
  if (x && typeof x === 'object') return x as unknown as T
  return undefined
}

/** 写 JSON（权威）+ 写 XML（镜像） */
function writeEntity(kind: Kind, id: string, entity: Record<string, unknown>, builtin = false): void {
  ensureDir(kind, builtin)
  writeFileSync(jsonFile(kind, id, builtin), JSON.stringify(entity, null, 2), 'utf-8')
  try {
    writeFileSync(xmlFile(kind, id, builtin), toXml(entity), 'utf-8')
  } catch { /* XML 镜像失败不阻断 */ }
}

function deleteEntity(kind: Kind, id: string, builtin = false): void {
  try { rmSync(jsonFile(kind, id, builtin), { force: true }) } catch { /* ignore */ }
  try { rmSync(xmlFile(kind, id, builtin), { force: true }) } catch { /* ignore */ }
}

function existingIds(kind: Kind, builtin = false): string[] {
  const d = dirOf(kind, builtin)
  if (!existsSync(d)) return []
  const set = new Set<string>()
  for (const n of readdirSync(d)) {
    if (n.endsWith(EXT_JSON)) set.add(n.slice(0, -EXT_JSON.length))
    else if (n.endsWith(EXT_XML)) set.add(n.slice(0, -EXT_XML.length))
  }
  return [...set]
}

// ==================== 对外 API ====================

export const toolFileStore = {
  /** 列出所有自定义工具（builtin=false 才落盘，这里只会出现自定义） */
  listTools(): ToolDefinition[] {
    return existingIds('tools')
      .map(id => readEntity<ToolDefinition>('tools', id))
      .filter((t): t is ToolDefinition => !!t)
  },
  listGroups(): ToolGroup[] {
    return existingIds('groups')
      .map(id => readEntity<ToolGroup>('groups', id))
      .filter((g): g is ToolGroup => !!g)
  },
  listHintRules(): ToolHintRule[] {
    return existingIds('hintRules')
      .map(id => readEntity<ToolHintRule>('hintRules', id))
      .filter((r): r is ToolHintRule => !!r)
  },
  saveTool(t: ToolDefinition): void { writeEntity('tools', t.id, t as unknown as Record<string, unknown>) },
  saveGroup(g: ToolGroup): void { writeEntity('groups', g.id, g as unknown as Record<string, unknown>) },
  saveHintRule(r: ToolHintRule): void { writeEntity('hintRules', r.id, r as unknown as Record<string, unknown>) },
  deleteTool(id: string): void { deleteEntity('tools', id) },
  deleteGroup(id: string): void { deleteEntity('groups', id) },
  deleteHintRule(id: string): void { deleteEntity('hintRules', id) },
  resetAll(): void {
    const kinds: Kind[] = ['tools', 'groups', 'hintRules', 'roles']
    // 自定义目录
    for (const k of kinds) {
      const d = dirOf(k)
      if (existsSync(d)) rmSync(d, { recursive: true, force: true })
    }
    // 内置覆盖层目录（用户对内置项的改动）也一并清掉，才算真正「恢复默认」
    for (const k of kinds) {
      const d = dirOf(k, true)
      if (existsSync(d)) rmSync(d, { recursive: true, force: true })
    }
  },
  /**
   * 返回当前已存在自定义文件的实体总数（空目录 → 0）。
   * 供确认是否已从 electron-store 迁移过。
   */
  countCustom(): { tools: number; groups: number; hintRules: number } {
    return {
      tools: existingIds('tools').length,
      groups: existingIds('groups').length,
      hintRules: existingIds('hintRules').length,
    }
  },

  // ==================== 内置覆盖层（builtin/ 子目录） ====================
  //
  // 内置实体本不落盘，用户改动以「覆盖层」形式单独存放：文件在
  // userData/tools/builtin/<kind>/<id>.json，读取时按 id 覆盖内置模板。
  // 这样既能自定义任意内置命令，又不会把几百个内置实体铺满磁盘，
  // 内置模板升级后也不会被旧副本顶掉（没改过的项永远跟着模板走）。

  /** 列出所有被用户改动过的内置工具覆盖项 */
  listBuiltinTools(): ToolDefinition[] {
    return existingIds('tools', true)
      .map(id => readEntity<ToolDefinition>('tools', id, true))
      .filter((t): t is ToolDefinition => !!t)
  },
  listBuiltinGroups(): ToolGroup[] {
    return existingIds('groups', true)
      .map(id => readEntity<ToolGroup>('groups', id, true))
      .filter((g): g is ToolGroup => !!g)
  },
  listBuiltinHintRules(): ToolHintRule[] {
    return existingIds('hintRules', true)
      .map(id => readEntity<ToolHintRule>('hintRules', id, true))
      .filter((r): r is ToolHintRule => !!r)
  },

  /** 写内置覆盖项（用户保存对内建实体的修改） */
  saveBuiltinTool(t: ToolDefinition): void {
    writeEntity('tools', t.id, t as unknown as Record<string, unknown>, true)
  },
  saveBuiltinGroup(g: ToolGroup): void {
    writeEntity('groups', g.id, g as unknown as Record<string, unknown>, true)
  },
  saveBuiltinHintRule(r: ToolHintRule): void {
    writeEntity('hintRules', r.id, r as unknown as Record<string, unknown>, true)
  },

  /** 删除内置覆盖项 = 恢复该实体的内置默认 */
  deleteBuiltinTool(id: string): void { deleteEntity('tools', id, true) },
  deleteBuiltinGroup(id: string): void { deleteEntity('groups', id, true) },
  deleteBuiltinHintRule(id: string): void { deleteEntity('hintRules', id, true) },

  /** 该内置实体是否已被用户改动过（决定页面上能否「恢复默认」） */
  hasBuiltinOverride(kind: Kind, id: string): boolean {
    return existsSync(jsonFile(kind, id, true)) || existsSync(xmlFile(kind, id, true))
  },

  /**
   * 懒生成：把内置实体按当前生效值落盘成一份可编辑的 JSON+XML 文件。
   * 供「点击条目 → 打开对应文件」用：用户没改过的内置项在磁盘上本来没有
   * 文件，打开前先物化一份，避免打开空白。已存在则不覆盖。
   */
  materializeBuiltin(kind: Kind, id: string, entity: Record<string, unknown>): void {
    if (this.hasBuiltinOverride(kind, id)) return
    writeEntity(kind, id, entity, true)
  },

  /** 内置覆盖层的磁盘路径（供「在文件管理器中显示」用） */
  builtinPathOf(kind: Kind, id: string): string {
    return jsonFile(kind, id, true)
  },

  /** 自定义实体文件的磁盘路径 */
  customPathOf(kind: Kind, id: string): string {
    return jsonFile(kind, id)
  },

  // ==================== 角色配置（roles/ 子目录）====================

  listRoles(): ToolRole[] {
    return existingIds('roles')
      .map(id => readEntity<ToolRole>('roles', id))
      .filter((r): r is ToolRole => !!r)
  },
  saveRole(r: ToolRole): void {
    writeEntity('roles', r.id, r as unknown as Record<string, unknown>)
  },
  deleteRole(id: string): void { deleteEntity('roles', id) },
}

/**
 * 迁移（可选）：首次启动且工具目录为空时，把 electron-store 里已有的自定义
 * 数据导出成文件，实现平滑接管。返回迁移的各类数量。
 */
export function migrateCustomRulesFromStore(): { tools: number; groups: number; hintRules: number } {
  const counts = { tools: 0, groups: 0, hintRules: 0 }
  // 任一目录已有文件则跳过，避免重复迁移
  if (toolFileStore.countCustom().tools + toolFileStore.countCustom().groups + toolFileStore.countCustom().hintRules > 0) {
    return counts
  }
  try {
    const raw = (storeManager.getConfig() as unknown as { toolManagement?: ToolManagementStore }).toolManagement
    if (!raw) return counts
    for (const t of raw.tools || []) if (!t.builtin) { toolFileStore.saveTool(t); counts.tools++ }
    for (const g of raw.groups || []) if (!g.builtin) { toolFileStore.saveGroup(g); counts.groups++ }
    for (const r of raw.hintRules || []) if (!r.builtin) { toolFileStore.saveHintRule(r); counts.hintRules++ }
  } catch { /* 迁移失败不阻塞，下次尝试 */ }
  return counts
}

/** 供测试：清除所有文件化目录（不影响 electron-store）。 */
export function __resetAll(): void {
  toolFileStore.resetAll()
}