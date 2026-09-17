/**
 * 批量修正 toolCallExtractor 里 `const name = p.xxx || ...` 的类型推断问题。
 *
 * 根因：p 是 Record<string, unknown>，p.name 取出是 unknown，
 * 参与 || 后整体推断为 unknown，而返回类型要求 name: string → TS2322。
 *
 * 统一改为：先取出候选值，显式 typeof 收窄，再回落到推导/默认值。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const f = 'src/main/proxy/toolCalling/toolCallExtractor.ts'
let s = readFileSync(f, 'utf-8')
const n0 = s

// 形态 A：const name = p.name || p.tool || inferToolNameFromArgs(p) || 'unknown';
s = s.split("const name = p.name || p.tool || inferToolNameFromArgs(p) || 'unknown';").join(
  `const rawName = p.name ?? p.tool
          const name: string =
            (typeof rawName === 'string' ? rawName : inferToolNameFromArgs(p)) || 'unknown';`,
)

// 形态 B：const name = candidate.name || candidate.tool || inferToolNameFromArgs(candidate as any) || 'unknown';
s = s.split(
  "const name = candidate.name || candidate.tool || inferToolNameFromArgs(candidate as any) || 'unknown';",
).join(
  `const rawName = (candidate as Record<string, unknown>).name ?? (candidate as Record<string, unknown>).tool
          const name: string =
            (typeof rawName === 'string' ? rawName : inferToolNameFromArgs(candidate as Record<string, unknown>)) || 'unknown';`,
)

// 形态 C：const name = p.name || p.tool || p.tool_name || inferToolNameFromArgs(p)
s = s.split("const name = p.name || p.tool || p.tool_name || inferToolNameFromArgs(p)").join(
  `const rawName = p.name ?? p.tool ?? p.tool_name
      const name: string | null =
        typeof rawName === 'string' ? rawName : inferToolNameFromArgs(p)`,
)

writeFileSync(f, s, 'utf-8')
console.log('改动:', n0 !== s ? '已更新' : '未匹配')
