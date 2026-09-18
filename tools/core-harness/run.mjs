#!/usr/bin/env node
/**
 * tools/core-harness/runner.mjs — 关键核心代码的离线调试运行器
 *
 * 目的
 * ----
 * 「关键核心代码」指那些**纯函数式、可脱离网络与 Electron 独立运行**的处理链路：
 *   - 工具调用提取  extractToolCallsFromText(text)
 *   - 纯文本修复    parsePlainTextToolCalls / extractPlainTextToolCalls / stripPlainTextToolCalls
 *   - 工具历史配对  ensureToolResultPairing(messages) / groupMessagesByApiRound
 *   - 流式解析      ToolStreamParser.push / flush
 *   - 客户端识别    detectClientFromContent(content)
 *
 * 这些链路此前只能靠「起 Electron、连真实上游、等模型返回」来观察，
 * 出问题时既慢又不可复现。本运行器让它们变成**纯数据进、纯数据出**：
 * 喂一段文本/消息流，直接拿到解析结果。
 *
 * 用法（四种输入方式）
 * --------------------
 *   1) 场景文件（含期望值，可做回归断言）
 *      node tools/core-harness/run.mjs --case tools/core-harness/cases/extract-xml.json
 *   2) 跑一个目录下所有场景
 *      node tools/core-harness/run.mjs --dir tools/core-harness/cases
 *   3) 直接喂文本（管道 / 文件 / 内联）
 *      echo "<tool_call>...</tool_call>" | node tools/core-harness/run.mjs --target extract
 *      node tools/core-harness/run.mjs --target extract --input ./raw.txt
 *      node tools/core-harness/run.mjs --target extract --text "<tool_call>..</tool_call>"
 *   4) 列出可用 target
 *      node tools/core-harness/run.mjs --list
 *
 * 退出码：0 = 全部通过；1 = 有 case 失败（可直接用于 CI）。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')

// ─────────────────────────────────────────────────────────────
// 延迟加载被测模块
//
// 这些模块是 .ts 且带 `.ts` 后缀导入，必须经 tsx 加载。
// 用动态 import 而非顶层 import，好处是：
//   - 单个 target 加载失败不会拖垮整个 CLI（能报出是哪个模块的问题）
//   - --list 等纯信息命令无需加载任何被测代码
// ─────────────────────────────────────────────────────────────
async function load(rel) {
  const full = join(repoRoot, rel)
  if (!existsSync(full)) throw new Error(`模块不存在: ${rel}`)
  try {
    return await import(pathToFileUrl(full))
  } catch (e) {
    throw new Error(`加载 ${rel} 失败: ${e.message}`)
  }
}

function pathToFileUrl(p) {
  const u = new URL('file://')
  u.pathname = p.replace(/\\/g, '/').replace(/^([A-Za-z]:)/, '/$1')
  return u.href
}

// ─────────────────────────────────────────────────────────────
// 目标注册表
//
// 每个 target 声明：
//   run(input)   → 把数据喂进真实核心代码，返回可序列化结果
//   describe     → 一句话说明它测什么
//   inputHint    → 期望什么形状的输入（给 --help 与报错提示用）
// ─────────────────────────────────────────────────────────────
const TARGETS = {
  extract: {
    describe: '从整段文本中提取工具调用（非流式路径）',
    inputHint: '{ text: string }',
    async run(input) {
      const mod = await load('src/main/proxy/toolCalling/toolCallExtractor.ts')
      const text = String(input.text ?? '')
      const r = mod.extractToolCallsFromText(text)
      return {
        content: r.content,
        protocol: r.protocol,
        rawMatches: r.rawMatches,
        toolCalls: (r.toolCalls ?? []).map(tc => ({
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
          confidence: tc.confidence,
          generatedByProxy: tc.generatedByProxy,
        })),
      }
    },
  },

  'extract-stream': {
    describe: '把文本按 chunk 分片喂给提取器（模拟流式到达）',
    inputHint: '{ text: string, chunkSize?: number }',
    async run(input) {
      const mod = await load('src/main/proxy/toolCalling/toolCallExtractor.ts')
      const text = String(input.text ?? '')
      const size = Number(input.chunkSize ?? 8)
      const ex = new mod.ToolCallExtractor()
      const collected = []
      let content = ''
      for (let i = 0; i < text.length; i += size) {
        const piece = text.slice(i, i + size)
        const r = ex.process(piece)
        content += r.content ?? ''
        for (const tc of r.toolCalls ?? []) {
          collected.push({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments })
        }
      }
      const f = ex.flush()
      content += f.content ?? ''
      for (const tc of f.toolCalls ?? []) {
        collected.push({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments })
      }
      return { content, toolCalls: collected }
    },
  },

  'plain-parse': {
    describe: '把整段文本解析为纯文本工具调用（全匹配才会返回）',
    inputHint: '{ text: string, allowedNames?: string[] }',
    async run(input) {
      const mod = await load('src/utils/plainTextToolCallRepair.ts')
      const text = String(input.text ?? '')
      const allowed = Array.isArray(input.allowedNames) ? new Set(input.allowedNames) : undefined
      const r = mod.parsePlainTextToolCalls(text, allowed)
      return r === null ? { matched: false, blocks: null } : { matched: true, blocks: r }
    },
  },

  'plain-extract': {
    describe: '从混杂正文中抽取纯文本工具调用，并给出剥离后的正文',
    inputHint: '{ text: string, allowedNames?: string[] }',
    async run(input) {
      const mod = await load('src/utils/plainTextToolCallRepair.ts')
      const text = String(input.text ?? '')
      const allowed = Array.isArray(input.allowedNames) ? new Set(input.allowedNames) : undefined
      const r = mod.extractPlainTextToolCalls(text, allowed)
      const stripped = mod.stripPlainTextToolCalls(text, allowed)
      return {
        blocks: r?.blocks ?? r ?? [],
        contentWithoutToolCalls: typeof stripped === 'string' ? stripped : stripped?.content,
      }
    },
  },

  pairing: {
    describe: '修复 tool_use / tool_result 配对与顺序（上游 400 的根因所在）',
    inputHint: '{ messages: Array<{role,content,toolUseId?}> }',
    async run(input) {
      const mod = await load('src/engine/messageIntegrity.ts')
      const messages = Array.isArray(input.messages) ? input.messages : []
      const fixed = mod.ensureToolResultPairing(messages)
      return {
        before: summarizeMessages(messages),
        after: summarizeMessages(fixed),
        groups: mod.groupMessagesByApiRound(fixed).map(g => g.length),
      }
    },
  },

  'stream-parse': {
    describe: '流式解析：按 chunk 推入，观察工具调用如何被逐步发出',
    inputHint: '{ text: string, chunkSize?: number, baseChunk?: object }',
    async run(input) {
      const mod = await load('src/main/proxy/toolCalling/ToolStreamParser.ts')
      const planMod = await load('src/main/proxy/toolCalling/runtimePlan.ts')
      const text = String(input.text ?? '')
      const size = Number(input.chunkSize ?? 32)
      // 构造一个最小可用的 plan：流式解析器依赖它决定协议与兜底策略
      const plan = {
        mode: 'managed',
        protocol: input.protocol ?? 'managed_xml',
        shouldParseResponse: true,
        shouldInjectPrompt: true,
        fallbackStrategy: 'always',
        tools: [],
        diagnostics: {},
      }
      const base = input.baseChunk ?? { id: 'chatcmpl-harness', model: 'harness', created: 0 }
      const parser = new mod.ToolStreamParser(plan)
      const emitted = []
      for (let i = 0; i < text.length; i += size) {
        const out = parser.push(text.slice(i, i + size), base, false)
        for (const c of out ?? []) emitted.push(c)
      }
      for (const c of parser.flush(base) ?? []) emitted.push(c)
      return {
        emittedCount: emitted.length,
        emittedToolCalls: collectToolCallsFromChunks(emitted),
        emitted,
        hasEmittedToolCall: parser.hasEmittedToolCall(),
      }
    },
  },

  detect: {
    describe: '识别文本来自哪个客户端（提示词注入痕迹检测）',
    inputHint: '{ text: string }',
    async run(input) {
      const mod = await load('src/main/proxy/constants/signatures.ts')
      const r = mod.detectClientFromContent(String(input.text ?? ''))
      return {
        clientType: r?.clientType,
        confidence: r?.confidence,
        toolCallFormat: r?.toolCallFormat,
        injectsPrompt: r?.injectsPrompt,
        matchedSignatures: r?.matchedSignatures,
      }
    },
  },

  'tool-name': {
    describe: '工具名归一化（模型自造名 → 注册命令名）',
    inputHint: '{ name: string }（也可用 --text 直接给名字）',
    async run(input) {
      const mod = await load('src/engine/toolNameResolver.ts')
      // 兼容 --text：CLI 的通用入口只塞 text，这里允许直接给名字，
      // 免得为一个单词还得写 JSON。
      const name = String(input.name ?? input.text ?? '')
      const resolved = await mod.resolveToolName(name)
      return { input: name, resolved }
    },
  },

  'tool-concept': {
    describe: '跨写法工具名归类（bash/Bash、ls/ListFiles 是否同一工具）',
    inputHint: '{ names: string[] }',
    async run(input) {
      const mod = await load('src/engine/toolNameCompat.ts')
      const names = Array.isArray(input.names) ? input.names.map(String) : []
      return {
        concept: Object.fromEntries(names.map(n => [n, mod.getToolConcept(n)])),
        isShell: Object.fromEntries(names.map(n => [n, mod.isShellTool(n)])),
        isFile: Object.fromEntries(names.map(n => [n, mod.isFileTool(n)])),
      }
    },
  },

  'perm-match': {
    describe: '权限规则匹配（验证 Bash/bash 两种写法都能命中同一工具）',
    inputHint: '{ rule: string, toolName: string, input?: object }',
    async run(input) {
      const mod = await load('src/engine/permissions/permissionRules.ts')
      const rule = String(input.rule ?? '')
      const toolName = String(input.toolName ?? '')
      const value = mod.permissionRuleValueFromString(rule)
      const parsed = {
        source: 'userSettings',
        behavior: 'allow',
        value,
      }
      const applies = mod.ruleApplies(parsed, toolName, input.input ?? {})
      return {
        rule,
        parsedToolName: value.toolName,
        ruleContent: value.ruleContent,
        toolName,
        applies,
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────────────────────

/** 把消息数组压成「一眼能看出配对关系」的摘要串 */
function summarizeMessages(messages) {
  return messages.map(m => {
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      const kinds = m.content.map(b => (b?.type === 'tool_use' ? `tool_use(${b.id})` : b?.type ?? '?'))
      return `assistant:[${kinds.join(',')}]`
    }
    if (m.role === 'tool') return `tool(id=${m.toolUseId ?? 'undefined'})`
    const text = typeof m.content === 'string' ? m.content.slice(0, 40) : '[非文本]'
    return `${m.role}:${text}`
  })
}

/** 从流式 chunk 里抽出 tool_calls，便于断言 */
function collectToolCallsFromChunks(chunks) {
  const out = []
  for (const c of chunks) {
    const tcs = c?.choices?.[0]?.delta?.tool_calls
    if (!Array.isArray(tcs)) continue
    for (const tc of tcs) {
      out.push({
        index: tc.index,
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      })
    }
  }
  return out
}

/** 深比较：支持期望值是「子集」语义（只校验列出的字段） */
function subsetMatch(actual, expected, path = '$') {
  const diffs = []
  if (expected === null || typeof expected !== 'object') {
    if (actual !== expected) diffs.push(`${path}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
    return diffs
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push(`${path}: 期望数组，实际 ${typeof actual}`)
      return diffs
    }
    if (expected.length !== actual.length) {
      diffs.push(`${path}: 期望长度 ${expected.length}，实际 ${actual.length}`)
    }
    const n = Math.min(expected.length, actual.length)
    for (let i = 0; i < n; i++) diffs.push(...subsetMatch(actual[i], expected[i], `${path}[${i}]`))
    return diffs
  }
  for (const [k, v] of Object.entries(expected)) {
    if (!(k in (actual ?? {}))) {
      diffs.push(`${path}.${k}: 实际结果里没有该字段`)
      continue
    }
    diffs.push(...subsetMatch(actual[k], v, `${path}.${k}`))
  }
  return diffs
}

function readStdin() {
  return new Promise(resolve => {
    let data = ''
    if (process.stdin.isTTY) return resolve('')
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', c => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

function printHelp() {
  console.log(`core-harness — 关键核心代码的离线调试运行器

用法:
  node tools/core-harness/run.mjs --list
  node tools/core-harness/run.mjs --target <name> [--text "..." | --input <file> | <stdin>]
  node tools/core-harness/run.mjs --case <case.json>
  node tools/core-harness/run.mjs --dir <cases-dir>

可用 target:`)
  for (const [name, t] of Object.entries(TARGETS)) {
    console.log(`  ${name.padEnd(16)} ${t.describe}`)
    console.log(`  ${''.padEnd(16)} 输入: ${t.inputHint}`)
  }
  console.log(`
场景文件格式（case.json）:
  {
    "target": "extract",
    "input":  { "text": "<tool_call>...</tool_call>" },
    "expect": { "toolCalls": [ { "name": "ls" } ] }
  }
  expect 采用「子集匹配」：只校验列出的字段，未列出的不参与比较。`)
}

// ─────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────
async function runCase(caseObj, caseName) {
  const target = caseObj.target
  if (!TARGETS[target]) {
    return { name: caseName, ok: false, error: `未知 target: ${target}` }
  }
  try {
    const actual = await TARGETS[target].run(caseObj.input ?? {})
    if (!caseObj.expect) {
      return { name: caseName, ok: true, actual, noExpect: true }
    }
    const diffs = subsetMatch(actual, caseObj.expect)
    return { name: caseName, ok: diffs.length === 0, actual, diffs }
  } catch (e) {
    return { name: caseName, ok: false, error: e.message }
  }
}

function collectCaseFiles(dir) {
  const abs = resolve(process.cwd(), dir)
  const out = []
  for (const name of readdirSync(abs)) {
    const full = join(abs, name)
    if (statSync(full).isDirectory()) out.push(...collectCaseFiles(full))
    else if (extname(name) === '.json') out.push(full)
  }
  return out.sort()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help || args._.includes('help')) {
    printHelp()
    return 0
  }

  if (args.list) {
    for (const [name, t] of Object.entries(TARGETS)) {
      console.log(`${name}\t${t.describe}\t输入: ${t.inputHint}`)
    }
    return 0
  }

  // ── 模式 1/2：场景文件 ──
  if (args.case || args.dir) {
    const files = args.dir
      ? collectCaseFiles(args.dir)
      : [resolve(process.cwd(), args.case)]

    if (files.length === 0) {
      console.error('没有找到任何 .json 场景文件')
      return 1
    }

    let pass = 0
    let fail = 0
    for (const f of files) {
      let caseObj
      try {
        caseObj = JSON.parse(readFileSync(f, 'utf-8'))
      } catch (e) {
        console.log(`FAIL  ${f}\n      场景文件解析失败: ${e.message}`)
        fail++
        continue
      }
      const r = await runCase(caseObj, f)
      if (r.ok) {
        pass++
        console.log(`PASS  ${f}`)
      } else {
        fail++
        console.log(`FAIL  ${f}`)
        if (r.error) console.log(`      错误: ${r.error}`)
        for (const d of r.diffs ?? []) console.log(`      ${d}`)
        // 失败时打印实际结果，便于直接定位
        console.log(`      实际: ${JSON.stringify(r.actual, null, 2).split('\n').join('\n      ')}`)
      }
    }
    console.log(`\n--- 场景 ${files.length} 个：${pass} 通过，${fail} 失败 ---`)
    return fail > 0 ? 1 : 0
  }

  // ── 模式 3：直接喂数据 ──
  if (args.target) {
    const target = TARGETS[args.target]
    if (!target) {
      console.error(`未知 target: ${args.target}（用 --list 查看可用列表）`)
      return 1
    }

    let input
    if (args.text) {
      input = { text: args.text }
    } else if (args.input) {
      input = { text: readFileSync(resolve(process.cwd(), args.input), 'utf-8') }
    } else {
      const piped = await readStdin()
      if (!piped) {
        console.error('没有输入：请用 --text / --input <file> / 管道喂数据')
        return 1
      }
      // 管道内容若本身是 JSON 对象则按对象用，否则当作待处理文本
      const trimmed = piped.trim()
      try {
        const parsed = JSON.parse(trimmed)
        input = typeof parsed === 'object' && parsed !== null ? parsed : { text: piped }
      } catch {
        input = { text: piped }
      }
    }

    try {
      const result = await target.run(input)
      console.log(JSON.stringify(result, null, 2))
      return 0
    } catch (e) {
      console.error(`运行失败: ${e.message}`)
      return 1
    }
  }

  printHelp()
  return 1
}

main()
  .then(code => process.exit(code))
  .catch(e => {
    console.error('未捕获错误:', e)
    process.exit(1)
  })
