import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/management/config.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 本路由直接操作 ConfigManager（其声明在 main/store/types 的 AppConfig），
// 但类型却从 shared/types 取 —— 两套 AppConfig 是平行演化关系
// （store 版有 rateLimit/quota/billing 等，shared 版有 memory/imageBudget 等），
// 于是 ConfigManager.get() 的返回值、Partial 参数、keyof 索引全部对不上。
// 这里统一用真实数据源那一份，避免互相强转。
const re =
  /import type \{\r?\n  ManagementApiResponse,\r?\n  AppConfig,\r?\n  ConfigUpdateRequest,\r?\n\} from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/types'/

if (!re.test(s)) {
  console.log('未命中导入块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "import type { ManagementApiResponse, ConfigUpdateRequest } from '../../../../shared/types'",
    '// AppConfig 以 main/store/types 为准：本文件直接读写 ConfigManager，',
    '// 用 shared 版会与真实落盘结构错位（两套 AppConfig 平行演化）。',
    "import type { AppConfig } from '../../../store/types'",
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
