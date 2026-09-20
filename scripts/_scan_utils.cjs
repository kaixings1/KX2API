const fs = require('node:fs')
const files = [
  'set', 'semver', 'semanticBoolean', 'semanticNumber', 'array', 'uuid',
  'mergeUtils', 'truncate', 'xml', 'objectGroupBy', 'contentArray', 'taggedId',
  'hash', 'intl', 'yaml', 'stringify', 'strictFormatter', 'jsonIO', 'textUtils',
  'html', 'markdown', 'pathResolution', 'binaryCheck', 'attribution', 'circularBuffer',
]
for (const base of files) {
  const src = `D:/src/utils/${base}.ts`
  let lines = '?'
  try { lines = fs.readFileSync(src, 'utf8').split('\n').length; }
  catch (e) { /* skip missing */ }
  // find in K
  try {
    const kLines = fs.readFileSync(`D:/KX2API/src/utils/${base}.ts`, 'utf8').split('\n').length
    console.log(`${base.padEnd(20)} SRC=${lines}  K_EXISTS=${kLines}`)
  } catch {
    // not at src/utils; search broader
    console.log(`${base.padEnd(20)} SRC=${lines}  K_MISSING_in_src_utils`)
  }
}