/**
 * src/engine/commands/registry.ts — 命令注册表
 *
 * 从 doge-code 移植命令系统。命令分为两类：
 * - 本地命令：直接在 Node.js 执行，返回结果
 * - AI 代理命令：将命令意图转为 prompt，由 LLM 执行
 */

import { runInit } from './init.ts'

export interface CommandResult {
  success: boolean
  output?: string
  error?: string
  needsAgent?: boolean
}

export interface Command {
  name: string
  description: string
  /** 工具分组，留空则属于 "default" 组 */
  group?: string
  execute: (args: string[]) => Promise<CommandResult>
}

class CommandRegistry {
  private commands = new Map<string, Command>()

  register(cmd: Command) {
    this.commands.set(cmd.name, cmd)
  }

  get(name: string): Command | undefined {
    return this.commands.get(name)
  }

  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  has(name: string): boolean {
    return this.commands.has(name)
  }

  getNames(): string[] {
    return Array.from(this.commands.keys())
  }

  getByGroup(group: string): Command[] {
    return Array.from(this.commands.values()).filter(c => (c as any).group === group || (!(c as any).group && group === 'default'))
  }

  getAllGroups(): string[] {
    const groups = new Set<string>()
    for (const c of Array.from(this.commands.values())) {
      groups.add((c as any).group || 'default')
    }
    return Array.from(groups)
  }
}

export const commandRegistry = new CommandRegistry()

// ==================== 基础命令 ====================

commandRegistry.register({
  name: 'help',
  description: '显示帮助信息',
  execute: async () => {
    const all = commandRegistry.getAll()
    const lines = all.map(c => `  /${c.name} — ${c.description}`)
    return { success: true, output: `可用命令 (${all.length}):\n\n${lines.join('\n')}` }
  },
})

commandRegistry.register({
  name: 'clear',
  description: '清空对话',
  execute: async () => {
    return { success: true, output: '对话已清空' }
  },
})

commandRegistry.register({
  name: 'new',
  description: '开始新对话',
  execute: async () => {
    return { success: true, output: '已开始新对话' }
  },
})

commandRegistry.register({
  name: 'pwd',
  description: '当前工作目录',
  execute: async () => {
    try {
      return { success: true, output: process.cwd() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

/**
 * 列表生成：目录与文件分类、各自按名称排序（数字自然序）、每项独立成行。
 * - ls: 目录 `[DIR]  name/`，文件 `       name`
 * - dir: 目录 `<DIR>  name/`，文件 `       name`
 * 开头打印路径与计数，方便 AI/终端按行渲染，避免「一行挤满」。
 */
async function listDirectoryImpl(target: string, withDirMarker: boolean): Promise<string> {
  const fs = await import('fs')
  const path = await import('path')
  const entries = await fs.promises.readdir(target, { withFileTypes: true })
  if (entries.length === 0) return '(空目录)'

  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
  const files = entries.filter(e => !e.isDirectory()).map(e => e.name)
  dirs.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  const lines: string[] = []
  lines.push(`[DIR] ${path.resolve(target)}  (${dirs.length} 目录 / ${files.length} 文件)`)
  for (const name of dirs) lines.push(`${withDirMarker ? '  <DIR>  ' : '  [DIR]  '}${name}/`)
  for (const name of files) lines.push(`         ${name}`)
  return lines.join('\n')
}

commandRegistry.register({
  name: 'ls',
  description: '列出目录文件（目录/文件分类分行）',
  execute: async (args) => {
    try {
      const target = args[0] || process.cwd()
      return { success: true, output: await listDirectoryImpl(target, false) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'dir',
  description: '列出目录文件（目录/文件分类分行，Windows 风格）',
  execute: async (args) => {
    try {
      const target = args[0] || process.cwd()
      return { success: true, output: await listDirectoryImpl(target, true) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'grep',
  description: '在文件中搜索文本 (用法: /grep <pattern> [file])',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      if (!args.length) return { success: false, error: '用法: /grep <pattern> [file]' }
      const pattern = args[0]
      const target = args[1] || process.cwd()
      // Use findstr on Windows, grep on Unix
      const cmd = process.platform === 'win32'
        ? `findstr /s /n "${pattern}" "${target}"`
        : `grep -rn "${pattern}" "${target}"`
      const result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 10000 })
      return { success: true, output: result || '(无匹配)' }
    } catch (e: any) {
      const out = e.stdout || e.message
      return { success: true, output: out || '(无匹配)' }
    }
  },
})

commandRegistry.register({
  name: 'find',
  description: '查找文件 (用法: /find <name> [dir])',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      if (!args.length) return { success: false, error: '用法: /find <name> [dir]' }
      const name = args[0]
      const dir = args[1] || process.cwd()
      const cmd = process.platform === 'win32'
        ? `dir /s /b "${dir}" | findstr /i "${name}"`
        : `find "${dir}" -name "*${name}*"`
      const result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 10000 })
      return { success: true, output: result || '(无匹配)' }
    } catch (e: any) {
      const out = e.stdout || e.message
      return { success: true, output: out || '(无匹配)' }
    }
  },
})

commandRegistry.register({
  name: 'findstr',
  description: '在文件中搜索文本 (用法: /findstr <pattern> [file])',
  execute: async (args) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      if (!args.length) return { success: false, error: '用法: /findstr <pattern> [file]' }
      const pattern = args[0]
      const target = args[1] || process.cwd()
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      const results: string[] = []
      async function searchFile(filePath: string): Promise<void> {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const lines = content.split('\n')
          lines.forEach((line, idx) => {
            if (regex.test(line)) results.push(`${filePath}:${idx + 1}:${line}`)
          })
        } catch { /* skip unreadable files */ }
      }
      async function walk(dir: string): Promise<void> {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) await walk(full)
          else await searchFile(full)
        }
      }
      await walk(target)
      return { success: true, output: results.length ? results.join('\n') : '(无匹配)' }
    } catch (e: any) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'where',
  description: '查找可执行文件路径 (用法: /where <command>)',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      const name = args[0] || 'node'
      const result = execSync(`where "${name}"`, { encoding: 'utf-8', timeout: 10000 })
      return { success: true, output: result.trim() }
    } catch (e) {
      return { success: false, error: `未找到: ${args[0]}` }
    }
  },
})

commandRegistry.register({
  name: 'python',
  description: '执行 Python 代码 (用法: /python <code>)',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      if (!args.length) return { success: false, error: '用法: /python <code>' }
      const code = args.join(' ')
      const result = execSync(`python -c "${code}"`, { encoding: 'utf-8', timeout: 10000 })
      return { success: true, output: result.trim() }
    } catch (e: any) {
      const out = e.stdout || e.message
      return { success: true, output: out.trim() }
    }
  },
})

commandRegistry.register({
  name: 'python3',
  description: '执行 Python3 代码 (用法: /python3 <code>)',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      if (!args.length) return { success: false, error: '用法: /python3 <code>' }
      const code = args.join(' ')
      const result = execSync(`python3 -c "${code}"`, { encoding: 'utf-8', timeout: 10000 })
      return { success: true, output: result.trim() }
    } catch (e: any) {
      const out = e.stdout || e.message
      return { success: true, output: out.trim() }
    }
  },
})

commandRegistry.register({
  name: 'cat',
  description: '查看文件内容',
  execute: async (args) => {
    if (!args.length) return { success: false, error: '用法: /cat <文件路径>' }
    try {
      const fs = await import('fs')
      const content = await fs.promises.readFile(args[0], 'utf-8')
      return { success: true, output: content }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'tree',
  description: '目录树',
  execute: async () => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const cwd = process.cwd()

      async function buildTree(dir: string, prefix: string, depth: number): Promise<string[]> {
        if (depth > 2) return []
        let entries: fs.Dirent[]
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true })
        } catch {
          return []
        }
        const lines: string[] = []
        entries.forEach((entry, i) => {
          const isLast = i === entries.length - 1
          const connector = isLast ? '└── ' : '├── '
          const name = entry.isDirectory() ? `${entry.name}/` : entry.name
          lines.push(`${prefix}${connector}${name}`)
          if (entry.isDirectory() && depth < 2) {
            const nextPrefix = `${prefix}${isLast ? '    ' : '│   '}`
            lines.push(...buildTree(path.join(dir, entry.name), nextPrefix, depth + 1))
          }
        })
        return lines
      }

      const tree = await buildTree(cwd, '', 0)
      return { success: true, output: tree.join('\n') }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'echo',
  description: '输出文本',
  execute: async (args) => {
    return { success: true, output: args.join(' ') }
  },
})

commandRegistry.register({
  name: 'date',
  description: '当前日期时间',
  execute: async () => {
    return { success: true, output: new Date().toLocaleString('zh-CN') }
  },
})

commandRegistry.register({
  name: 'whoami',
  description: '当前用户',
  execute: async () => {
    return { success: true, output: process.env.USER || process.env.USERNAME || 'unknown' }
  },
})

commandRegistry.register({
  name: 'stats',
  description: '使用统计',
  execute: async () => {
    return { success: true, output: '统计功能需要完整引擎支持' }
  },
})

commandRegistry.register({
  name: 'config',
  description: '查看配置',
  execute: async () => {
    return { success: true, output: '配置功能需要完整引擎支持' }
  },
})

commandRegistry.register({
  name: 'model',
  description: '切换模型',
  execute: async (args) => {
    if (!args.length) return { success: false, error: '用法: /model <模型名称>' }
    return { success: true, output: `模型切换为: ${args[0]}` }
  },
})

commandRegistry.register({
  name: 'version',
  description: '显示版本',
  execute: async () => {
    try {
      const pkg = await import('../../../package.json', { assert: { type: 'json' } })
      return { success: true, output: `KX2Code v${(pkg as Record<string, string>).version}` }
    } catch {
      return { success: true, output: 'KX2Code v1.0.0' }
    }
  },
})

// ==================== 项目初始化 ====================

commandRegistry.register({
  name: 'init',
  description: '扫描当前项目并生成/更新 CLAUDE.md（项目说明文件）',
  execute: async (args) => runInit(args),
})

// ==================== 开发调试命令 ====================
// 仅 NODE_ENV=development 时可用

const isDev = process.env.NODE_ENV === 'development'

commandRegistry.register({
  name: 'test-tools',
  description: isDev ? '运行工具调用链路测试 (开发模式)' : '仅开发模式可用',
  execute: async () => {
    if (!isDev) {
      return { success: false, error: '此命令仅在开发模式下可用 (NODE_ENV=development)' }
    }
    try {
      const engineBridge = await import('../../main/engine-bridge')
      const results = await (engineBridge as any).runDirectToolTests()
      const lines = [
        `工具链路测试完成: ${results.passed}/${results.total} 通过`,
        results.failed > 0 ? `${results.failed} 个失败` : '全部通过',
        '',
        `passed: ${results.passed}`,
        `failed: ${results.failed}`,
        `total: ${results.total}`,
      ]
      return { success: results.failed === 0, output: lines.join('\n') }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'team',
  description: '多角色协作 (用法: /team <任务描述>)',
  execute: async (args) => {
    try {
      const { Team } = await import('../../main/agent/team/team')
      const team = new Team({
        mode: 'team',
        roles: [
          {
            id: 'lead',
            name: 'Team Leader',
            profile: 'Team Leader',
            goal: 'Coordinate team members and delegate tasks effectively',
            constraints: ['Always assign tasks to appropriate team members', 'Ensure task completion'],
          },
          {
            id: 'engineer',
            name: 'Engineer',
            profile: 'Software Engineer',
            goal: 'Implement solutions based on requirements',
            constraints: ['Write clean, maintainable code', 'Follow best practices'],
          },
        ],
        leadRole: 'lead',
        maxRounds: 3,
      })
      const result = await team.process(args.join(' ') || 'No task specified')
      return { success: true, output: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

// ==================== Git 命令 ====================

commandRegistry.register({
  name: 'git-status',
  description: 'Git 状态',
  execute: async () => {
    try {
      const { execSync } = await import('child_process')
      const result = execSync('git status --short', { encoding: 'utf-8', cwd: process.cwd() })
      return { success: true, output: result || '工作区干净' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'git-diff',
  description: 'Git 差异',
  execute: async () => {
    try {
      const { execSync } = await import('child_process')
      const result = execSync('git diff', { encoding: 'utf-8', cwd: process.cwd() })
      return { success: true, output: result || '无差异' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'git-log',
  description: 'Git 提交历史',
  execute: async (args) => {
    try {
      const { execSync } = await import('child_process')
      const count = args[0] || '10'
      const result = execSync(`git log --oneline -${count}`, { encoding: 'utf-8', cwd: process.cwd() })
      return { success: true, output: result || '无提交记录' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'git-branch',
  description: 'Git 分支',
  execute: async () => {
    try {
      const { execSync } = await import('child_process')
      const result = execSync('git branch -a', { encoding: 'utf-8', cwd: process.cwd() })
      return { success: true, output: result || '无分支' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

// ==================== 系统信息��令 ====================

commandRegistry.register({
  name: 'env',
  description: '环境变量',
  execute: async (args) => {
    const key = args[0]
    if (key) {
      return { success: true, output: process.env[key] || `未设置: ${key}` }
    }
    const envs = Object.entries(process.env).slice(0, 20).map(([k, v]) => `${k}=${v}`)
    return { success: true, output: envs.join('\n') }
  },
})

commandRegistry.register({
  name: 'ps',
  description: '进程列表',
  execute: async () => {
    try {
      const { execSync } = await import('child_process')
      const result = execSync('ps aux', { encoding: 'utf-8' })
      const lines = result.split('\n').slice(0, 20).join('\n')
      return { success: true, output: lines }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'memory',
  description: '内存使用',
  execute: async () => {
    const usage = process.memoryUsage()
    const lines = [
      `RSS: ${(usage.rss / 1024 / 1024).toFixed(1)} MB`,
      `Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      `Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
      `External: ${(usage.external / 1024 / 1024).toFixed(1)} MB`,
    ]
    return { success: true, output: lines.join('\n') }
  },
})

// ==================== 配置组管理命令 ====================

commandRegistry.register({
  name: 'login',
  description: '切换到指定配置组（用法: /login <name>）',
  execute: async (args) => {
    try {
      const { ProfileManager } = await import('../../main/profiles/manager')
      const pm = new ProfileManager()
      const name = args[0]
      if (!name) {
        const active = pm.getActive()
        const list = pm.list().map(p => `  ${p.name}${p === active ? ' *' : ''}  ${p.provider}  ${p.model}`).join('\n') || '(无配置组)'
        return { success: true, output: `当前配置组: ${active?.name ?? '(无)'}\n\n可用配置组:\n${list}` }
      }
      const result = pm.setActive(name)
      if (!result) {
        const names = pm.list().map(p => p.name).join(', ')
        return { success: false, error: `配置组 "${name}" 不存在。可用: ${names || '(无)'}` }
      }
      // 同步更新引擎配置
      const { getEngine } = await import('../core')
      const eng = getEngine()
      eng.updateConfig(pm.toEngineConfig(result))
      return { success: true, output: `已切换到配置组: ${name}\n  provider: ${result.provider}\n  baseUrl: ${result.baseUrl}\n  model: ${result.model}` }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'profiles',
  description: '列出所有配置组',
  execute: async () => {
    try {
      const { ProfileManager } = await import('../../main/profiles/manager')
      const pm = new ProfileManager()
      const active = pm.getActive()
      const lines = pm.list().map(p =>
        `  ${p.name}${p === active ? ' *' : ''}  ${p.provider}  ${p.baseUrl}  ${p.model}`
      )
      const current = active ? `\n当前: ${active.name}` : '\n当前: (无)'
      return { success: true, output: `配置组 (${pm.list().length}):\n${lines.join('\n') || '(无)'}${current}` }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'add-profile',
  description: '添加配置组（用法: /add-profile <name> <provider> <baseUrl> <apiKey> [model]）',
  execute: async (args) => {
    try {
      const { ProfileManager } = await import('../../main/profiles/manager')
      const pm = new ProfileManager()
      if (args.length < 4) {
        return { success: false, error: '用法: /add-profile <name> <provider> <baseUrl> <apiKey> [model]' }
      }
      const [name, provider, baseUrl, apiKey, model = 'gpt-4o'] = args
      pm.upsert({ name, provider: provider as 'openai' | 'anthropic' | 'custom', baseUrl, apiKey, model })
      return { success: true, output: `配置组 "${name}" 已添加\n  provider: ${provider}\n  baseUrl: ${baseUrl}\n  model: ${model}` }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

commandRegistry.register({
  name: 'del-profile',
  description: '删除配置组（用法: /del-profile <name>）',
  execute: async (args) => {
    try {
      const { ProfileManager } = await import('../../main/profiles/manager')
      const pm = new ProfileManager()
      const name = args[0]
      if (!name) return { success: false, error: '用法: /del-profile <name>' }
      if (!pm.remove(name)) return { success: false, error: `配置组 "${name}" 不存在` }
      return { success: true, output: `配置组 "${name}" 已删除` }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
})

// ==================== AI 代理命令占位 ====================
// 这些命令将通过 AI 代理执行，仅注册名称和描述

const aiAgentCommands: Array<{ name: string; description: string }> = [
  { name: 'commit', description: 'Git 提交' },
  { name: 'review', description: '代码审查' },
  { name: 'refactor', description: '代码重构' },
  { name: 'test', description: '生成测试' },
  { name: 'docs', description: '生成文档' },
  { name: 'fix', description: '修复 bug' },
  { name: 'explain', description: '解释代码' },
  { name: 'search', description: '代码搜索' },
  { name: 'docker', description: 'Docker 操作' },
  { name: 'deploy', description: '部署操作' },
  { name: 'migrate', description: '数据库迁移' },
  { name: 'analyze', description: '代码分析' },
]

for (const cmd of aiAgentCommands) {
  commandRegistry.register({
    name: cmd.name,
    description: cmd.description,
    execute: async (args) => {
      return {
        success: true,
        needsAgent: true,
        output: `[AI 代理] 命令 /${cmd.name} ${args.join(' ')} 已接收，将由 AI 执行。`,
      }
    },
  })
}


// ==================== AI 代理命令 ====================
// ponytail: 这些命令通过 AI 代理执行，有明确上限

commandRegistry.register({
  name: 'add-dir',
  description: '添加新的工作目录',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /add-dir 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'add-model',
  description: '将自定义模型添加到已保存的模型列表',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /add-model 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'code-reviewer',
  description: '代码审查专家 - 深度分析代码质量、安全性和最佳实践',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /code-reviewer 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'agents',
  description: '管理代理配置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /agents 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'agents-platform',
  description: '多代理编排平台 — 创建、管理和协调多个 AI 代理',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /agents-platform 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'api-debug',
  description: 'REST API 调试客户端 - Postman 风格的 API 测试工具',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /api-debug 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'api-test',
  description: 'API 测试 - 运行/批量运行/添加/列表/快速请求/历史/导出/集合导入/对比/状态/基准测试',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /api-test 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'auto',
  description: '项目无法编译、TypeScript 类型检查失败、构建流程中断',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /auto 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'auto-commit',
  description: 'Smart auto-commit - AI generates commit messages, supports conventional commits',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /auto-commit 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'auto-mode-reset',
  description: '重置自动模式配置为默认值 (更新日志 2.1.212)',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /auto-mode-reset 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'backfill-sessions',
  description: '扫描并恢复历史会话数据到当前工作区',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /backfill-sessions 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'background',
  description: '后台任务管理 - 运行/查看/终止/监控后台任务',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /background 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'backup',
  description: '备份当前会话数据到本地文件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /backup 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'backup-full',
  description: 'Full backup - create/restore/list/delete/export/import/clean/verify/diff',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /backup-full 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'batch-han',
  description: '批量汉化 TypeScript 文件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /batch-han 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'benchmark',
  description: '性能基准测试工具',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /benchmark 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'blame',
  description: 'Git Blame - 文件/作者统计/热力图/最近修改',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /blame 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'block-mode',
  description: '切换块状输出模式（为工具输出添加边框和折叠功能）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /block-mode 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'bookmark',
  description: '代码书签 - 标记和跳转到重要代码位置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /bookmark 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'branch',
  description: '在当前位置创建对话分支',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /branch 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'break-cache',
  description: '清除和重建提示/响应缓存，提供详细的缓存管理功能',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /break-cache 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'remote-control',
  description: '连接此终端以进行远程控制会话',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /remote-control 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'bridge',
  description: '本地终端会话管理系统（类似 tmux/screen，支持多会话持久化、多窗口面板、SSH 远程访问）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /bridge 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'btw',
  description: '询问快速侧面问题，不中断主对话',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /btw 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'buddy',
  description: '孵化编程伙伴 pet 抚摸, off 静音',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /buddy 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'bundle',
  description: 'Bundle - 体积/最大文件/类型/分析/优化/历史/趋势/配置/导出',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /bundle 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'cache',
  description: '缓存操作',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /cache 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'changelog',
  description: '查看 Claude Code 最新的更新和变更',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /changelog 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'changelog-gen',
  description: '变更日志 - 生成/历史/预览/保存/统计/类型/作者',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /changelog-gen 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'chrome',
  description: 'Claude in Chrome 设置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /chrome 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'cmd',
  description: '搜索和浏览可用命令',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /cmd 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'code-health',
  description: '代码健康检查 - 文件/复杂度/大小/文档/测试/重复/风格/安全/历史/基准',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /code-health 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'code-review-assistant',
  description: '智能代码审查助手（AI 审查 git diff）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /code-review-assistant 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'color',
  description: '设置此会话的提示栏颜色',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /color 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'compact',
  description: '清除对话历史但保留摘要在上下文中。可选：/compact [摘要指令]',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /compact 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'compare',
  description: '比较不同文件、分支或会话之间的差异',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /compare 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'complete',
  description: '${c.image} (${c.status})',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /complete 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'conflict',
  description: '合并冲突 - 列出/显示/解决(ours/theirs/both)/中止/继续',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /conflict 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'context',
  description: '以彩色网格可视化当前上下文使用情况',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /context 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'context-collapse',
  description: '折叠/展开对话上下文中的非关键部分以释放空间',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /context-collapse 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'contributors',
  description: '贡献者分析 - 列表/图表/文件/趋势/邮箱/全部',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /contributors 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'copy',
  description: '将 Claude 的最后一次响应复制到剪贴板（或 /copy N 复制第 N 条最新响应）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /copy 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'copy-page',
  description: '将当前页面或选中的内容复制为 Markdown 格式',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /copy-page 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'cost',
  description: '显示当前会话的成本和持续时间（支持 --by-model / --by-type / --trend / --export）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /cost 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'cost-history',
  description: '查看 API 成本历史记录与趋势（按会话/模型/时间）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /cost-history 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'cron',
  description: '管理 cron 定时任务',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /cron 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'custom-cmd',
  description: '管理自定义斜杠命令',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /custom-cmd 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'dashboard',
  description: '用量仪表盘 - 打开用量分析仪表盘',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /dashboard 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'database',
  description: '查看和操作数据库中存储的数据',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /database 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'db-migrate',
  description: '数据库迁移 - 状态/执行/回滚/创建/应用/验证/重置/历史/生成',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /db-migrate 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'dead-code',
  description: '死代码检测 - 静态/工具/导出/导入/函数/类/统计/历史/导出',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /dead-code 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'debug-tool-call',
  description: '调试和诊断工具调用，查看详细日志与分析',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /debug-tool-call 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'dependency-analyzer',
  description: '依赖分析工具',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /dependency-analyzer 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'dev',
  description: '部署 - 多环境/历史/健康/回滚/检查/配置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /dev 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'deps',
  description: '依赖管理 - 状态/过期/更新/添加/移除/审计',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /deps 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'deps-viz',
  description: '分析代码库依赖关系和文件拓扑结构，生成依赖图',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /deps-viz 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'desktop',
  description: '在 Claude Desktop 中继续当前会话',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /desktop 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'diagram',
  description: '架构图自动生成（C4/依赖/序列/类图，Mermaid/Graphviz/ASCII）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /diagram 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'diff',
  description: '查看未提交的更改和每次对话的差异',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /diff 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'diff-mode',
  description: '并排差异视图 - 多模式/评论/书签/历史/导出/统计/三向合并',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /diff-mode 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'diff-review',
  description: '交互式 Diff 审查 - 逐 hunk 审查/暂存/比较 git diff',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /diff-review 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'sandbox-docker',
  description: 'Docker 沙箱隔离：在容器内运行 Agent（OpenHands/Devin 风格）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /sandbox-docker 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'doctor',
  description: '诊断并验证您的 Claude Code 安装和设置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /doctor 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'documentation-index',
  description: '获取 Claude Code 文档索引，发现所有可用页面',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /documentation-index 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'doge-config',
  description: '管理 doge 配置（API 地址、密钥、模型等）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /doge-config 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'duplicate',
  description: '重复代码检测 - 列表/文件/比例/配置/历史/导出/建议',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /duplicate 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'eco',
  description: 'Bash 输出压缩模式：减少 token 消耗（on/off/status）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /eco 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'effort',
  description: '设置模型使用时的努力级别',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /effort 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'env-diff',
  description: '环境变量对比 - 比较/缺失/多余/共享/模板/验证/同步/导出/导入',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /env-diff 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'errors',
  description: '错误监控 - 扫描/追踪/自动修复/模式/导出',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /errors 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'event-stream',
  description: '连接并接收 Server-Sent Events (SSE) 事件流',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /event-stream 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'ship',
  description: '完整部署工作流',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /ship 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'excel',
  description: 'Excel 文件读取与转换：read/info/sheets/csv',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /excel 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'export',
  description: '将当前对话导出到文件或剪贴板',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /export 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'extra-usage',
  description: '配置额外用量以在达到限制时继续工作',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /extra-usage 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'feedback',
  description: '提交关于 Claude Code 的反馈',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /feedback 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'file-history',
  description: '文件历史 - 变更/对比/恢复/作者/趋势',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /file-history 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'file-search',
  description: '文件搜索 - 正则/搜索/统计/文件/替换/grep/rg/上下文',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /file-search 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'file-watcher',
  description: '监听文件变化并执行相应操作',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /file-watcher 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'files',
  description: '列出当前上下文中的所有文件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /files 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'Prettier',
  description: '格式化器 - 检查/修复/全部/差异/统计/历史/配置/安装/语言',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /Prettier 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'focus',
  description: '切换焦点模式 — 仅显示最终回复，隐藏中间工具调用过程',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /focus 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'fork',
  description: '分支子代理 — 在后台派生子代理执行任务，完成后通知',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /fork 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'fuck',
  description: '清除本地 Claude Code 认证、自定义 API 配置和会话历史',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /fuck 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'game',
  description: '玩一个简单的猜数字游戏',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /game 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'getting-started',
  description: '快速入门 Claude Code 的交互式指南',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /getting-started 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'git-graph',
  description: 'Git 图表 - 统计/作者/时间线/热门文件/波动/活跃度/连续提交/洞察',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /git-graph 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'glossary',
  description: '显示术语表和定义',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /glossary 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'good-claude',
  description: '给 Claude 发送正面反馈，帮助改进 AI 能力',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /good-claude 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'graph',
  description: '依赖关系图 - mermaid/dot/html/stats/circular/orphans/tree/save',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /graph 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'graphql',
  description: '执行 GraphQL 查询',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /graphql 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'heapdump',
  description: '将 JS 堆转储到桌面',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /heapdump 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'hooks',
  description: '查看工具事件挂钩配置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /hooks 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'security',
  description: '安全头部 + 保护敏感文件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /security 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'http',
  description: '发送 HTTP 请求并查看响应结果',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /http 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'ide',
  description: '管理 IDE 集成并显示状态',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /ide 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'image',
  description: '图片信息查看与管理：info/ls/convert',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /image 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'import-map',
  description: '导入映射图 - stats/circular/orphans/external/dot/mermaid/depth/save',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /import-map 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'imports',
  description: 'Import management - analyze/unused/organize/sort/convert/circular/graph',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /imports 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'insights',
  description: '生成分析你的 Claude Code 会话模式的报告',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /insights 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'install-feishu-app',
  description: '安装飞书应用以启用远程控制',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /install-feishu-app 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'install-github-app',
  description: '为仓库设置 Claude GitHub Actions',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /install-github-app 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'install-slack-app',
  description: '安装 Claude Slack 应用',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /install-slack-app 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'issue',
  description: '修复 GitHub Issue #${issue.number}: ${issue.title}',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /issue 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'k8s',
  description: 'Kubernetes 集群管理：pods/deploy/svc/get/describe/logs',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /k8s 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'keybindings',
  description: '打开或创建按键绑定配置文件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /keybindings 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'less-permission-prompts',
  description: '扫描会话，生成权限白名单',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /less-permission-prompts 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'license',
  description: 'License - list/check/audit/report/generate/templates/allow/restrict/history',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /license 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'lighthouse',
  description: 'Lighthouse - run/report/compare/trend/history/budgets/export/categories',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /lighthouse 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'logger',
  description: '查看和配置日志记录级别',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /logger 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'logout',
  description: '退出您的 Anthropic 账户',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /logout 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'logs',
  description: '日志查看器 - tail/follow/search/filter/stats/pm2/docker/nginx',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /logs 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mcp',
  description: '管理 MCP 服务器',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mcp 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mcp-config',
  description: '管理 MCP 服务器配置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mcp-config 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mcp-discovery',
  description: 'MCP Server 发现 - 分析项目并推荐合适的 MCP servers',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mcp-discovery 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mcp-tool-search',
  description: '搜索 MCP 工具',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mcp-tool-search 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'memory-bank',
  description: '项目 Memory Bank - 结构化知识管理（上下文/决策/经验/参考）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /memory-bank 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'memory-monitor',
  description: '内存监控工具，实时监控应用内存使用情况',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /memory-monitor 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'memory-search',
  description: '跨会话记忆搜索 - 高级过滤/正则/知识图谱/导出/统计',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /memory-search 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'metrics',
  description: '显示系统性能指标和统计数据',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /metrics 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mobile',
  description: '显示二维码以下载 Claude 移动应用',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mobile 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'mock-limits',
  description: '模拟 API 速率限制，用于开发与测试',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /mock-limits 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'monitor',
  description: '启动实时监控界面',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /monitor 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'nginx',
  description: 'Nginx 管理：status/start/stop/reload/test/sites/logs/config',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /nginx 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'notebook',
  description: '记事本 - 创建、查看、搜索和管理笔记',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /notebook 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'notes',
  description: '快速笔记 - 列表/添加/查看/编辑/删除/搜索/置顶/标签/导出/导入',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /notes 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'notify',
  description: '通知 - 规则/事件/历史/Webhook',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /notify 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'oauth-refresh',
  description: '刷新 OAuth 认证令牌',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /oauth-refresh 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'outdated',
  description: '过期依赖 - 大版本/小版本/补丁/安全/安全更新/全部更新/统计/历史',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /outdated 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'output-style',
  description: '已弃用：使用 /config 更改输出样式',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /output-style 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'pdf',
  description: 'PDF 文件读取与信息查看：read/info',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /pdf 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'peers',
  description: '查看同伴会话 — 列出团队成员、会话状态，或向队友发送消息',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /peers 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'performance',
  description: '${f.lines} lines',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /performance 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'performance-profiler',
  description: '性能分析工具，检测应用性能瓶颈',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /performance-profiler 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'permissions',
  description: '管理允许和拒绝工具权限规则',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /permissions 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'plan',
  description: '启用计划模式或查看当前会话计划',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /plan 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'plan-mode',
  description: '切换计划模式，在生成前先制定详细计划',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /plan-mode 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'plugin',
  description: '管理 Claude Code 插件',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /plugin 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'ports',
  description: '端口管理 - 列出/检查/终止/查找/监控',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /ports 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'powerup',
  description: '与 Claude Code 交互式学习新功能',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /powerup 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'pr-review',
  description: 'GitHub PR 审查 - 摘要/问题/清单/批准/评论',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /pr-review 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'pr-comments',
  description: '获取 GitHub 拉取请求的评论',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /pr-comments 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'privacy-settings',
  description: '查看和更新您的隐私设置',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /privacy-settings 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'proactive',
  description: '主动建议 - 扫描问题与改进/自动修复/忽略规则/趋势报告',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /proactive 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'project-purge',
  description: '删除项目的所有 Claude Code 状态',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /project-purge 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'project-stats',
  description: '项目统计 - 全部/文件/行数/git/贡献者/活动/大小/健康/导出',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /project-stats 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'prompt-diff',
  description: '显示系统提示词变更差异（设置修改前后的对比）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /prompt-diff 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'queue',
  description: '管理消息队列',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /queue 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rag',
  description: 'RAG 本地知识库 - 索引文件夹和搜索',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rag 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rate-limit-options',
  description: '显示达到速率限制时的选项',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rate-limit-options 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'readme',
  description: 'README - 生成/预览/保存/徽章/目录/检查/更新/章节',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /readme 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'redis',
  description: 'Redis 缓存操作：get/set/del/keys/ping/info/flush',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /redis 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'reflect',
  description: '反思当前会话状态和项目环境，提供改进建议',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /reflect 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'release',
  description: '发布管理 - 版本提升/说明/变更日志/标签/创建/发布',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /release 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'release-notes',
  description: '查看发布说明',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /release-notes 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'reload-plugins',
  description: '在当前会话中激活待处理的插件更改',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /reload-plugins 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'remote-env',
  description: '配置远程会话的默认远程环境',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /remote-env 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'web-setup',
  description: '在网页上设置 Claude Code（需要连接您的 GitHub 账户）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /web-setup 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'remove-model',
  description: '从已保存的模型列表中移除自定义模型',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /remove-model 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rename',
  description: '重命名当前对话',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rename 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'resume',
  description: '恢复之前的对话',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /resume 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rewind',
  description: '将代码和/或对话恢复到先前的状态',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rewind 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'default',
  description: '标准模板 - 允许所有，拦截私有路径',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /default 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rstk',
  description: '重置 token 统计数据（清空所有已累计的 token 数值）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rstk 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'rules',
  description: '持久化规则管理 - 管理跨会话的 AI 交互指令',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /rules 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'scaffold',
  description: '由 doge scaffold 生成',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /scaffold 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'schedule',
  description: '管理定时调度任务',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /schedule 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'security-audit',
  description: '静态安全审计工具 - 检测 SQL 注入、XSS、硬编码密钥等',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /security-audit 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'session',
  description: '显示远程会话 URL 和二维码',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /session 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'share',
  description: '分享当前会话到团队或生成可分享链接',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /share 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'shell',
  description: '在一个新的 shell 中执行命令',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /shell 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'sitemap',
  description: 'Sitemap - generate/scan/preview/robots/validate/submit/config/base-url',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /sitemap 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'skills',
  description: '列出可用的技能',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /skills 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'skills-i18n',
  description: '检查并修复 SKILL.md 汉化问题。用法: /skills-i18n [check|fix|force|restore]',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /skills-i18n 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'snapshot',
  description: '创建或恢复会话快照',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /snapshot 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'snippet',
  description: '代码片段管理 - 保存、搜索、使用和分享代码片段',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /snippet 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'ssh',
  description: 'SSH 管理器 - 列出/添加/连接/执行/复制/密钥/测试/日志',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /ssh 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'status',
  description: '显示 Claude Code 状态，包括版本、模型、账户、API 连接性和工具状态',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /status 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'stickers',
  description: '订购 Claude Code 贴纸',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /stickers 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'stock',
  description: '股票行情 - 实时行情/技术分析/自选股/投资组合/筛选/图表/提醒',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /stock 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'summary',
  description: '总结当前会话内容和关键决策',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /summary 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'swe-fix',
  description: 'SWE-bench 风格测试驱动修复：定位→修复→验证闭环（吸收自 Agentless）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /swe-fix 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'symbol',
  description: '符号导航（高级） - 查找/定义/重命名/预览/提取/内联/用法/图谱/备份/恢复',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /symbol 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'tag',
  description: '为当前会话切换可搜索标签',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /tag 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'task',
  description: '快速创建简单任务（简化版任务创建）',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /task 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'task-create',
  description: '任务管理: 创建|list|done|delete|pause|resume|cancel|subtask|info|start|clear-done',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /task-create 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'tasks',
  description: '列出和管理后台任务',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /tasks 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'tc',
  description: '测试覆盖率 - 运行/报告/显示/缺失/趋势/徽章/HTML/JSON/阈值',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /tc 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'team',
  description: '团队管理命令',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /team 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'team-onboarding',
  description: '为团队成员生成 Claude Code 快速上手指南',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /team-onboarding 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'react-ts',
  description: 'React + TypeScript + Vite starter',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /react-ts 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'terminal',
  description: '打开新终端标签页',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /terminal 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'test-run',
  description: '测试运行器 - 运行/监视/覆盖率/调试/快照/耗时/框架',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /test-run 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'theme',
  description: '更改主题',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /theme 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'think-back',
  description: '您的 2025 Claude Code 年度回顾',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /think-back 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'thinkback-play',
  description: '播放 thinkback 动画',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /thinkback-play 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'todo',
  description: '任务管理工具 - 创建/查看/完成/暂停/恢复/搜索/导出',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /todo 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'translate',
  description: '翻译工具 - 文本/文件/批量翻译',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /translate 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'tui',
  description: '切换到闪烁免模式 (flicker-free) 的全屏终端界面',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /tui 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'updateapikey',
  description: '从 GitHub 更新免费 API Key 到 freeN 配置文件中',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /updateapikey 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'updateskills',
  description: '从素材库安装/更新技能 — /updateskills all / source:<name> / conflict',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /updateskills 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'upgrade',
  description: '升级到 Max 以获得更高的速率限制和更多 Opus',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /upgrade 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'usage',
  description: '显示计划用量限制',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /usage 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'vim',
  description: '在 Vim 和普通编辑模式之间切换',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /vim 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'voice',
  description: '切换语音模式',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /voice 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'watch',
  description: '文件监视 - 快照/检查/扫描/状态/日志/清空/配置/自动操作',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /watch 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'websocket',
  description: '通过 WebSocket 连接与服务器实时通信',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /websocket 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'api-doc',
  description: '项目 Wiki 生成 - 架构/API/文档/变更日志/依赖图/模板/搜索',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /api-doc 命令需要 AI 执行`,
    }
  },
})

commandRegistry.register({
  name: 'workflows',
  description: '管理工作流脚本 — 创建、列出、运行和删除可复用任务序列',
  execute: async () => {
    return {
      success: true,
      needsAgent: true,
      output: `[AI 代理] /workflows 命令需要 AI 执行`,
    }
  },
})

// Total AI agent commands: 210
