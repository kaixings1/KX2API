import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/managedXml.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 这个白名单的用途是「接受上游模型可能发出的原生工具名」（无工具声明时的兜底），
// 因此**两套写法都该保留** —— 不同厂商的模型输出不同名字。
// 现状缺的是「本项目注册命令名」这一侧（ls/cat/bash/find/exec…），
// 而引擎实际调度的正是这些名字。补上，而不是替换。
const anchor = "  'websearch',\n  'image_gen',\n])"
const anchorCRLF = "  'websearch',\r\n  'image_gen',\r\n])"

const insert = [
  "  'websearch',",
  "  'image_gen',",
  '',
  '  // ── 本项目注册命令名（commandRunners 的 key）──',
  '  // 引擎实际调度执行的是这些名字；上游模型在被 system prompt 教过之后',
  '  // 也会直接输出它们。此前白名单只有 Claude 风格名，导致标准写法被判为',
  '  // 「未知工具」而拒绝。',
  "  'ls',",
  "  'cat',",
  "  'head',",
  "  'tail',",
  "  'bash',",
  "  'exec',",
  "  'find',",
  "  'tree',",
  "  'wc',",
  "  'mkdir',",
  "  'cp',",
  "  'mv',",
  "  'rm',",
  "  'search',",
  "])",
].join(NL)

if (s.includes(anchor)) s = s.replace(anchor, insert)
else if (s.includes(anchorCRLF)) s = s.replace(anchorCRLF, insert.replace(/\n/g, '\r\n'))
else {
  console.log('未命中白名单尾部')
  process.exit(1)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
