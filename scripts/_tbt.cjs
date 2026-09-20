const fs = require('node:fs')
const path = require('node:path')
let hit = []
function walk(d){for(const n of fs.readdirSync(d)){const p=d+'/'+n;const st=fs.statSync(p);if(st.isDirectory()){if(n!=='node_modules')walk(p)}else if(/\.tsx?$/.test(n)){let t='';try{t=fs.readFileSync(p,'utf8')}catch{};if(t.includes('parseTokenBudget')||t.includes('SHORTHAND_START_RE'))hit.push(p.replace('D:/KX2API/',''))}}}
walk('D:/KX2API/src')
console.log('parseTokenBudget in K:', hit.length ? hit.join(', ') : 'NOT FOUND')