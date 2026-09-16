
import { resolveMemoryDir, scanMemories, recallMemories, formatMemoriesForPrompt } from '../src/engine/memory/memoryRecall.ts'

const dir = resolveMemoryDir(process.cwd())
console.log('memoryDir =', dir)

const all = await scanMemories(dir)
console.log('扫描到记忆条数 =', all.length)
for (const e of all) console.log('  -', e.file, '| type=' + (e.type ?? '?'), '|', e.name)

const queries = [
  '工具调用后 AI 答复丢失怎么排查',
  '列目录时遇到图片文件要不要读取内容',
  '配置保存了重启后为什么丢失',
  '完全不相关的量子物理问题',
]

for (const q of queries) {
  const hits = await recallMemories(q)
  console.log('\n查询:', q)
  console.log('  命中:', hits.map(h => `${h.name}(score=${h.score})`).join(', ') || '(无)')
  const section = formatMemoriesForPrompt(hits)
  if (section) console.log('  注入长度:', section.length, '字符')
}
