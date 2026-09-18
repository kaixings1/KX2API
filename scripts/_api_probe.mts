/**
 * 探测 Engine 的真实 API 形状，用于判断 legacy 测试的两条失败断言
 * 是「测试过时」还是「真 bug」。
 */
const mod = await import('../src/engine/core.ts')

const engine = mod.createEngine({
  apiKey: '',
  provider: 'openai',
  model: 'gpt-4o',
  maxTokens: 4096,
})

const cfg = engine.getConfig()
console.log('getConfig() 的键:', Object.keys(cfg).join(', '))
console.log('apiKey 值类型:', typeof cfg.apiKey, JSON.stringify(cfg.apiKey))
console.log('有 apiKey 字段吗:', 'apiKey' in cfg)

const hist = engine.getHistory()
console.log('\ngetHistory() 返回类型:', Array.isArray(hist) ? 'array' : typeof hist)
console.log('getHistory() 的键:', hist && typeof hist === 'object' ? Object.keys(hist).join(', ') : '(无)')
console.log('getHistory() 原始值:', JSON.stringify(hist)?.slice(0, 200))
