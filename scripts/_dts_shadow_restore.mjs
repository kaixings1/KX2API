import { existsSync, renameSync } from 'node:fs'

// 恢复被 _dts_shadow.mjs 临时移开的 .d.ts
const targets = ['src/engine/index.d.ts', 'src/main/proxy/adapters/index.d.ts']

for (const t of targets) {
  const bak = t + '.bak_tmp'
  if (existsSync(bak)) {
    renameSync(bak, t)
    console.log('已恢复: ' + t)
  } else {
    console.log('无备份，跳过: ' + t)
  }
}
