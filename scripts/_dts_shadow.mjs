import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

/**
 * 验证「陈旧 .d.ts 遮蔽真实实现」的假设。
 *
 * 原理：TypeScript 解析 `import ... from './index'` 时，若同目录存在
 * `index.d.ts`，会**优先采用它**而不是 `index.ts`。如果这个 .d.ts 是旧版
 * 编译产物（导出集合远少于实现），就会表现为「明明文件里导出了，却报找不到」。
 *
 * 做法：把 index.d.ts 临时移开，跑一次 tsc，看错误数是否变化。
 * 若减少 → 证实它在遮蔽；若不变 → 无害（可保留或另行判断）。
 */
const targets = ['src/engine/index.d.ts', 'src/main/proxy/adapters/index.d.ts']

// 记录原内容，便于恢复
const backups = new Map()
for (const t of targets) {
  if (existsSync(t)) {
    backups.set(t, readFileSync(t, 'utf-8'))
    // 临时改名（而非删除），保证可恢复
    writeFileSync(t + '.bak_tmp', readFileSync(t))
    unlinkSync(t)
    console.log('已临时移开: ' + t)
  } else {
    console.log('不存在，跳过: ' + t)
  }
}

console.log('\n备份数: ' + backups.size)
console.log('现在请运行: npx tsc -p tsconfig.check.json --noEmit --pretty false')
console.log('对比移除前后的错误数，即可判断是否在遮蔽。')
console.log('恢复命令: node scripts/_dts_shadow_restore.mjs')
