const fs = require('fs');
const path = 'D:/KX2API/log.txt';
const text = fs.readFileSync(path, 'utf-8');
const lines = text.split('\n');

console.log('=== 总行数 ===', lines.length);
console.log('=== 总字节 ===', fs.statSync(path).size);

// 关键事件计数
const counts = {};
const check = (linePrefix, key) => {
  const n = lines.filter(l => l.includes(linePrefix)).length;
  if (n > 0) { counts[key] = n; }
};
check('Previous tool calls were invalid', 'invalid提示');
check('tool_call', 'tool_call');
check('"[TOOL', 'TOOL标记');
check('[ENGINE', 'ENGINE标记');
check('[LOOP]', 'LOOP');
check('iteration_start', 'iteration_start');
check('request_sent', 'request_sent');
check('tool_call_start', 'tool_call_start');
check('post_tool_use', 'post_tool_use');
check('pre_tool_use', 'pre_tool_use');
check('TOOL_CALLS', 'TOOL_CALLS');
check('TOOL_RESULTS', 'TOOL_RESULTS');
check('run START', 'run START');
check('shouldContinue', 'shouldContinue');
check('新请求', '新请求');

console.log('=== 关键计数 ===');
console.log(JSON.stringify(counts, null, 2));

// 输出所有 LOOP run 相关行
console.log('\n=== LOOP/iterator 相关行 ===');
lines.forEach((l, i) => {
  if (l.includes('[LOOP]') || l.includes('iteration_start') || l.includes('run START')) {
    console.log(i + ': ' + l.slice(0, 200));
  }
});