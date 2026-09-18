import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 整理 tests/engine/legacy/broken/。
 *
 * 背景：这批文件是 src/engine/__tests__/ 的**副本**（行数一致、仅导入路径不同）。
 * 副本上已经做了两项修复：
 *   1. 相对路径按新位置修正（虽然副本本身要被删，但修复思路有效）
 *   2. engine.test.ts 的两条过时断言（getConfig 不再暴露 apiKey、getHistory 返回数组）
 *
 * 因此正确做法是：**把有价值的修复回填到正确位置的原件**，再删掉 broken/，
 * 而不是留着两份（一份正确但过时、一份修复但位置错误）。
 *
 * 回填策略：只回填「与内容无关的实质修复」，不搬运路径改动（原件路径本来是对的）。
 */
const broken = 'tests/engine/legacy/broken'
const origin = 'src/engine/__tests__'

// 只回填这些已知修复（按需扩展）。用「原件里的旧片段 → 修复后的新片段」表达。
const patches = {
  'engine.test.ts': [
    {
      from: "  assert(typeof config.apiKey === 'string', 'apiKey is string')",
      to: [
        '  // 注意：getConfig() 有意**不暴露 apiKey**（引擎配置不应外泄密钥），',
        '  // 故这里改为校验它确实不在返回结构里 —— 防止将来有人把密钥又塞回来。',
        "  assert(!('apiKey' in config), 'getConfig() 不暴露 apiKey（安全性约束）')",
        "  assert(typeof config.systemPrompt === 'string', 'systemPrompt is string')",
      ].join('\n'),
    },
    {
      from: "  assert(Array.isArray(history.messages), 'getHistory returns messages array')",
      to: [
        '  // getHistory() 现直接返回消息数组（不再包一层 { messages }）',
        "  assert(Array.isArray(history), 'getHistory returns messages array')",
      ].join('\n'),
    },
  ],
}

let patched = 0
let removed = 0

for (const name of readdirSync(broken)) {
  if (!name.endsWith('.ts')) continue
  const target = join(origin, name)
  const copy = join(broken, name)

  // ── 1) 若原件存在且有已知修复，回填 ──
  if (existsSync(target) && patches[name]) {
    let s = readFileSync(target, 'utf-8')
    for (const p of patches[name]) {
      if (s.includes(p.from)) {
        s = s.replace(p.from, p.to)
        patched++
        console.log(`回填 ${name}: ${p.from.trim().slice(0, 50)}…`)
      }
    }
    writeFileSync(target, s)
  }

  // ── 2) 删掉副本 ──
  unlinkSync(copy)
  removed++
  console.log(`删除副本 ${name}`)
}

// ── 3) 清理空的 broken 目录 ──
try {
  const left = readdirSync(broken)
  if (left.length === 0) {
    rmdirSync(broken)
    console.log('已删除空目录 ' + broken)
  } else {
    console.log(`注意：${broken} 仍有 ${left.length} 项，未删除目录`)
  }
} catch (e) {
  console.log('清理目录失败: ' + e.message)
}

console.log(`\n--- 回填 ${patched} 处，删除副本 ${removed} 个 ---`)
