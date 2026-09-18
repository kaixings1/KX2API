import { readFileSync, writeFileSync } from 'node:fs'

// ── 1) toolCallCache：可缓存工具名单（只读类）──
{
  const p = 'src/main/proxy/tools/toolCallCache.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s

  const old = /    this\.cachedTools = new Set\(\[\r?\n      'Glob',\r?\n      'Grep',\r?\n      'Read',\r?\n      'WebFetch',\r?\n    \]\)/
  const neu = [
    '    // 只读类工具才可缓存（读文件 / 搜索 / 联网检索）。',
    '    // 同时列出注册名与历史名：实际工具名是 `cat`/`ls`/`find`，',
    '    // 而 user 配置与旧代码里用的是 `Read`/`Glob`。只列一套会导致缓存恒不命中。',
    '    this.cachedTools = new Set([',
    "      'cat', 'head', 'tail', 'ls', 'find', 'wc', 'search',",
    "      'Read', 'Glob', 'Grep', 'ListFiles', 'WebFetch',",
    '    ])',
  ].join('\n')

  if (!old.test(s)) {
    console.log('toolCallCache 未命中')
  } else {
    s = s.replace(old, neu)
    writeFileSync(p, s)
    console.log('已改: ' + p)
  }
}

// ── 2) streamingToolExecutor：改用 isShellTool ──
{
  const p = 'src/main/proxy/tools/streamingToolExecutor.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s
  const needle = "tool.name === 'bash' || tool.name === 'Bash'"
  const n = s.split(needle).length - 1
  if (n === 0) {
    console.log('streamingToolExecutor 未命中')
  } else {
    s = s.split(needle).join('isShellTool(tool.name)')
    if (!s.includes('isShellTool')) {
      console.log('替换异常')
    } else if (!s.includes('toolNameCompat')) {
      const lines = s.split(/\r?\n/)
      let lastImport = 0
      for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i
      lines.splice(lastImport + 1, 0, "import { isShellTool } from '../../toolNameCompat.ts'")
      s = lines.join('\n')
    }
    writeFileSync(p, s)
    console.log(`已改: ${p}（${n} 处）`)
  }
}
