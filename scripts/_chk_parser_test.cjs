const fs=require('fs'),path=require('path');
function find(d,target){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const full=path.join(d,e.name);
    if(e.isDirectory()) find(full,target);
    else if(e.name===target) console.log('找到:',full.replace(/\\\\/g,'/'));
  }
}
find('src','parser.test.ts');
console.log('--- vitest include 规则 ---');
console.log(require('fs').readFileSync('vitest.config.ts','utf8').split('\n').slice(5,16).join('\n'));
