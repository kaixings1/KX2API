const fs=require('fs'),path=require('path');
const root='src';
const out=[];
function walk(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const full=path.join(d,e.name);
    if(e.isDirectory()){ if(e.name==='node_modules') continue; walk(full); }
    else if(/\.test\.tsx?$/.test(e.name) && !full.includes('__tests__')){ out.push(full.replace(/\\\\/g,'/')); }
  }
}
walk(root);
console.log('不在 __tests__ 下的测试文件（vitest 不收集）：', out.length);
out.forEach(f=>console.log('  -',f));
