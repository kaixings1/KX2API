import { readFileSync, readdirSync } from 'node:fs'

const dirs = ['05-other', '04-renderer', '03-tests', '01-engine', '02-main']
const pending = []

for (const d of dirs) {
  for (const f of readdirSync(`batch/${d}`).sort()) {
    const c = readFileSync(`batch/${d}/${f}`, 'utf8')
    // 找出"保留但待接线/待处理"类的表述
    const flags = []
    if (/待接线|未接线|待处理|待吸收|未吸收|需要接线/.test(c)) flags.push('待接线/待吸收')
    if (/归档/.test(c) && !/全部保留/.test(c)) flags.push('含归档')
    if (/全部保留/.test(c)) flags.push('全保留')
    console.log(`${d}/${f}`)
    console.log(`   ${flags.join(' | ') || '(无标记)'}`)
  }
}
