// isolatedModules 下重导出类型必须显式标注 `export type`（TS1205）：
// 类型在编译后被擦除，普通 `export { ... }` 会被当成值的重导出。
export { UpdaterManager } from './UpdaterManager'
export type { DownloadProgress, UpdateStatus, UpdaterEvents } from './UpdaterManager'
export { default } from './UpdaterManager'
