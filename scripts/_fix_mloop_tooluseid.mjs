import { readFileSync, writeFileSync } from 'node:fs'

const NL = '\n'

// ── 1) messageLoop.ts：gitContext.extractFiles —— 过滤缺失 ID 的结果 ──
{
  const p = 'src/engine/messageLoop.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s
  const nl = s.includes('\r\n') ? '\r\n' : NL

  s = s.replace(
    '          results.map(r => ({ toolUseId: r.toolUseId, success: r.success, output: r.output })),',
    [
      '          results',
      '            // 只取有 toolUseId 的结果：缺失时无法与前一次调用关联，',
      '            // 强行透传会让下游按 undefined 建出无主条目。',
      "            .filter((r): r is typeof r & { toolUseId: string } => typeof r.toolUseId === 'string')",
      '            .map(r => ({ toolUseId: r.toolUseId, success: r.success, output: r.output })),',
    ].join(nl),
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('messageLoop 未命中 extractFiles 调用')
  }
}

// ── 2) autoFixLoop.ts：maybeRun 参数放宽为可选 ──
// maybeRun 只从 output 里提取文件路径，toolUseId 实际并未被读取。
// 与其在调用点凑一个假 ID，不如把类型放宽到与 ToolResult 一致。
{
  const p = 'src/engine/autoFixLoop.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s

  s = s.replace(
    '    results: Array<{ toolUseId: string; success: boolean; output?: unknown; error?: string }>,',
    [
      '    /**',
      '     * 工具结果。toolUseId 允许缺省 —— 与 ToolResult 的声明保持一致',
      '     * （工具自身实现不知道调用 ID，由调度器补上）；本方法只读取 output，',
      '     * 不依赖该字段。',
      '     */',
      '    results: Array<{ toolUseId?: string; success: boolean; output?: unknown; error?: string }>,',
    ].join(NL),
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('autoFixLoop 未命中 maybeRun 签名')
  }
}
