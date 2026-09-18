import { readFileSync, existsSync } from 'node:fs'

/**
 * 判断某个 .d.ts 是否「陈旧且有害」：
 *   对比 <name>.d.ts 与 <name>.ts 导出的符号集合。
 *   若 .d.ts 缺失了大量 .ts 中的导出，说明它是旧编译产物，
 *   会在类型解析时遮蔽真实实现（TS 优先采用同名 .d.ts）。
 */
const pairs = [
  ['src/engine/index', 'src/engine/index.d.ts'],
  ['src/engine/cli', 'src/engine/cli.d.ts'],
  ['src/main/ipc/index', 'src/main/ipc/index.d.ts'],
  ['src/main/oauth/adapters/base', 'src/main/oauth/adapters/base.d.ts'],
  ['src/main/proxy/adapters/index', 'src/main/proxy/adapters/index.d.ts'],
  ['src/main/proxy/adapters/prompt/index', 'src/main/proxy/adapters/prompt/index.d.ts'],
  ['src/main/proxy/prompt/index', 'src/main/proxy/prompt/index.d.ts'],
  ['src/main/proxy/utils/index', 'src/main/proxy/utils/index.d.ts'],
  ['src/main/tray/index', 'src/main/tray/index.d.ts'],
  ['src/main/updater/index', 'src/main/updater/index.d.ts'],
]

function exportsOf(tsPath) {
  if (!existsSync(tsPath)) return null
  const txt = readFileSync(tsPath, 'utf-8')
  const names = new Set()
  // export function/class/const/interface/type/enum
  for (const m of txt.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g)) {
    names.add(m[1])
  }
  // export { a, b as c }
  for (const m of txt.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (t) names.add(t)
    }
  }
  // export * from  → 无法枚举，标记
  if (/export\s+\*\s+from/.test(txt)) names.add('*')
  return names
}

for (const [base, dts] of pairs) {
  const ts = base + '.ts'
  const a = exportsOf(ts)
  const b = exportsOf(dts)
  if (!a || !b) {
    console.log(`${base}: ${!a ? '无 .ts' : '无 .d.ts'}`)
    continue
  }
  const missing = [...a].filter(x => x !== '*' && !b.has(x))
  const verdict = a.has('*')
    ? '含 export *（导出集合无法静态比对，需人工确认）'
    : missing.length > 0
      ? `**陈旧**：.d.ts 缺少 ${missing.length} 个导出（如 ${missing.slice(0, 4).join(', ')}）`
      : '一致'
  console.log(`${base.padEnd(40)} .ts=${a.size} .d.ts=${b.size}  ${verdict}`)
}
