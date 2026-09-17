import { readFileSync, writeFileSync } from 'node:fs'

/**
 * 修复写入时产生的 U+FFFD（替换字符）。
 * 每处都按上下文补回原字，而非简单删除 —— 这些多在注释/提示词/关键词表里，
 * 丢字会造成语义缺失（尤其 semanticSearch 的关键词表会影响检索效果）。
 */
const fixes = [
  {
    p: 'src/engine/agent/task-executor.ts',
    from: '"未\uFFFD\uFFFD错误"',
    to: '"未知错误"',
    note: '错误文案补回「知」',
  },
  {
    p: 'src/engine/commands/registry.ts',
    from: '系统信息\uFFFD\uFFFD令',
    to: '系统信息类命令',
    note: '注释补回「类」',
  },
  {
    p: 'src/engine/orchestrator/agentRole.ts',
    from: '和推\uFFFD\uFFFD（基于经验的建议）',
    to: '和推测（基于经验的建议）',
    note: '注释补回「测」',
  },
  {
    p: 'src/engine/semanticSearch.ts',
    from: '所有,相关,关\uFFFD,的,和,与',
    to: '所有,相关,关系,的,和,与',
    note: '中文关键词表补回「系」（影响检索命中）',
  },
  {
    p: 'src/main/proxy/tools/streamingToolExecutor.ts',
    from: '（基\uFFFD\uFFFD并发状态）',
    to: '（基于并发状态）',
    note: '注释补回「于」',
  },
  {
    p: 'src/main/store/types.ts',
    from: 'Engine 层使\uFFFD的 provider 类型',
    to: 'Engine 层使用的 provider 类型',
    note: '注释补回「用」',
  },
  {
    p: 'src/main/store/types.d.ts',
    from: 'Engine 层使\uFFFD的 provider 类型',
    to: 'Engine 层使用的 provider 类型',
    note: '注释补回「用」（.d.ts 副本）',
  },
  {
    p: 'src/renderer/src/pages/AgentManagement/AgentDetailPage.tsx',
    from: 'label="返\uFFFD列表"',
    to: 'label="返回列表"',
    note: 'UI 文案补回「回」',
  },
  {
    p: 'src/renderer/src/pages/Chat/streamParser.ts',
    from: '返回当前已解析的完整\uFFFD容',
    to: '返回当前已解析的完整内容',
    note: '注释补回「内」',
  },
]

let ok = 0
for (const f of fixes) {
  let s
  try {
    s = readFileSync(f.p, 'utf-8')
  } catch {
    console.log(`跳过（读不到）: ${f.p}`)
    continue
  }
  if (!s.includes(f.from)) {
    console.log(`未命中: ${f.p} — ${f.note}`)
    continue
  }
  s = s.replace(f.from, f.to)
  writeFileSync(f.p, s)
  ok++
  console.log(`已改: ${f.p} — ${f.note}`)
}
console.log(`--- 修复 ${ok}/${fixes.length} 处 ---`)
