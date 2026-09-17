import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/management/sessions.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// SessionRecord 的单一真源是 src/main/store/types.ts（shared/types 里没有它）。
// ManagementApiResponse 仍在 shared/types。
const re =
  /import type \{ \r?\n  SessionRecord,\r?\n  ManagementApiResponse \r?\n\} from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/types'/

if (!re.test(s)) {
  console.log('未命中导入块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "import type { ManagementApiResponse } from '../../../../shared/types'",
    "// SessionRecord 的单一真源在 main/store/types（shared/types 未定义该类型）",
    "import type { SessionRecord } from '../../../store/types'",
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
