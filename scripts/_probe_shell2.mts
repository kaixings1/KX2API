import { commandRegistry } from '../src/engine/commands/registry.ts'

for (const n of ['shell', 'cmd', 'grep', 'findstr', 'dir', 'bash', 'exec']) {
  const cmd = commandRegistry.get(n)
  if (!cmd) {
    console.log(`${n.padEnd(10)} registry 里没有`)
    continue
  }
  console.log(`${n.padEnd(10)} 有。字段: ${Object.keys(cmd).join(', ')}`)
  console.log(`            description=${String(cmd.description ?? '').slice(0, 60)}`)
  console.log(`            execute 是函数吗: ${typeof (cmd as { execute?: unknown }).execute}`)
}
