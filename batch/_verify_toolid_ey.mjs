// 临时验证：stepfun adapter 归一化后 tool 消息必带 tool_call_id（私有方法强测）
// 同时复刻 engine/api/client.ts 的归一化逻辑做对拍，证明内部工具方言不再漏发。
import { StepFunAdapter } from '../src/main/proxy/adapters/stepfun.ts'
import { StepFunStudioAdapter } from '../src/main/proxy/adapters/stepfun-studio.ts'

function makeAccount() {
  return {
    id: 'acc1',
    name: 'acc1',
    providerId: 'stepfun',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    credentials: { token: 'sk-TESTAPIKEY-aabbccddeeff001122334455', apiKey: 'sk-TESTAPIKEY' },
  }
}

function makeProvider() {
  return {
    id: 'stepfun',
    name: 'StepFun',
    type: 'custom',
    authType: 'token',
    apiEndpoint: 'https://api.stepfun.com',
    headers: {},
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

const req = {
  model: 'step-3.7-turbo',
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
    // 内部方言：带 toolUseId，不带 tool_call_id —— 这是真实 400 的场景
    { role: 'tool', content: 'ok', toolUseId: 'tk_111' },
    // Anthropic 方言
    { role: 'tool', content: 'ok2', tool_use_id: 'tu_222' },
    // OpenAI 方言，原样保留
    { role: 'tool', content: 'ok3', tool_call_id: 'tc_333' },
    { role: 'assistant', content: 'done' },
  ],
  stream: false,
}

const adapter = new StepFunAdapter(makeProvider(), makeAccount())
const built = (adapter as any).buildStepPlanRequest(req)

console.log('=== stepfun.buildStepPlanRequest 归一化结果 ===')
for (const m of built.messages) {
  console.log(JSON.stringify({ role: m.role, tool_call_id: m.tool_call_id ?? null, tool_calls: !!m.tool_calls, content: (m.content || '').slice(0, 12) }))
}

let stepfunBad = 0
for (const m of built.messages) {
  if (m.role === 'tool' && (typeof m.tool_call_id !== 'string' || m.tool_call_id === '')) {
    stepfunBad++
    console.log('STEPFUN 仍缺 tool_call_id:', JSON.stringify(m))
  }
}

// stepfun-studio 等价验证
const studio = new StepFunStudioAdapter(makeProvider(), makeRoot())
const sbody = (studio as any).buildStepPlanRequest(req)
let studioBad = 0
for (const m of sbody.messages) {
  if (m.role === 'tool' && (typeof m.tool_call_id !== 'string' || m.tool_call_id === '')) {
    studioBad++
    console.log('STUDIO 缺 tool_call_id:', JSON.stringify(m))
  }
}

console.log('---')
console.log('stepfun 缺 tool_call_id 条数 =', stepfunBad ?? 0)
console.log('studio 缺 tool_call_id 条数 =', studioBad)

if ((stepfunBad ?? 1) === 0 && studioBad === 0) {
  console.log('RESULT: PASS — 所有 tool 消息均携带 tool_call_id')
} else {
  console.log('RESULT: FAIL — 存在缺 tool_call_id 的 tool 消息')
  process.exit(1)
}

// 等价验证 engine/api/client.ts 的归一化表达式（无网络调用）
function engineNormalize(messages) {
  return messages
    .map((m) => {
      const { role, content, ...rest } = m
      return { ...rest, role, content }
    })
    .map((msg) => {
      if (msg.role !== 'tool') return msg
      const id = String(msg.tool_call_id || msg.toolUseId || msg.tool_use_id || '')
      const out = { ...msg, tool_call_id: id }
      delete out.toolUseId
      delete out.tool_use_id
      return out
    })
}
const eng = engineNormalize(req.messages)
let engBad = 0
for (const m of eng) {
  if (m.role === 'tool' && (typeof m.tool_call_id !== 'string' || m.tool_call_id === '')) {
    engBad++
    console.log('ENGINE 缺 tool_call_id:', JSON.stringify(m))
  }
}
console.log('engine 归一化缺 tool_call_id 条数:', engBad)
if (engBad !== 0) { console.log('RESULT: ENGINE FAIL'); process.exit(1) }

console.log('RESULT: ENGINE PASS')