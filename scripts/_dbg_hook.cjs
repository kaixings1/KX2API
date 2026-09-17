
const { spawn } = require('child_process')

function run(cmd, shellOpt, label) {
  return new Promise(resolve => {
    let out = '', err = ''
    const c = spawn(cmd, [], { shell: shellOpt, windowsHide: true })
    c.stdout.on('data', b => out += b.toString())
    c.stderr.on('data', b => err += b.toString())
    c.on('close', code => {
      console.log(`[${label}] code=${code}`)
      console.log(`   stdout=${JSON.stringify(out)}`)
      if (err.trim()) console.log(`   stderr=${JSON.stringify(err.slice(0,200))}`)
      resolve()
    })
    c.on('error', e => { console.log(`[${label}] spawn error: ${e.message}`); resolve() })
  })
}

;(async () => {
  const json = JSON.stringify({ decision: 'deny', reason: 'blocked' }).replace(/"/g, '\\"')
  const cmd = `echo "${json}"`
  console.log('cmd =', JSON.stringify(cmd))
  await run(cmd, 'bash.exe', 'bash.exe + echo')
  await run(cmd, true, 'default shell + echo')
  console.log('PATH bash check:')
  await run('command -v bash || echo NO_BASH', 'bash.exe', 'bash lookup')
})()
