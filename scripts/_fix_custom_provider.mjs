import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/providers/custom.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 本文件把 Provider 从 shared/types 取名，但实际交给 storeManager.addProvider /
// storeManager.getProviders —— 它们要的是 main/store/types 的 Provider。
// 两套同名 Provider 平行演化（store 版有 credentialFields/category/tags 等），
// 于是构造对象时 TS2353。按真实数据源改导入。
s = s.replace(
  "import type { Provider, AuthType } from '../../shared/types'",
  "import type { AuthType } from '../../shared/types'\n// Provider 以 main/store/types 为准（本文件直接交给 storeManager 落盘）\nimport type { Provider } from '../store/types'",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
