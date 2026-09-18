import { parseReferences } from './src/engine/history/references.ts'

const cases = [
  '看看 @src/index.ts:10-20 这段',
  '@a.ts:5',
  '@package.json',
]
for (const c of cases) {
  console.log(JSON.stringify(c), '=>', JSON.stringify(parseReferences(c)))
}
