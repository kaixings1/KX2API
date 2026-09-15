const fs = require('fs');
const s = fs.readFileSync('D:/KX2API/out/main/index.js', 'utf-8');
const checks = ['LOOP_GUARD', '模型重复请求完全相同工具调用', '去重纯文本工具调用', 'Command tools registered', 'chat:streamToolStart'];
for (const c of checks) console.log(c, '->', s.split(c).length - 1, '次');