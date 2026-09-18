/**
 * engine/tasks/index.ts �?任务系统 barrel export
 */
export {
  taskRegistry,
  getAllTasks,
  getTaskByType,
} from './taskRegistry.js'
export {
  isTerminalTaskStatus,
  createTaskStateBase,
} from './types.js'
export type {
  TaskType,
  TaskStatus,
  TaskHandle,
  TaskProgress,
  TaskStateBase,
} from './types.js'
