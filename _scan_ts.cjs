const fs = require('fs')
const c1 = fs.readFileSync('src/shared/types.ts', 'utf8')
const lines1 = c1.split('\n')
console.log('=== shared/types.ts 中 enabledToolGroups 上下文 ===')
// 往前找是哪个 interface
lines1.forEach((l, i) => {
  if (l.indexOf('enabledToolGroups') >= 0) {
    for (let j = i - 6; j <= i + 1; j++) {
      if (lines1[j] !== undefined) console.log((j + 1) + ': ' + lines1[j])
    }
    console.log('---')
  }
})
const c2 = fs.readFileSync('src/main/store/types.ts', 'utf8')
const lines2 = c2.split('\n')
console.log('=== store/types.ts 中 enabledToolGroups 上下文 ===')
lines2.forEach((l, i) => {
  if (l.indexOf('enabledToolGroups') >= 0) {
    for (let j = Math.max(0, i - 8); j <= i + 1; j++) {
      if (lines2[j] !== undefined) console.log((j + 1) + ': ' + lines2[j])
    }
    console.log('---')
  }
})