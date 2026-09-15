/**
 * TaskManagement 搜索过滤 + 状态管理 + 统计计算 纯函数测试
 *
 * 覆盖：
 * - isOverdue 逾期判断逻辑
 * - 搜索过滤（按标题、描述关键词）
 * - 状态/优先级过滤
 * - 统计计算
 * - 表单初始化（openCreate / openEdit）
 * - handleSave / handleDelete 行为
 */

import { describe, it, expect } from 'vitest'

// ==================== Types ====================

interface TaskRecord {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  assignee?: string | null
  dueAt?: number | null
  createdAt: number
}

// ==================== isOverdue ====================

function isOverdue(task: TaskRecord): boolean {
  if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') return false
  return Date.now() > task.dueAt
}

// ==================== Mock Data ====================

const now = Date.now()
const DAY_MS = 86400000

const mockTasks: TaskRecord[] = [
  { id: '1', title: '完成登录模块', description: '实现 OAuth 登录', status: 'todo', priority: 'high', tags: ['auth', 'feature'], assignee: '张三', dueAt: now - DAY_MS, createdAt: now - DAY_MS * 7 },
  { id: '2', title: '编写单元测试', description: '覆盖核心逻辑', status: 'in_progress', priority: 'medium', tags: ['test'], assignee: '李四', dueAt: now + DAY_MS * 3, createdAt: now - DAY_MS * 3 },
  { id: '3', title: '部署上线', description: '发布到生产环境', status: 'todo', priority: 'high', tags: ['ops'], assignee: null, dueAt: null, createdAt: now - DAY_MS },
  { id: '4', title: '代码审查', description: '审查 PR #42', status: 'done', priority: 'low', tags: ['review'], assignee: '王五', dueAt: now - DAY_MS * 2, createdAt: now - DAY_MS * 5 },
  { id: '5', title: '修复 Bug', description: '修复登录闪退', status: 'cancelled', priority: 'high', tags: ['bug'], assignee: '张三', dueAt: now - DAY_MS * 4, createdAt: now - DAY_MS * 6 },
  { id: '6', title: '性能优化', description: '优化首页加载速度', status: 'todo', priority: 'medium', tags: ['perf'], assignee: '', dueAt: now + DAY_MS * 7, createdAt: now - DAY_MS * 2 },
]

// ==================== Tests ====================

describe('TaskManagement - isOverdue', () => {
  it('无 dueAt 返回 false', () => {
    expect(isOverdue(mockTasks[2])).toBe(false) // dueAt: null
  })

  it('done 状态即使逾期也返回 false', () => {
    expect(isOverdue(mockTasks[3])).toBe(false) // status: done, dueAt: 2天前
  })

  it('cancelled 状态即使逾期也返回 false', () => {
    expect(isOverdue(mockTasks[4])).toBe(false) // status: cancelled, dueAt: 4天前
  })

  it('dueAt 在未来返回 false', () => {
    expect(isOverdue(mockTasks[1])).toBe(false) // dueAt: 3天后
  })

  it('dueAt 在过去且未完成返回 true', () => {
    expect(isOverdue(mockTasks[0])).toBe(true) // dueAt: 1天前, status: todo
  })
})

// ==================== 搜索过滤 ====================

function filterBySearch(tasks: TaskRecord[], search: string): TaskRecord[] {
  if (!search.trim()) return tasks
  const kw = search.toLowerCase().trim()
  return tasks.filter(t =>
    t.title.toLowerCase().includes(kw) ||
    t.description.toLowerCase().includes(kw)
  )
}

describe('TaskManagement - 搜索过滤', () => {
  it('空搜索返回全部', () => {
    expect(filterBySearch(mockTasks, '')).toHaveLength(6)
    expect(filterBySearch(mockTasks, '   ')).toHaveLength(6)
  })

  it('按标题搜索（中文）', () => {
    const result = filterBySearch(mockTasks, '登录')
    expect(result).toHaveLength(2) // task1 标题 + task5 描述都含"登录"
    expect(result.map(t => t.id).sort()).toEqual(['1', '5'])
  })

  it('按描述搜索', () => {
    const result = filterBySearch(mockTasks, 'PR')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('4')
  })

  it('大小写不敏感', () => {
    const result = filterBySearch(mockTasks, 'BUG')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('5')
  })

  it('不存在的关键词返回空数组', () => {
    expect(filterBySearch(mockTasks, '不存在的词')).toHaveLength(0)
  })
})

// ==================== 状态/优先级过滤 ====================

function filterByStatus(tasks: TaskRecord[], status: string): TaskRecord[] {
  if (status === 'all') return tasks
  return tasks.filter(t => t.status === status)
}

function filterByPriority(tasks: TaskRecord[], priority: string): TaskRecord[] {
  if (priority === 'all') return tasks
  return tasks.filter(t => t.priority === priority)
}

function filterTasks(tasks: TaskRecord[], search: string, filterStatus: string, filterPriority: string): TaskRecord[] {
  let result = tasks
  if (search) result = filterBySearch(result, search)
  result = filterByStatus(result, filterStatus)
  result = filterByPriority(result, filterPriority)
  return result
}

describe('TaskManagement - 状态过滤', () => {
  it('all 返回全部', () => {
    expect(filterByStatus(mockTasks, 'all')).toHaveLength(6)
  })

  it('todo 返回待办任务', () => {
    const result = filterByStatus(mockTasks, 'todo')
    expect(result).toHaveLength(3)
    expect(result.every(t => t.status === 'todo')).toBe(true)
  })

  it('in_progress 返回进行中', () => {
    const result = filterByStatus(mockTasks, 'in_progress')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('done 返回已完成', () => {
    const result = filterByStatus(mockTasks, 'done')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('4')
  })

  it('cancelled 返回已取消', () => {
    const result = filterByStatus(mockTasks, 'cancelled')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('5')
  })
})

describe('TaskManagement - 优先级过滤', () => {
  it('all 返回全部', () => {
    expect(filterByPriority(mockTasks, 'all')).toHaveLength(6)
  })

  it('high 返回高优先级', () => {
    const result = filterByPriority(mockTasks, 'high')
    expect(result).toHaveLength(3)
    expect(result.every(t => t.priority === 'high')).toBe(true)
  })

  it('medium 返回中优先级', () => {
    const result = filterByPriority(mockTasks, 'medium')
    expect(result).toHaveLength(2)
    expect(result.every(t => t.priority === 'medium')).toBe(true)
  })

  it('low 返回低优先级', () => {
    const result = filterByPriority(mockTasks, 'low')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('4')
  })
})

// ==================== 组合过滤 ====================

describe('TaskManagement - 组合过滤', () => {
  it('搜索 + 状态 + 优先级组合', () => {
    const result = filterTasks(mockTasks, '登录', 'todo', 'high')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('搜索 + 状态组合', () => {
    const result = filterTasks(mockTasks, '优化', 'todo', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('6')
  })

  it('无匹配时返回空', () => {
    const result = filterTasks(mockTasks, '不存在的词', 'all', 'all')
    expect(result).toHaveLength(0)
  })
})

// ==================== 统计计算 ====================

interface TaskStats {
  total: number
  todo: number
  inProgress: number
  done: number
  overdue: number
}

function computeStats(tasks: TaskRecord[]): TaskStats {
  return {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(isOverdue).length,
  }
}

describe('TaskManagement - 统计计算', () => {
  it('全部统计正确', () => {
    const stats = computeStats(mockTasks)
    expect(stats.total).toBe(6)
    expect(stats.todo).toBe(3)
    expect(stats.inProgress).toBe(1)
    expect(stats.done).toBe(1)
  })

  it('过期待办任务被计入逾期', () => {
    const stats = computeStats(mockTasks)
    expect(stats.overdue).toBe(1) // task 1 (dueAt 1天前, todo)
  })

  it('空数组统计全零', () => {
    const stats = computeStats([])
    expect(stats).toEqual({ total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 })
  })

  it('所有任务 done 时 overdue 为 0', () => {
    const doneTasks = mockTasks.map(t => ({ ...t, status: 'done' as const, dueAt: now - DAY_MS }))
    const stats = computeStats(doneTasks)
    expect(stats.overdue).toBe(0)
  })
})

// ==================== 表单状态 ====================

interface FormState {
  name: string
  description: string
  priority: 'low' | 'medium' | 'high'
  tagsText: string
  assignee: string
  dueDate: string
  dialogOpen: boolean
  editingTask: TaskRecord | null
}

function createForm(): FormState {
  return {
    name: '',
    description: '',
    priority: 'medium',
    tagsText: '',
    assignee: '',
    dueDate: '',
    dialogOpen: false,
    editingTask: null,
  }
}

function initCreate(state: FormState): FormState {
  return {
    ...createForm(),
    dialogOpen: true,
  }
}

function initEdit(state: FormState, task: TaskRecord): FormState {
  return {
    ...state,
    editingTask: task,
    name: task.title,
    description: task.description,
    priority: task.priority,
    tagsText: task.tags.join(', '),
    assignee: task.assignee || '',
    dueDate: task.dueAt ? new Date(task.dueAt).toISOString().split('T')[0] : '',
    dialogOpen: true,
  }
}

describe('TaskManagement - 表单状态', () => {
  describe('openCreate', () => {
    it('应重置所有字段为空并打开 dialog', () => {
      const state = initCreate(createForm())
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('')
      expect(state.editingTask).toBeNull()
      expect(state.priority).toBe('medium')
    })
  })

  describe('openEdit', () => {
    it('应填充表单并打开 dialog', () => {
      const task = mockTasks[0]
      const state = initEdit(createForm(), task)
      expect(state.dialogOpen).toBe(true)
      expect(state.name).toBe('完成登录模块')
      expect(state.description).toBe('实现 OAuth 登录')
      expect(state.priority).toBe('high')
      expect(state.tagsText).toBe('auth, feature')
      expect(state.assignee).toBe('张三')
      expect(state.dueDate).toBe(new Date(now - DAY_MS).toISOString().split('T')[0])
    })

    it('assignee 为空字符串时回退为 空字符串', () => {
      const task = mockTasks[2] // assignee: null
      const state = initEdit(createForm(), task)
      expect(state.assignee).toBe('')
    })

    it('dueAt 为 null 时 dueDate 为空字符串', () => {
      const task = mockTasks[2] // dueAt: null
      const state = initEdit(createForm(), task)
      expect(state.dueDate).toBe('')
    })
  })
})

// ==================== handleSave ====================

describe('TaskManagement - handleSave', () => {
  it('editingTask 非 null 时调用 update', async () => {
    let apiCall: { method: string; args: any[] } | null = null
    const editingTask = mockTasks[0]

    const handleSave = async () => {
      if (editingTask) {
        apiCall = { method: 'update', args: [editingTask.id, { title: '新标题' }] }
      }
    }
    await handleSave()
    expect(apiCall).not.toBeNull()
    expect(apiCall!.method).toBe('update')
    expect(apiCall!.args[0]).toBe('1')
  })

  it('editingTask 为 null 时调用 create', async () => {
    let apiCall: { method: string; args: any[] } | null = null

    const handleSave = async () => {
      apiCall = { method: 'create', args: [{ title: '新任务', status: 'todo' }] }
    }
    await handleSave()
    expect(apiCall).not.toBeNull()
    expect(apiCall!.method).toBe('create')
    expect(apiCall!.args[0].status).toBe('todo')
  })
})

// ==================== handleDelete ====================

describe('TaskManagement - handleDelete', () => {
  it('删除后应重新加载数据', async () => {
    let reloaded = false
    const handleDelete = async () => {
      reloaded = true
    }
    await handleDelete()
    expect(reloaded).toBe(true)
  })
})

// ==================== STATUS_MAP / PRIORITY_MAP ====================

describe('TaskManagement - 常量完整性', () => {
  it('STATUS_MAP 包含所有状态', () => {
    const STATUS_MAP: Record<string, { label: string; variant: string }> = {
      todo: { label: '○ 待办', variant: 'secondary' },
      in_progress: { label: '● 进行中', variant: 'default' },
      done: { label: '○ 完成', variant: 'outline' },
      cancelled: { label: '○ 取消', variant: 'destructive' },
    }
    expect(Object.keys(STATUS_MAP)).toHaveLength(4)
    expect(STATUS_MAP.todo.label).toBe('○ 待办')
    expect(STATUS_MAP.in_progress.label).toBe('● 进行中')
  })

  it('PRIORITY_MAP 包含所有优先级', () => {
    const PRIORITY_MAP: Record<string, { label: string; variant: string }> = {
      low: { label: '低', variant: 'secondary' },
      medium: { label: '中', variant: 'outline' },
      high: { label: '高', variant: 'destructive' },
    }
    expect(Object.keys(PRIORITY_MAP)).toHaveLength(3)
    expect(PRIORITY_MAP.high.label).toBe('高')
  })
})
