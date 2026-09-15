const fs = require('fs')
const c = fs.readFileSync('src/main/store/store.ts', 'utf8')
const lines = c.split('\n')
lines.forEach((l, i) => {
  const tr = l.trim()
  if (tr.indexOf('getConfig') >= 0 || tr.indexOf('updateConfig') >= 0 || tr.indexOf('get(') >= 0 || tr.indexOf('set(') >= 0) {
    if (tr.indexOf('getConfig') >= 0 || tr.indexOf('updateConfig') >= 0) console.log((i + 1) + ': ' + tr)
  }
})