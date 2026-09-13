import { createEngine, getEngine } from './src/engine/core.ts'
import { importCommands } from './src/engine/commands/importer.ts'

async function main() {
  createEngine({
    apiKey: '',
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
  })

  const engine = getEngine()
  const count = await importCommands()
  console.log(`[CLI] ${count} commands loaded\n`)

  const tests = [
    ['help', []],
    ['ls', []],
    ['pwd', []],
    ['whoami', []],
    ['date', []],
    ['git-status', []],
    ['echo', ['hello', 'world']],
    ['explain', ['test.ts']],
  ]

  for (const [cmd, args] of tests) {
    console.log(`\n--- /${cmd} ${args.join(' ')} ---`)
    const result = await engine.executeCommand(cmd, args)
    console.log(`success: ${result.success}`)
    console.log(`output: ${(result.output || '').slice(0, 100)}`)
    if (result.error) console.log(`error: ${result.error}`)
    if (result.needsAgent) console.log(`needsAgent: true`)
  }

  console.log('\n[CLI] Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
