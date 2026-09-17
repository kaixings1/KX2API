import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/loadbalancer.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 本文件第 8 行**已经静态导入** storeManager（`import { storeManager } from '../store/store'`），
// 469 行的 `require('../store/store')` 因此既多余、又在 ESM 产物里致命：
// main 的构建输出是 `format: 'es'`，产物中该行原样保留
//   const { storeManager: storeManager2 } = require("../store/store");
// 而 ESM 里没有 require → 运行时抛 "require is not defined"。
// （这也是唯一会让 createLoadBalancer 恒走 catch、熔断参数永远读不到用户配置的原因。）
const re =
  /  try \{\r?\n    const \{ storeManager \} = require\('\.\.\/store\/store'\)\r?\n    const cfg = storeManager\.getConfig\(\) as \{ loadBalancer\?: LoadBalancerOptions \} \| void\r?\n    return new LoadBalancer\(cfg\?\.loadBalancer \?\? \{\}\)\r?\n  \} catch \{\r?\n    return new LoadBalancer\(\)\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中 createLoadBalancer 函数体')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  try {',
    '    // 直接用顶部已静态导入的 storeManager。',
    '    // 原写法 `require("../store/store")` 在 ESM 产物里会原样保留，',
    '    // 运行时抛 "require is not defined"，被下面的 catch 吞掉后',
    '    // 表现为「熔断参数永远读不到用户配置、恒用默认值」。',
    '    const cfg = storeManager.getConfig() as { loadBalancer?: LoadBalancerOptions } | void',
    '    return new LoadBalancer(cfg?.loadBalancer ?? {})',
    '  } catch {',
    '    return new LoadBalancer()',
    '  }',
  ].join(NL),
)

writeFileSync(p, s)
console.log('已改: ' + p)
