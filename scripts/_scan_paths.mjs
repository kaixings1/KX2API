import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// 扫描 legacy/broken 下所有相对导入，报告层数是否足够（到仓库根需 4 层）
const dir = 'tests/engine/legacy/broken'
const re = /from\s+['"]((?:\.\.\/)+)([^'"]+)['"]/g

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.ts')) continue
  const full = join(dir, name)
  const txt = readFileSync(full, 'utf-8')
  const lines = txt.split(/\r?\n/)
  const issues = []
  for (let i = 0; i < lines.length; i++) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(lines[i])) !== null) {
      const depth = m[1].split('../').length - 1
      if (depth < 4) issues.push(`${i + 1}: 层数=${depth} ${m[2]}`)
    }
  }
  if (issues.length) {
    console.log(`\n=== ${name} ===`)
    console.log(issues.join('\n'))
  }
}
