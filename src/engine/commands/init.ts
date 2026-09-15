/**
 * src/engine/commands/init.ts — /init 命令实现
 *
 * 作用：扫描当前项目（package.json / 锁文件 / 目录结构 / 配置文件），
 * 生成或更新项目根目录的 CLAUDE.md（项目说明文件，会作为后续对话的上下文）。
 *
 * 安全策略：只改动被 `<!-- KX2CODE:INIT:BEGIN -->` / `...:END -->` 包裹的自动区块，
 * 用户自己写的内容永远不动。没有标记时是「追加」，有标记时是「原地替换」。
 */

import { promises as fs } from 'fs'
import { existsSync, statSync } from 'fs'
import { join } from 'path'

export const INIT_BLOCK_BEGIN = '<!-- KX2CODE:INIT:BEGIN -->'
export const INIT_BLOCK_END = '<!-- KX2CODE:INIT:END -->'

export interface ProjectInfo {
  root: string
  name: string
  version?: string
  description?: string
  packageManager: string
  scripts: Array<{ name: string; command: string }>
  dependencies: string[]
  devDependencies: string[]
  topLevelDirs: string[]
  srcDirs: string[]
  configFiles: string[]
}

/** 目录名 → 一句话说明（命中就写说明，否则只列名字） */
const DIR_HINTS: Record<string, string> = {
  main: 'Electron 主进程（窗口、IPC、代理服务、存储）',
  renderer: 'React 渲染层（页面与组件）',
  preload: '预加载脚本（安全地暴露主进程能力给渲染层）',
  shared: '主进程与渲染层共用的类型/工具',
  engine: 'AI 引擎（消息循环、工具调度、命令注册表）',
  commands: '斜杠命令实现',
  proxy: '本地代理服务（转发、映射、路由）',
  providers: '各上游供应商适配',
  tools: '工具实现与集合',
  agent: '多角色/多智能体协作',
  agents: '智能体定义',
  oauth: 'OAuth 登录与凭证管理',
  store: '配置持久化',
  utils: '通用工具函数',
  types: '类型定义',
  tests: '测试用例',
  scripts: '辅助脚本',
  docs: '文档',
  config: '配置样例',
  capture: '抓包/调试脚本',
  build: '打包资源',
}

const CONFIG_CANDIDATES = [
  'package.json',
  'tsconfig.json',
  'electron.vite.config.ts',
  'vite.config.ts',
  'vitest.config.ts',
  'tailwind.config.ts',
  'postcss.config.cjs',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.cjs',
  '.prettierrc',
  '.prettierrc.json',
  '.editorconfig',
  'Dockerfile',
  'docker-compose.yml',
  '.github/workflows',
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'release', 'build', 'coverage', '.vscode', '__pycache__'])

async function readPackageJson(root: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(join(root, 'package.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function detectPackageManager(root: string): Promise<string> {
  const checks: Array<[string, string]> = [
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ]
  for (const [file, name] of checks) {
    if (existsSync(join(root, file))) return name
  }
  return 'npm'
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'en'))
  } catch {
    return []
  }
}

/** 扫描项目，得到一份可渲染的结构化信息 */
export async function analyzeProject(root: string): Promise<ProjectInfo> {
  const pkg = await readPackageJson(root)
  const scripts = Object.entries((pkg?.scripts as Record<string, string>) || {})
    .filter(([, cmd]) => typeof cmd === 'string')
    .map(([name, command]) => ({ name, command }))

  const dependencies = Object.keys((pkg?.dependencies as Record<string, string>) || {}).sort()
  const devDependencies = Object.keys((pkg?.devDependencies as Record<string, string>) || {}).sort()

  return {
    root,
    name: typeof pkg?.name === 'string' ? pkg.name : '(未命名项目)',
    version: typeof pkg?.version === 'string' ? pkg.version : undefined,
    description: typeof pkg?.description === 'string' ? pkg.description : undefined,
    packageManager: await detectPackageManager(root),
    scripts,
    dependencies,
    devDependencies,
    topLevelDirs: await listDirs(root),
    srcDirs: existsSync(join(root, 'src')) ? await listDirs(join(root, 'src')) : [],
    configFiles: CONFIG_CANDIDATES.filter(f => existsSync(join(root, f))),
  }
}

/** 生成被标记包裹的自动区块内容 */
export function renderManagedBlock(info: ProjectInfo): string {
  const lines: string[] = []
  lines.push(INIT_BLOCK_BEGIN)
  lines.push('## 项目概览（由 /init 自动生成，可重新运行 /init 刷新）')
  lines.push('')
  lines.push(`- 名称：\`${info.name}\`${info.version ? `（v${info.version}）` : ''}`)
  if (info.description) lines.push(`- 说明：${info.description}`)
  lines.push(`- 包管理器：\`${info.packageManager}\``)
  lines.push(`- 根目录：\`${info.root}\``)
  lines.push('')

  lines.push('### 常用命令')
  lines.push('')
  if (info.scripts.length === 0) {
    lines.push('（package.json 中没有定义 scripts）')
  } else {
    lines.push('| 命令 | 作用 |')
    lines.push('| --- | --- |')
    for (const s of info.scripts) {
      lines.push(`| \`${info.packageManager} run ${s.name}\` | ${s.command.replace(/\|/g, '\\|')} |`)
    }
  }
  lines.push('')

  lines.push('### 目录结构')
  lines.push('')
  if (info.topLevelDirs.length === 0) {
    lines.push('（未发现子目录）')
  } else {
    for (const dir of info.topLevelDirs) {
      lines.push(`- \`${dir}/\`${DIR_HINTS[dir] ? ` — ${DIR_HINTS[dir]}` : ''}`)
    }
  }
  if (info.srcDirs.length > 0) {
    lines.push('')
    lines.push('`src/` 下：')
    for (const dir of info.srcDirs) {
      lines.push(`- \`src/${dir}/\`${DIR_HINTS[dir] ? ` — ${DIR_HINTS[dir]}` : ''}`)
    }
  }
  lines.push('')

  lines.push('### 技术栈')
  lines.push('')
  const tech = [...new Set([...info.dependencies, ...info.devDependencies])]
  lines.push(tech.length > 0 ? tech.map(t => `\`${t}\``).join('、') : '（未声明依赖）')
  lines.push('')

  lines.push('### 关键配置文件')
  lines.push('')
  lines.push(info.configFiles.length > 0 ? info.configFiles.map(f => `- \`${f}\``).join('\n') : '（未发现常见配置文件）')
  lines.push('')

  lines.push('### 工作约定')
  lines.push('')
  lines.push('- 修改代码后运行上面「常用命令」中的测试/构建命令，确认通过再提交。')
  lines.push('- 保持与现有目录分层一致：跨进程复用的类型放到共享目录，不要重复定义。')
  lines.push('- 自动生成区块之外的内容由人维护，`/init` 不会覆盖。')
  lines.push('')
  lines.push(INIT_BLOCK_END)
  return lines.join('\n')
}

/**
 * 写入 / 更新 CLAUDE.md：
 * - 文件不存在 → 创建（含标题）
 * - 已存在且含自动区块 → 原地替换
 * - 已存在但没有自动区块 → 追加到末尾（用户原有内容保留）
 */
export async function upsertManagedBlock(
  filePath: string,
  block: string,
): Promise<'created' | 'updated' | 'appended'> {
  if (!existsSync(filePath)) {
    const header = '# CLAUDE\n\n项目说明文件：给 AI 助手的项目上下文，会在对话中作为项目规则使用。\n\n'
    await fs.writeFile(filePath, header + block + '\n', 'utf-8')
    return 'created'
  }

  const existing = await fs.readFile(filePath, 'utf-8')
  const begin = existing.indexOf(INIT_BLOCK_BEGIN)
  const end = existing.indexOf(INIT_BLOCK_END)

  if (begin >= 0 && end > begin) {
    const next = existing.slice(0, begin) + block + existing.slice(end + INIT_BLOCK_END.length)
    await fs.writeFile(filePath, next, 'utf-8')
    return 'updated'
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  await fs.writeFile(filePath, existing + separator + block + '\n', 'utf-8')
  return 'appended'
}

/**
 * /init 命令入口。
 * 用法：`/init`（扫描当前工作目录）或 `/init <目录>`；`--force` 仅影响提示文案（更新永远是原地替换）。
 */
export async function runInit(args: string[]): Promise<{
  success: boolean
  output?: string
  error?: string
}> {
  const dirArg = args.find(a => !a.startsWith('-') && existsSync(a) && statSync(a).isDirectory())
  const root = dirArg || process.cwd()

  try {
    const info = await analyzeProject(root)
    const block = renderManagedBlock(info)
    const target = join(root, 'CLAUDE.md')
    const action = await upsertManagedBlock(target, block)

    const actionText =
      action === 'created' ? '已创建 CLAUDE.md'
        : action === 'updated' ? '已更新 CLAUDE.md 中的自动区块'
          : 'CLAUDE.md 已存在，已追加自动区块（原有内容未改动）'

    const preview = block.split('\n').slice(0, 24).join('\n')
    const output = [
      `✅ /init 完成：${actionText}`,
      `路径：${target}`,
      `识别到 ${info.scripts.length} 个脚本、${info.topLevelDirs.length} 个顶层目录、${info.configFiles.length} 个配置文件（包管理器：${info.packageManager}）。`,
      '',
      '生成内容预览：',
      '```markdown',
      preview,
      block.split('\n').length > 24 ? '...（完整内容见 CLAUDE.md）' : '',
      '```',
    ].filter(Boolean).join('\n')

    return { success: true, output }
  } catch (e) {
    return { success: false, error: `初始化失败: ${(e as Error).message}` }
  }
}
