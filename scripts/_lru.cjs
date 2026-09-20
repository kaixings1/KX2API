// 检查 lru-cache 版本与导出方式，以及 K 现有用法
const fs = require('node:fs')
const path = require('node:path')
try {
  const pkg = JSON.parse(fs.readFileSync('D:/KX2API/node_modules/lru-cache/package.json', 'utf8'))
  console.log('lru-cache version:', pkg.version)
  console.log('main:', pkg.main, '| exports:', JSON.stringify(pkg.exports ? Object.keys(pkg.exports) : null))
} catch(e) { console.log('pkg read err', e.message) }
// K 现有 import lru-cache 用法
const root = 'D:/KX2API/src'
function walk(d){for(const n of fs.readdirSync(d)){const p=d+'/'+n;const s=fs.statSync(p);if(s.isDirectory()){if(n!=='node_modules')walk(p)}else if(/\.(ts|tsx)$/.test(n)){let t='';try{t=fs.readFileSync(p,'utf8')}catch{};if(t.includes('lru-cache')){const line=t.split('\n').find(l=>l.includes('lru-cache'));console.log(p.replace('D:/KX2API/',''),'::',line?line.trim():'')}}}}
walk(root)
console.log('done')