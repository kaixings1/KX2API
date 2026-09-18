import { readFileSync, rmSync } from 'node:fs'

const src = readFileSync('src/engine/toolNameCompat.ts', 'utf8')
const mapStart = src.indexOf('const CONCEPT_BY_ALIAS')
const block = src.slice(mapStart, src.indexOf('codeinterpreter') + 60)
const aliases = {}
for (const m of block.matchAll(/(\w+):\s*'(\w+)'/g)) aliases[m[1]] = m[2]
