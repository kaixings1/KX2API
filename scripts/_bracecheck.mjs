import { readFileSync } from 'node:fs'

// 粗粒度括号配对：跳过字符串/注释/模板串/正则（正则较难，但本文件正则可近似处理）。
// 目标：找出第一个使深度「意外回退」或到某行仍未闭合的位置。
const p = process.argv[2]
const src = readFileSync(p, 'utf-8')

let depth = 0
let line = 1
let i = 0
const stack = []

const state = { inS: null, inLine: false, inBlock: false, inTmpl: 0, inRe: false, prevMeaningful: '' }

function isRegexStart(prev) {
  return !prev || /[=(,:[!&|?{};+\-*%~^<>]/.test(prev) || /\b(return|typeof|case|in|of|new|delete|void|instanceof)$/.test(prev)
}

while (i < src.length) {
  const ch = src[i]
  const nx = src[i + 1]
  if (ch === '\n') line++

  if (state.inLine) { if (ch === '\n') state.inLine = false; i++; continue }
  if (state.inBlock) { if (ch === '*' && nx === '/') { state.inBlock = false; i += 2; continue } i++; continue }
  if (state.inS) {
    if (ch === '\\') { i += 2; continue }
    if (ch === state.inS) state.inS = null
    i++; continue
  }
  if (state.inTmpl > 0) {
    if (ch === '\\') { i += 2; continue }
    if (ch === '`') { state.inTmpl--; i++; continue }
    i++; continue
  }
  if (state.inRe) {
    if (ch === '\\') { i += 2; continue }
    if (ch === '/') { state.inRe = false }
    i++; continue
  }

  if (ch === '/' && nx === '/') { state.inLine = true; i += 2; continue }
  if (ch === '/' && nx === '*') { state.inBlock = true; i += 2; continue }
  if (ch === '"' || ch === "'") { state.inS = ch; i++; continue }
  if (ch === '`') { state.inTmpl++; i++; continue }
  if (ch === '/' && isRegexStart(state.prevMeaningful)) { state.inRe = true; i++; continue }

  if (ch === '{') { depth++; stack.push(line) }
  else if (ch === '}') {
    depth--
    stack.pop()
    if (depth < 0) {
      console.log(`深度变负 @ 第 ${line} 行（多余的 }）`)
      process.exit(0)
    }
  }

  if (!/\s/.test(ch)) state.prevMeaningful = ch
  i++
}

console.log(`结束深度: ${depth}`)
if (depth !== 0) {
  console.log('未闭合的 { 起始行（栈顶为最近）:', stack.slice(-8).join(', '))
}
