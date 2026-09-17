#!/usr/bin/env node

/**
 * src/engine/cli.ts — KX2Code 引擎命令行入口
 *
 * 用法:
 *   node src/engine/cli.ts
 *   node src/engine/cli.ts --provider openai --model gpt-4o --apiKey sk-...
 *
 * 交互式输入，按 Enter 发送，Ctrl+C 退出
 */

import * as readline from 'readline'
import { createEngine, getEngine, commandRegistry } from './core'
import { importCommands } from './commands/importer'

// ---- parse args ----

const args = process.argv.slice(2)
const get = (flag: string, fallback: string) => {
  const idx = args.indexOf(flag)
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]
  const eq = args.find(a => a.startsWith(`${flag}=`))
  if (eq) return eq.split('=')[1]
  return fallback
}

const apiKey = get('--apiKey', process.env.KX2_API_KEY || '')
const provider = get('--provider', process.env.KX2_PROVIDER || 'openai')
const model = get('--model', process.env.KX2_MODEL || 'gpt-4o')

// ---- init ----

async function init() {
  console.log(`[CLI] Initializing engine: provider=${provider}, model=${model}`)

  createEngine({
    apiKey,
    provider: provider as 'openai' | 'anthropic' | 'custom',
    model,
    maxTokens: 4096,
  })

  const engine = getEngine()
  const count = await importCommands()
  console.log(`[CLI] ${count} commands loaded\n`)
  console.log('Type a message and press Enter. /help for commands. Ctrl+C to exit.\n')

  // ---- REPL ----

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '❯ ',
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const text = line.trim()
    if (!text) {
      rl.prompt()
      return
    }

    // Command?
    if (text.startsWith('/')) {
      const parts = text.split(' ').filter(Boolean)
      const cmdName = parts[0].replace(/^\//, '')
      const cmdArgs = parts.slice(1)
      const result = await engine.executeCommand(cmdName, cmdArgs)
      if (result.success) {
        console.log(`\n${result.output}\n`)
      } else {
        console.log(`\n⚠ ${result.error}\n`)
      }
      rl.prompt()
      return
    }

    // Chat
    try {
      process.stdout.write('… ')
      const result = await engine.query(text)
      const assistantMsg = [...result.messages].reverse().find((m) => m.role === 'assistant') as { content?: unknown } | null
      const outText = assistantMsg
        ? (typeof assistantMsg.content === 'string' ? assistantMsg.content : JSON.stringify(assistantMsg.content ?? ''))
        : ''
      console.log(`\n${outText || '(empty)'}\n`)
    } catch (e) {
      console.log(`\n⚠ ${(e as Error).message}\n`)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    console.log('\n[CLI] Bye!')
    process.exit(0)
  })
}

init().catch(err => {
  console.error('[CLI] Fatal:', err)
  process.exit(1)
})
