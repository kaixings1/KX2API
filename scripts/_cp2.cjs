const fs = require('node:fs')
const pairs = [
  ['D:/src/utils/messageFormat.ts', 'D:/KX2API/src/utils/messageFormat.ts'],
  ['D:/src/utils/textUtils.ts', 'D:/KX2API/src/utils/textUtils.ts'],
]
for (const [s, d] of pairs) {
  fs.copyFileSync(s, d)
  console.log('copied ' + d + ' (' + fs.readFileSync(d, 'utf8').split('\n').length + '行)')
}