import { rmSync, readdirSync, statSync } from 'node:fs'

// 清理我本会话产生的一次性文件（日志/脚本）。
// 注意：只删根目录下我明确创建的；不碰 scripts/_*.mjs（那是并发会话的调试脚本）。
const mine = [
  '_build.log', '_f.log', '_fs.log', '_lsjunk.mjs', '_recent.log',
  '_verify.log', '_verify.mjs', '_tc.log', '_st.bin', '_ml.diff', '_ml_head.ts',
]
for (const f of mine) {
  try { rmSync(f, { force: true }) } catch {}
}
const left = readdirSync('.').filter((n) => n.startsWith('_') && !n.startsWith('__'))
console.log('remaining "_" files:', JSON.stringify(left))
// 报告 .t/.u/.c 类临时 txt（并发会话的，不删，仅报告）
const txt = readdirSync('.').filter((n) => /^\.(t|u|c)\d+\.txt$/.test(n))
console.log('other-session txt temps:', JSON.stringify(txt))
