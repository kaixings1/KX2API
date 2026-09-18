/**
 * 临时探针：验证「同名 .d.ts 是否会遮蔽 index.ts 的导出」。
 *
 * QueryEngine 只存在于 src/engine/index.ts，不在 index.d.ts 里。
 * 若本文件编译报「找不到 QueryEngine」，说明 .d.ts 确实在遮蔽。
 * 验证后删除本文件。
 */
import type { QueryEngine, EngineOptions } from './index'

export const probe: (q: QueryEngine, o: EngineOptions) => void = () => {}
