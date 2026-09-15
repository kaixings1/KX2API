const fs = require('fs');
const f = 'D:/KX2API/src/engine/api/client.ts';
const lines = fs.readFileSync(f, 'utf-8').split('\n');
// 打印 250-300 和 670-720
console.log('=== 250-305 ===');
for (let i = 249; i < 305; i++) console.log((i+1) + ': ' + lines[i].trim().slice(0, 130));
console.log('\n=== 670-725 ===');
for (let i = 669; i < 725; i++) if (lines[i] !== undefined) console.log((i+1) + ': ' + lines[i].trim().slice(0, 130));