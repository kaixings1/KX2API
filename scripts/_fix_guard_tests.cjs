const fs=require('fs');
const files=[
  ['tests/engine/tool-history-guard-validate.test.ts','validate'],
  ['tests/engine/tool-history-guard-fix.test.ts','fix'],
];
for(const [f] of files){
  let s=fs.readFileSync(f,'utf8');
  s=s.replace(/from "\.\."/g, 'from "../../src/engine/tool-history-guard/index.ts"');
  s=s.replace(/from '\.\.'/g, "from '../../src/engine/tool-history-guard/index.ts'");
  fs.writeFileSync(f,s,'utf8');
}
console.log('导入路径已修正');
