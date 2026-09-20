async function main() {
  const { commandRegistry } = await import('../src/engine/commands/registry.ts')
  const names = commandRegistry.getNames()
  console.log('total:', names.length, '| tree:', names.includes('tree'))
  const cmd = commandRegistry.get('tree')
  const r = await cmd.execute(['{"a":1,"b":{"c":2,"d":[1,2]}}'])
  console.log('success:', r.success)
  console.log(r.output)
}
main().catch(e => { console.error(e); process.exit(1) })