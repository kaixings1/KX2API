import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// ./routes 没有具名导出 `routes`，它的默认导出才是路由数组。
s = s.replace(
  "export { routes } from './routes'",
  "// ./routes 的默认导出是「路由数组」，具名导出是各个 router\nexport { default as routes } from './routes'",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
