/**
 * engine/tasks/index.ts �?任务系统 barrel export
 */
export {
  taskRegistry,
  getAllTasks,
  getTaskByType,
} from './taskRegistry.ts'
export {
  isTerminalTaskStatus,
  createTaskStateBase,
} from './types.ts'
export type {
  TaskType,
  TaskStatus,
  TaskHandle,
  TaskProgress,
  TaskStateBase,
} from './types.ts'
