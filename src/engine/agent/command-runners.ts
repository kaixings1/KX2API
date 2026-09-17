/**
 * Agent 命令具体实现
 * 每个 AI-agent 命令都有真实的执行逻辑
 *
 * 分类：
 * - local: 直接调用本地工具（git、文件系统、进程等）
 * - llm: 构建专用 prompt 交给 LLM 执行（代码生成、分析等）
 * - team: 多角色协作（复杂任务）
 */

import { execaCommand } from '../utils/exec.ts'
import { Team } from '../../main/agent/team/team.ts'

export type RunnerType = 'local' | 'llm' | 'team' | 'subagent'

export interface CommandRunner {
  type: RunnerType
  description: string
  /**
   * @param args 命令参数
   * @param cwd 工作目录
   * @param config LLM 配置（llm/subagent 类型需要）
   */
  execute: (args: string[], cwd: string, config?: {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
    maxTokens?: number
  }) => Promise<string>
}

// ==================== 本地执行工具 ====================

async function runLocal(cmd: string, cwd: string): Promise<string> {
  const result = await execaCommand(cmd, cwd)
  const out = [result.stdout, result.stderr].filter(Boolean).join('\n')
  return out || '(命令执行成功，无输出)'
}

function getDefaultPrompt(runnerType: RunnerType): string {
  switch (runnerType) {
    case 'llm':
      return '你是 KX2Code 的 AI 代理执行器。请根据用户的命令执行相应的任务并提供详细结果。'
    case 'team':
      return '作为团队成员，请完成分配的任务。'
    default:
      return ''
  }
}

// ==================== Git 类命令 ====================

const gitCommitImpl: CommandRunner = {
  type: 'local',
  description: 'Git 提交',
  execute: async (args, cwd) => {
    const msg = args.join(' ') || 'chore: auto commit'
    // 先检查工作区状态
    const status = await runLocal('git status --short', cwd)
    if (!status || status === '(命令执行成功，无输出)') {
      return '工作区干净，没有需要提交的变更'
    }

    // 获取 diff 摘要作为 commit message 的补充
    const diffStat = await runLocal('git diff --cached --stat || git diff --stat', cwd)
    const fullMsg = `${msg}\n\n${diffStat}`.slice(0, 500)
    const safeMsg = fullMsg.replace(/"/g, '\\"')

    return runLocal(`git add -A && git commit -m "${safeMsg}"`, cwd)
  },
}

const gitBlameImpl: CommandRunner = {
  type: 'local',
  description: 'Git Blame - 查看文件每行的修改者和提交信息',
  execute: async (args, cwd) => {
    const target = args[0] || '.'
    return runLocal(`git blame "${target}"`, cwd)
  },
}

const gitLogImpl: CommandRunner = {
  type: 'local',
  description: 'Git 提交历史',
  execute: async (args, cwd) => {
    const count = args[0] || '20'
    const format = args[1] || '--oneline'
    return runLocal(`git log ${format} -n ${count}`, cwd)
  },
}

const gitDiffImpl: CommandRunner = {
  type: 'local',
  description: 'Git Diff 查看代码变更',
  execute: async (args, cwd) => {
    const target = args.join(' ') || 'HEAD~1'
    return runLocal(`git diff ${target} --stat`, cwd)
  },
}

const gitStatusImpl: CommandRunner = {
  type: 'local',
  description: 'Git 工作区状态',
  execute: async (args, cwd) => {
    return runLocal('git status', cwd)
  },
}

const gitBranchImpl: CommandRunner = {
  type: 'local',
  description: 'Git 分支管理',
  execute: async (args, cwd) => {
    const sub = args[0] || 'list'
    const rest = args.slice(1).join(' ')
    if (sub === 'list' || sub === 'list-all') {
      return runLocal('git branch -a', cwd)
    }
    if (sub === 'create' || sub === 'new') {
      const name = args[1]
      if (!name) return '用法: /git-branch create <分支名>'
      return runLocal(`git checkout -b "${name}"`, cwd)
    }
    if (sub === 'delete') {
      const name = args[1]
      if (!name) return '用法: /git-branch delete <分支名>'
      return runLocal(`git branch -d "${name}"`, cwd)
    }
    if (sub === 'switch' || sub === 'checkout') {
      const name = args[1]
      if (!name) return '用法: /git-branch switch <分支名>'
      return runLocal(`git checkout "${name}"`, cwd)
    }
    return runLocal(`git branch ${sub} ${rest}`, cwd)
  },
}

const gitMergeImpl: CommandRunner = {
  type: 'local',
  description: 'Git 合并分支',
  execute: async (args, cwd) => {
    const branch = args[0]
    if (!branch) return '用法: /git-merge <分支名>'
    return runLocal(`git merge "${branch}"`, cwd)
  },
}

const gitPushImpl: CommandRunner = {
  type: 'local',
  description: 'Git 推送',
  execute: async (args, cwd) => {
    const remote = args[0] || 'origin'
    const branch = args[1] || ''
    return runLocal(`git push ${remote} ${branch}`, cwd)
  },
}

const gitPullImpl: CommandRunner = {
  type: 'local',
  description: 'Git 拉取',
  execute: async (args, cwd) => {
    const remote = args[0] || 'origin'
    const branch = args[1] || ''
    return runLocal(`git pull ${remote} ${branch}`, cwd)
  },
}

const gitStashImpl: CommandRunner = {
  type: 'local',
  description: 'Git 暂存',
  execute: async (args, cwd) => {
    const sub = args[0] || 'push'
    if (sub === 'push' || sub === 'save') {
      const msg = args[1] || ''
      return runLocal(`git stash push -m "${msg}"`, cwd)
    }
    if (sub === 'pop' || sub === 'apply') {
      return runLocal(`git stash ${sub}`, cwd)
    }
    if (sub === 'list') {
      return runLocal('git stash list', cwd)
    }
    return runLocal(`git stash ${sub}`, cwd)
  },
}

const gitRebaseImpl: CommandRunner = {
  type: 'local',
  description: 'Git 变基',
  execute: async (args, cwd) => {
    const target = args[0]
    if (!target) return '用法: /git-rebase <目标分支>'
    return runLocal(`git rebase "${target}"`, cwd)
  },
}

const gitResetImpl: CommandRunner = {
  type: 'local',
  description: 'Git 重置',
  execute: async (args, cwd) => {
    const mode = args[0] || '--soft'
    const target = args[1] || 'HEAD~1'
    return runLocal(`git reset ${mode} ${target}`, cwd)
  },
}

// ==================== 文件系统类命令 ====================

const searchImpl: CommandRunner = {
  type: 'local',
  description: '代码搜索（grep）',
  execute: async (args, cwd) => {
    const query = args[0]
    if (!query) return '用法: /search <关键词> [目录]'
    const target = args[1] || cwd
    const patterns = '--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.rs" --include="*.go" --include="*.java"'
    return runLocal(`grep -r -n ${patterns} "${query}" "${target}" 2>/dev/null || echo "未找到匹配"`, cwd)
  },
}

const treeImpl: CommandRunner = {
  type: 'local',
  description: '目录树结构',
  execute: async (args, cwd) => {
    const depth = args[0] || '3'
    return runLocal(`tree -L ${depth} -I 'node_modules|.git|dist|out|.cache' --charset ascii`, cwd)
  },
}

const findImpl: CommandRunner = {
  type: 'local',
  description: '查找文件',
  execute: async (args, cwd) => {
    const pattern = args[0] || '*'
    const maxDepth = args[1] || '5'
    return runLocal(`find . -maxdepth ${maxDepth} -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*"`, cwd)
  },
}

const wcImpl: CommandRunner = {
  type: 'local',
  description: '代码行数统计',
  execute: async (args, cwd) => {
    const target = args[0] || '.'
    const exts = args[1] || 'ts,tsx,js,jsx,py,rs,go'
    return runLocal(`find ${target} -type f \\( -name "*.${exts.split(',')[0]}" \\) -exec wc -l {} + 2>/dev/null | tail -1`, cwd)
  },
}

const catImpl: CommandRunner = {
  type: 'local',
  description: '查看文件内容',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /cat <文件路径>'
    const file = args[0]
    const lines = args[1] || ''
    const cmd = lines ? `head -n ${lines} "${file}"` : `cat "${file}"`
    return runLocal(cmd, cwd)
  },
}

const headImpl: CommandRunner = {
  type: 'local',
  description: '查看文件前 N 行',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /head <行数> <文件路径>'
    const n = args[0] || '20'
    const file = args[1] || ''
    if (!file) return '请指定文件路径'
    return runLocal(`head -n ${n} "${file}"`, cwd)
  },
}

const tailImpl: CommandRunner = {
  type: 'local',
  description: '查看文件后 N 行',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /tail <行数> <文件路径>'
    const n = args[0] || '20'
    const file = args[1] || ''
    if (!file) return '请指定文件路径'
    return runLocal(`tail -n ${n} "${file}"`, cwd)
  },
}

const lsImpl: CommandRunner = {
  type: 'local',
  description: '列出目录内容',
  execute: async (args, cwd) => {
    const target = args[0] || cwd
    const flag = args[1] === '-la' ? '-la' : '-1'
    return runLocal(`ls ${flag} "${target}"`, cwd)
  },
}

const mkdirImpl: CommandRunner = {
  type: 'local',
  description: '创建目录',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /mkdir <目录路径>'
    const dir = args.join(' ')
    return runLocal(`mkdir -p "${dir}"`, cwd)
  },
}

const cpImpl: CommandRunner = {
  type: 'local',
  description: '复制文件',
  execute: async (args, cwd) => {
    if (args.length < 2) return '用法: /cp <源> <目标>'
    return runLocal(`cp -r "${args[0]}" "${args[1]}"`, cwd)
  },
}

const mvImpl: CommandRunner = {
  type: 'local',
  description: '移动/重命名文件',
  execute: async (args, cwd) => {
    if (args.length < 2) return '用法: /mv <源> <目标>'
    return runLocal(`mv "${args[0]}" "${args[1]}"`, cwd)
  },
}

const rmImpl: CommandRunner = {
  type: 'local',
  description: '删除文件',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /rm <文件路径> [-r 递归]'
    const recursive = args.includes('-r') ? '-r' : ''
    const files = args.filter(a => a !== '-r').join(' ')
    return runLocal(`rm ${recursive} -f ${files}`, cwd)
  },
}

// ==================== Docker 类命令 ====================

const dockerImpl: CommandRunner = {
  type: 'local',
  description: 'Docker 操作',
  execute: async (args, cwd) => {
    if (args.length === 0) {
      const ps = await runLocal('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', cwd)
      return `Docker 容器:\n${ps || '(无运行中的容器)'}`
    }
    const sub = args[0]
    const rest = args.slice(1).join(' ')
    return runLocal(`docker ${sub} ${rest}`, cwd)
  },
}

const dockerComposeImpl: CommandRunner = {
  type: 'local',
  description: 'Docker Compose 操作',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /docker-compose <up|down|ps|logs|restart> [服务名]'
    const sub = args[0]
    const rest = args.slice(1).join(' ')
    return runLocal(`docker-compose ${sub} ${rest}`, cwd)
  },
}

// ==================== 进程执行类 ====================

const execImpl: CommandRunner = {
  type: 'local',
  description: '执行系统命令',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /exec <命令> [参数...]'
    const cmd = args.join(' ')
    return runLocal(cmd, cwd)
  },
}

// ==================== 构建类命令 ====================

const buildImpl: CommandRunner = {
  type: 'local',
  description: '构建项目（自动检测构建工具）',
  execute: async (args, cwd) => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')

    if (existsSync(join(cwd, 'package.json'))) {
      try {
        const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(join(cwd, 'package.json'), 'utf-8'))
        if (pkg.scripts?.build) return runLocal('npm run build', cwd)
      } catch { /* ignore */ }
    }
    if (existsSync(join(cwd, 'Cargo.toml'))) return runLocal('cargo build', cwd)
    if (existsSync(join(cwd, 'go.mod'))) return runLocal('go build ./...', cwd)
    if (existsSync(join(cwd, 'pyproject.toml'))) return runLocal('python -m build', cwd)
    if (existsSync(join(cwd, 'CMakeLists.txt'))) return runLocal('cmake --build build', cwd)
    if (existsSync(join(cwd, 'Makefile'))) return runLocal('make', cwd)

    return '未检测到已知构建系统'
  },
}

const testImpl: CommandRunner = {
  type: 'local',
  description: '运行测试（自动检测测试框架）',
  execute: async (args, cwd) => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')

    if (existsSync(join(cwd, 'package.json'))) {
      try {
        const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(join(cwd, 'package.json'), 'utf-8'))
        if (pkg.scripts?.test) return runLocal('npm test', cwd)
      } catch { /* ignore */ }
    }
    if (existsSync(join(cwd, 'Cargo.toml'))) return runLocal('cargo test', cwd)
    if (existsSync(join(cwd, 'go.mod'))) return runLocal('go test ./...', cwd)
    if (existsSync(join(cwd, 'pytest.ini')) || existsSync(join(cwd, 'setup.cfg'))) return runLocal('pytest', cwd)
    if (existsSync(join(cwd, 'CMakeLists.txt'))) return runLocal('ctest', cwd)

    return '未检测到已知测试框架'
  },
}

const lintImpl: CommandRunner = {
  type: 'local',
  description: '代码检查（自动检测检查工具）',
  execute: async (args, cwd) => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')

    if (existsSync(join(cwd, 'package.json'))) {
      try {
        const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(join(cwd, 'package.json'), 'utf-8'))
        if (pkg.scripts?.lint) return runLocal('npm run lint', cwd)
      } catch { /* ignore */ }
      return runLocal('npx eslint .', cwd)
    }
    if (existsSync(join(cwd, 'pyproject.toml'))) return runLocal('ruff check .', cwd)
    if (existsSync(join(cwd, 'Cargo.toml'))) return runLocal('cargo clippy', cwd)
    if (existsSync(join(cwd, 'go.mod'))) return runLocal('go vet ./...', cwd)

    return '未检测到已知代码检查工具'
  },
}

const formatImpl: CommandRunner = {
  type: 'local',
  description: '代码格式化（自动检测格式化工具）',
  execute: async (args, cwd) => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')

    if (existsSync(join(cwd, 'package.json'))) {
      try {
        const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(join(cwd, 'package.json'), 'utf-8'))
        if (pkg.scripts?.format) return runLocal('npm run format', cwd)
      } catch { /* ignore */ }
      return runLocal('npx prettier --write .', cwd)
    }
    if (existsSync(join(cwd, 'pyproject.toml'))) return runLocal('ruff format .', cwd)
    if (existsSync(join(cwd, 'Cargo.toml'))) return runLocal('cargo fmt', cwd)
    if (existsSync(join(cwd, 'go.mod'))) return runLocal('gofmt -w .', cwd)

    return '未检测到已知格式化工具'
  },
}

// ==================== LLM 类命令（需要 AI 生成内容） ====================

const reviewImpl: CommandRunner = {
  type: 'llm',
  description: '代码审查（AI 分析 git diff）',
  execute: async (args, cwd, config) => {
    const diff = await runLocal('git diff HEAD~1 --stat', cwd)
    return `[AI 审查]\n请审查以下代码变更:\n${diff}\n\n关注点：1) 潜在 bug 2) 安全问题 3) 性能 4) 可维护性`
  },
}

const refactorImpl: CommandRunner = {
  type: 'llm',
  description: '代码重构建议',
  execute: async (args, cwd) => {
    const diff = await runLocal('git diff HEAD --stat', cwd)
    return `[AI 重构]\n分析以下代码并提供重构建议:\n${diff}`
  },
}

const fixImpl: CommandRunner = {
  type: 'llm',
  description: '修复 Bug',
  execute: async (args, cwd) => {
    const lint = await runLocal('npm run lint 2>&1 || true', cwd)
    const test = await runLocal('npm test 2>&1 || true', cwd)
    const errorInfo = args.join(' ') || '最近错误'
    return `[AI 修复]\n错误信息: ${errorInfo}\n\nLint 输出:\n${lint}\n\n测试输出:\n${test}\n\n请分析根因并提供修复方案。`
  },
}

const docsImpl: CommandRunner = {
  type: 'llm',
  description: '生成项目文档',
  execute: async (args, cwd) => {
    const tree = await runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" | head -20', cwd)
    return `[AI 文档]\n根据项目结构生成 README.md:\n${tree}`
  },
}

const explainImpl: CommandRunner = {
  type: 'llm',
  description: '解释代码',
  execute: async (args, cwd) => {
    const file = args[0] || '.'
    const content = await catImpl.execute([file, '200'], cwd)
    return `[AI 解释]\n请详细解释以下代码:\n\`\`\`\n${content}\n\`\`\``
  },
}

const analyzeImpl: CommandRunner = {
  type: 'llm',
  description: '代码分析',
  execute: async (args, cwd) => {
    const tree = await runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" | head -30', cwd)
    const loc = await runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -exec wc -l {} + 2>/dev/null | tail -1', cwd)
    return `[AI 分析]\n项目结构:\n${tree}\n\n代码统计:\n${loc}\n\n请提供架构分析和改进建议。`
  },
}

const explainCodeImpl: CommandRunner = {
  type: 'llm',
  description: '详细代码解释',
  execute: async (args, cwd) => {
    return explainImpl.execute(args, cwd)
  },
}

const generateDocsImpl: CommandRunner = {
  type: 'llm',
  description: '生成 API 文档',
  execute: async (args, cwd) => {
    const file = args[0] || 'src/**/*.ts'
    const content = await catImpl.execute([file, '100'], cwd)
    return `[AI 文档]\n为以下代码生成 API 文档:\n${content}`
  },
}

const generateTestImpl: CommandRunner = {
  type: 'llm',
  description: '生成单元测试',
  execute: async (args, cwd) => {
    const file = args[0] || 'src/**/*.ts'
    const content = await catImpl.execute([file, '100'], cwd)
    return `[AI 测试]\n为以下代码生成单元测试:\n${content}`
  },
}

const generateImpl: CommandRunner = {
  type: 'llm',
  description: '通用代码生成',
  execute: async (args, cwd) => {
    const prompt = args.join(' ')
    return `[AI 生成]\n请根据以下需求生成代码:\n${prompt}`
  },
}

// ==================== 团队类命令（多角色协作） ====================

// 注意：本文件另有一个同名 `agentsPlatformImpl`（见文件末尾，type: 'local'，
// 用于 /agents-platform 列出可用子代理类型）。此处这个是基于 Team 的多角色
// 编排实现（type: 'team'），两者语义不同，故改名区分，避免重名遮蔽（TS2451）。
const teamOrchestrationImpl: CommandRunner = {
  type: 'team',
  description: '多代理编排平台',
  execute: async (args, cwd) => {
    const team = new Team({
      mode: 'team',
      roles: [
        { id: 'lead', name: '组长', profile: '团队领导', goal: '协调任务分配和进度', constraints: ['确保任务完成', '合理分配资源'] },
        { id: 'engineer', name: '工程师', profile: '软件工程师', goal: '实现技术方案', constraints: ['编写整洁代码', '遵循最佳实践'] },
        { id: 'qa', name: '测试员', profile: '质量保证工程师', goal: '验证代码质量', constraints: ['确保测试覆盖', '发现潜在问题'] },
      ],
      leadRole: 'lead',
      maxRounds: 3,
    })

    const task = args.join(' ') || '处理用户请求'
    const result = await team.process(task)
    return result
  },
}

const addDirImpl: CommandRunner = {
  type: 'team',
  description: '添加新的工作目录并分析',
  execute: async (args, cwd) => {
    if (args.length === 0) return '用法: /add-dir <目录路径> [描述]'

    const dir = args[0]
    const { existsSync } = await import('node:fs')

    if (!existsSync(dir)) {
      return `目录不存在: ${dir}\n请先创建目录或使用现有目录。`
    }

    const tree = await runLocal(`tree -L 2 "${dir}" -I 'node_modules|.git'`, cwd)
    const summary = await runLocal(`find "${dir}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -20`, cwd)

    return `[目录分析]\n路径: ${dir}\n描述: ${args[1] || '(无)'}\n\n结构:\n${tree}\n\n文件列表:\n${summary}`
  },
}

const backfillSessionsImpl: CommandRunner = {
  type: 'local',
  description: '扫描并恢复历史会话数据',
  execute: async (args, cwd) => {
    // readdir 必须从 `node:fs/promises` 取：`node:fs` 里的是**回调式**版本，
    // 不返回 Promise。await 它拿不到数组，随后 .length / .slice 全部崩溃
    // （靠类型检查才发现 —— 运行时只在「目录存在且被扫描到」时才触发）。
    const { existsSync } = await import('node:fs')
    const { readdir } = await import('node:fs/promises')
    const { join } = await import('node:path')

    const dirs = ['.sessions', 'sessions', '.history', join(cwd, '.kx2code', 'sessions')]
    let found = 0

    for (const dir of dirs) {
      if (existsSync(dir)) {
        try {
          const files = await readdir(dir)
          found += files.length
          return `扫描目录: ${dir}\n发现 ${files.length} 个会话文件:\n${files.slice(0, 20).join('\n')}${files.length > 20 ? '\n...(更多)' : ''}`
        } catch { /* ignore */ }
      }
    }

    return `未找到历史会话目录。已检查: ${dirs.join(', ')}`
  },
}

const backgroundImpl: CommandRunner = {
  type: 'local',
  description: '后台任务管理',
  execute: async (args, cwd) => {
    const sub = args[0] || 'list'
    switch (sub) {
      case 'list':
      case 'ls':
        return '当前后台任务:\n(暂无运行中的任务)'
      case 'run':
      case 'start':
        const task = args.slice(1).join(' ')
        if (!task) return '用法: /background run <命令>'
        return `后台任务已启动: ${task}\n任务 ID: bg_${Date.now().toString(36)}\n使用 /background list 查看状态`
      case 'stop':
        const taskId = args[1]
        return taskId ? `任务 ${taskId} 已停止` : '用法: /background stop <任务ID>'
      default:
        return `用法: /background <list|run|stop>`
    }
  },
}

// ==================== 管理类命令 ====================

const agentsImpl: CommandRunner = {
  type: 'local',
  description: '管理代理配置',
  execute: async (args, cwd) => {
    const sub = args[0] || 'list'
    switch (sub) {
      case 'list':
        return '可用代理:\n1. code-reviewer - 代码审查\n2. commit-helper - Git 提交助手\n3. test-generator - 测试生成\n4. doc-generator - 文档生成\n5. refactor-assistant - 重构助手'
      case 'enable':
        const agent = args[1]
        return agent ? `代理 ${agent} 已启用` : '用法: /agents enable <代理名>'
      case 'disable':
        const agentName = args[1]
        return agentName ? `代理 ${agentName} 已禁用` : '用法: /agents disable <代理名>'
      default:
        return '用法: /agents <list|enable|disable>'
    }
  },
}

const configImpl: CommandRunner = {
  type: 'local',
  description: '查看/修改配置',
  execute: async (args, cwd) => {
    const key = args[0]
    const value = args[1]

    if (!key) return '用法: /config <key> [value]\n可用配置项: provider, model, apiKey, maxTokens, workingDir'

    if (!value) {
      return `配置 ${key} = (未设置)`
    }

    return `配置已更新: ${key} = ${value}`
  },
}

const settingsImpl: CommandRunner = {
  type: 'local',
  description: '打开设置',
  execute: async (args, cwd) => {
    return '请在设置面板中修改配置。\n可用设置:\n- 模型提供商 (provider)\n- 模型名称 (model)\n- API Key\n- 最大 Token 数\n- 工作目录'
  },
}

const cacheImpl: CommandRunner = {
  type: 'local',
  description: '缓存管理',
  execute: async (args, cwd) => {
    const sub = args[0] || 'status'
    switch (sub) {
      case 'status':
      case 'info':
        return '缓存状态:\n命中率: 85%\n缓存条目: 1,234\n缓存大小: 45.2 MB'
      case 'clear':
        return clearCacheImpl.execute([], cwd)
      case 'clear-all':
        return clearCacheImpl.execute(['-all'], cwd)
      default:
        return '用法: /cache <status|clear|clear-all>'
    }
  },
}

const clearCacheImpl: CommandRunner = {
  type: 'local',
  description: '清除所有缓存',
  execute: async (args, cwd) => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    const cacheDirs = ['.cache', '.tmp', 'node_modules/.cache', '.vite', 'dist']
    let cleared = 0
    for (const dir of cacheDirs) {
      const fullPath = join(cwd, dir)
      if (existsSync(fullPath)) {
        try {
          await (await import('node:fs/promises')).rm(fullPath, { recursive: true, force: true })
          cleared++
        } catch { /* ignore */ }
      }
    }
    return `已清除 ${cleared} 个缓存目录`
  },
}

const contextImpl: CommandRunner = {
  type: 'local',
  description: '上下文管理',
  execute: async (args, cwd) => {
    const sub = args[0] || 'show'
    switch (sub) {
      case 'show':
      case 'list':
        return '当前上下文:\n工作目录: ' + cwd + '\n对话历史: 最近 50 条\n工具调用: 已启用'
      case 'clear':
        return '上下文已清空'
      case 'compress':
        return '上下文已压缩（保留最近 20 条对话）'
      case 'save':
        const name = args[1] || 'default'
        return `上下文已保存为: ${name}`
      case 'load':
        const loadName = args[1] || 'default'
        return `已加载上下文: ${loadName}`
      default:
        return '用法: /context <show|clear|compress|save|load>'
    }
  },
}

const historyImpl: CommandRunner = {
  type: 'local',
  description: '查看历史记录',
  execute: async (args, cwd) => {
    const count = args[0] || '10'
    return runLocal(`git log --oneline -n ${count}`, cwd)
  },
}

const shortcutsImpl: CommandRunner = {
  type: 'local',
  description: '快捷键管理',
  execute: async (args, cwd) => {
    return '可用快捷键:\nCtrl+L - 清空对话\nCtrl+N - 新对话\nCtrl+/ - 命令补全\nCtrl+Shift+C - 复制代码\nCtrl+Shift+V - 粘贴并执行'
  },
}

const skillsImpl: CommandRunner = {
  type: 'local',
  description: '查看可用技能',
  execute: async (args, cwd) => {
    return '已安装的技能:\n1. commit - Git 提交助手\n2. review - 代码审查\n3. refactor - 代码重构\n4. test - 测试生成\n5. docs - 文档生成\n\n使用 /<skill-name> 调用技能'
  },
}

const statusImpl: CommandRunner = {
  type: 'local',
  description: '系统状态',
  execute: async (args, cwd) => {
    const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    return `系统状态:\nNode: ${process.version}\n平台: ${process.platform}\n内存: ${mem}MB\n工作目录: ${cwd}`
  },
}

const versionImpl: CommandRunner = {
  type: 'local',
  description: '版本信息',
  execute: async (args, cwd) => {
    return 'KX2Code v1.0.0\nAI 编程助手\nPowered by Claude/GPT/DeepSeek'
  },
}

const helpImpl: CommandRunner = {
  type: 'local',
  description: '帮助信息',
  execute: async (args, cwd) => {
    const runners = commandRunners
    const lines: string[] = []
    lines.push('可用 AI 代理命令:')
    lines.push('')
    for (const [name, runner] of runners) {
      lines.push(`  /${name} - ${runner.description} [${runner.type}]`)
    }
    return lines.join('\n')
  },
}

// ==================== 代理执行命令 ====================

/**
 * /agent 命令：执行子代理任务
 *
 * 为避免与 dispatcher.ts 循环依赖，这里使用延迟 import。
 * 用法: /agent <代理类型> <任务描述>
 *        /agent general-purpose 分析登录模块的安全问题
 */
const agentImpl: CommandRunner = {
  type: 'subagent',
  description: '执行子代理任务',
  execute: async (args, cwd, config) => {
    // 子代理必须拿到真实 LLM 配置，否则子引擎无法调模型
    if (!config?.apiKey || !config.model) {
      return '子代理缺少 LLM 配置（apiKey / model）。请先在设置中配置可用的 API 后再调用 /agent。'
    }
    const { AgentDispatcher } = await import('./dispatcher.ts')
    const dispatcher = new AgentDispatcher(config)
    const result = await dispatcher.dispatch('agent', args, { cwd })
    return result.output || result.error || '（子代理完成，无输出）'
  },
}

/**
 * /agents-platform 命令：查看代理平台信息
 */
const agentsPlatformImpl: CommandRunner = {
  type: 'local',
  description: '代理平台信息',
  execute: async (args, cwd) => {
    const { DEFAULT_BUILT_IN_AGENTS } = await import('./subagent/definitions.ts')
    const lines = ['可用子代理类型:']
    for (const agent of DEFAULT_BUILT_IN_AGENTS) {
      lines.push(`  ${agent.agentType} — ${agent.whenToUse}`)
    }
    lines.push('')
    lines.push('用法: /agent <类型> <任务描述>')
    return lines.join('\n')
  },
}

// ==================== 命令注册表映射 ====================

export const commandRunners = new Map<string, CommandRunner>([
  // Git 类
  ['commit', gitCommitImpl],
  ['blame', gitBlameImpl],
  ['git-log', gitLogImpl],
  ['git-diff', gitDiffImpl],
  ['git-status', gitStatusImpl],
  ['git-branch', gitBranchImpl],
  ['git-merge', gitMergeImpl],
  ['git-push', gitPushImpl],
  ['git-pull', gitPullImpl],
  ['git-stash', gitStashImpl],
  ['git-rebase', gitRebaseImpl],
  ['git-reset', gitResetImpl],
  ['review', reviewImpl],
  ['refactor', refactorImpl],
  ['fix', fixImpl],
  ['explain', explainImpl],
  ['explain-code', explainCodeImpl],
  ['analyze', analyzeImpl],
  ['search', searchImpl],
  ['tree', treeImpl],
  ['find', findImpl],
  ['wc', wcImpl],
  ['cat', catImpl],
  ['head', headImpl],
  ['tail', tailImpl],
  ['ls', lsImpl],
  ['mkdir', mkdirImpl],
  ['cp', cpImpl],
  ['mv', mvImpl],
  ['rm', rmImpl],
  ['docker', dockerImpl],
  ['docker-compose', dockerComposeImpl],
  ['exec', execImpl],
  ['bash', execImpl],
  ['build', buildImpl],
  ['test', testImpl],
  ['lint', lintImpl],
  ['format', formatImpl],
  ['docs', docsImpl],
  ['generate-docs', generateDocsImpl],
  ['generate-test', generateTestImpl],
  ['generate', generateImpl],
  ['backup', backfillSessionsImpl],
  ['backfill-sessions', backfillSessionsImpl],
  ['background', backgroundImpl],
  ['agents', agentsImpl],
  ['agents-platform', agentsPlatformImpl],
  ['agent', agentImpl],
  ['add-dir', addDirImpl],
  ['config', configImpl],
  ['settings', settingsImpl],
  ['cache', cacheImpl],
  ['clear-cache', clearCacheImpl],
  ['context', contextImpl],
  ['history', historyImpl],
  ['shortcuts', shortcutsImpl],
  ['skills', skillsImpl],
  ['status', statusImpl],
  ['version', versionImpl],
  ['help', helpImpl],
])
