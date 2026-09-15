const fs = require('fs');
const path = 'D:/KX2API/log.txt';
const text = fs.readFileSync(path, 'utf-8');
const lines = text.split('\n');

console.log('=== 总行数 ===', lines.length);
console.log('=== 总字节 ===', fs.statSync(path).size);

const counts = {};
const check = (linePrefix, key) => {
  const n = lines.filter(l => l.includes(linePrefix)).length;
  if (n > 0) { counts[key] = n; }
};
check('[LOOP] run START', 'run_START');
check('Previous tool calls were invalid', 'invalid提示');
check('tool_call', 'tool_call');
check('[ENGINE', 'ENGINE标记');
check('TOOL_CALLS', 'TOOL_CALLS');
check('TOOL_RESULTS', 'TOOL_RESULTS');
check('iteration_start', 'iteration_start');
check('tool_call_start', 'tool_call_start');
check('invalidTool', 'invalidTool');
check('consecutiveToolFailures', 'consecutiveToolFailures');
check('resolved', 'resolved');
check('[QSMs]', 'stateMachine');
check('respond_again', '再次响应');

console.log('=== 关键计数 ===');
console.log(JSON.stringify(counts, null, 2));

console.log('\n=== run START / invalid / tool 关键行 ===');
lines.forEach((l, i) => {
  if (l.includes('run START') || l.includes('Previous tool') || l.includes('invalid') || l.includes('[ENGINE') || l.includes('TOOL_RESULTS') || l.includes('iterate') ) {
    console.log(i + ': ' + l.slice(0, 300));
  }
});