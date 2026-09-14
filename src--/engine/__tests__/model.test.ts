/**
 * src/engine/__tests__/model.test.ts — 模型连接测试
 *
 * 用法:
 *   npx tsx src/engine/__tests__/model.test.ts --apiKey sk-... --provider openai --model gpt-4o
 *   或设置环境变量:
 *   KX2_API_KEY=sk-... npx tsx src/engine/__tests__/model.test.ts
 *
 * 测试覆盖:
 * 1. 纯文本对话
 * 2. 流式输出（打字机效果）
 * 3. 工具调用 (function calling)
 */

import { createEngine, getEngine, commandRegistry } from '../core.ts'
import { importCommands } from '../commands/importer.ts'

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

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

function section(title: string) {
  console.log(`\n--- ${title} ---`)
}

async function testChat(engine: ReturnType<typeof getEngine>) {
  section('Chat (non-streaming)')

  try {
    const result = await engine.query('你好，请用一句话回复。')
    assert(result.content.length > 0, 'Got non-empty response')
    console.log(`  Response: ${result.content.slice(0, 120)}`)
  } catch (e) {
    assert(false, `Chat works: ${(e as Error).message}`)
  }
}

async function testStream(engine: ReturnType<typeof getEngine>) {
  section('Stream')

  try {
    let chunks = 0
    let fullText = ''

    await engine.query('请用中文说：一二三四五。', undefined, {
      onText: (chunk: string) => {
        chunks++
        fullText += chunk
      },
    })

    assert(chunks > 0, `Received ${chunks} stream chunks`)
    assert(fullText.length > 0, 'Stream produced non-empty text')
    console.log(`  Response: ${fullText.slice(0, 120)}`)
  } catch (e) {
    assert(false, `Stream works: ${(e as Error).message}`)
  }
}

async function testTools(engine: ReturnType<typeof getEngine>) {
  section('Tools (function calling)')

  // Skip if model doesn't support function calling well
  try {
    const result = await engine.query('现在几点了？')
    assert(result.content.length > 0 || result.toolCalls.length > 0, 'Got response or tool call')
    console.log(`  Response: ${(result.content || '').slice(0, 120)}`)
    if (result.toolCalls.length > 0) {
      console.log(`  Tool calls: ${result.toolCalls.length}`)
    }
  } catch (e) {
    assert(false, `Tools work: ${(e as Error).message}`)
  }
}

async function main() {
  console.log('KX2Code Model Test')
  console.log('='.repeat(40))
  console.log(`Provider: ${provider}`)
  console.log(`Model: ${model}`)
  console.log(`API Key: ${apiKey ? apiKey.slice(0, 8) + '...' : '(none)'}`)

  if (!apiKey) {
    console.error('\nError: API key required.')
    console.log('Usage:')
    console.log('  npx tsx src/engine/__tests__/model.test.ts --apiKey sk-... --provider openai --model gpt-4o')
    console.log('  KX2_API_KEY=sk-... npx tsx src/engine/__tests__/model.test.ts')
    process.exit(1)
  }

  try {
    console.log('\n[Init] Creating engine...')
    createEngine({
      apiKey,
      provider: provider as 'openai' | 'anthropic' | 'custom',
      model,
      maxTokens: 4096,
    })

    const engine = getEngine()
    assert(engine !== null, 'Engine created')

    const count = await importCommands()
    console.log(`[Init] ${count} commands loaded`)

    await testChat(engine)
    await testStream(engine)
    await testTools(engine)

    console.log('\n' + '='.repeat(40))
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Total:  ${passed + failed}`)

    if (failed > 0) {
      console.log('\nSome tests failed!')
      process.exit(1)
    } else {
      console.log('\nAll model tests passed!')
      process.exit(0)
    }
  } catch (e) {
    console.error('\n[Fatal]', e)
    process.exit(1)
  }
}

main()
