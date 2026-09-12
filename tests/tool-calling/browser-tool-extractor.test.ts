import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BrowserToolCallExtractor,
  extractFromHttpRequest,
  extractFromHttpResponse,
  extractFromStreamChunks,
  extractFromDom,
  extractFromApiRecords,
  type RawHttpRequest,
  type RawHttpResponse,
  type DomSnapshot,
  type ApiCallRecord,
} from '../../src/main/proxy/toolCalling/browserToolExtractor.ts'

// ─── extractFromHttpRequest ───────────────────────────────────────

test('extractFromHttpRequest: OpenAI tool_calls request body', () => {
  const req: RawHttpRequest = {
    url: 'https://chat.example.com/v1/chat/completions',
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'Read', arguments: '{"filePath":"/tmp/a"}' } }],
    }),
  }
  const calls = extractFromHttpRequest(req)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Read')
})

test('extractFromHttpRequest: MCP JSON-RPC tools/call', () => {
  const req: RawHttpRequest = {
    url: 'https://mcp.example.com/rpc',
    method: 'POST',
    body: JSON.stringify({ method: 'tools/call', params: { name: 'default_api:read_file', arguments: { path: '/tmp/a' } } }),
  }
  const calls = extractFromHttpRequest(req)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'default_api:read_file')
})

test('extractFromHttpRequest: empty body returns empty', () => {
  const calls = extractFromHttpRequest({ url: '/test', method: 'POST' })
  assert.equal(calls.length, 0)
})

// ─── extractFromHttpResponse ──────────────────────────────────────

test('extractFromHttpResponse: OpenAI tool_calls response', () => {
  const resp: RawHttpResponse = {
    status: 200,
    body: JSON.stringify({
      choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'Bash', arguments: '{"command":"ls"}' } }] } }],
    }),
  }
  const calls = extractFromHttpResponse(resp)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Bash')
})

test('extractFromHttpResponse: GLM KX2API format in content', () => {
  const xml = '<|KX2API|tool_calls><|KX2API|invoke name="Read"><|KX2API|parameter name="filePath">/tmp/a</|KX2API|parameter></|KX2API|invoke></|KX2API|tool_calls>'
  const resp: RawHttpResponse = {
    status: 200,
    body: JSON.stringify({
      choices: [{ message: { role: 'assistant', content: xml } }],
    }),
  }
  const calls = extractFromHttpResponse(resp)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Read')
})

test('extractFromHttpResponse: Anthropic tool_use format', () => {
  const resp: RawHttpResponse = {
    status: 200,
    body: JSON.stringify({
      content: [{ type: 'tool_use', name: 'search', input: { query: 'test' } }],
    }),
  }
  const calls = extractFromHttpResponse(resp)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'search')
})

test('extractFromHttpResponse: no tool calls returns empty', () => {
  const calls = extractFromHttpResponse({ status: 200, body: '{"choices":[{"message":{"role":"assistant","content":"hello"}}]}' })
  assert.equal(calls.length, 0)
})

// ─── extractFromStreamChunks ──────────────────────────────────────

test('extractFromStreamChunks: OpenAI streaming delta', () => {
  const chunks = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"Read","arguments":"{\\"filePath\\":\\"/tmp/a\\"}"}}]}}]}\n\n',
  ]
  const calls = extractFromStreamChunks(chunks)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Read')
})

test('extractFromStreamChunks: KX2API marker across chunks', () => {
  const chunks = [
    '<|KX2API|tool_calls>',
    '<|KX2API|invoke name="Read"><|KX2API|parameter name="filePath">/tmp/a</|KX2API|parameter></|KX2API|invoke>',
    '</|KX2API|tool_calls>',
  ]
  const calls = extractFromStreamChunks(chunks)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Read')
})

// ─── extractFromDom ──────────────────────────────────────────────

test('extractFromDom: script tag with function call', () => {
  const snapshot: DomSnapshot = {
    scriptContents: [
      `const result = Read({ filePath: "/tmp/a" });
       window.__TOOL_CALLS__ = [{ "name": "Read", "arguments": {"filePath":"/tmp/a"} }];`,
    ],
  }
  const calls = extractFromDom(snapshot)
  assert.ok(calls.some(c => c.function.name === 'Read'), `expected Read call, got: ${JSON.stringify(calls)}`)
})

test('extractFromDom: KX2API marker in script', () => {
  const snapshot: DomSnapshot = {
    scriptContents: ['<|KX2API|tool_calls><|KX2API|invoke name="Bash"><|KX2API|parameter name="command">ls</|KX2API|parameter></|KX2API|invoke></|KX2API|tool_calls>'],
  }
  const calls = extractFromDom(snapshot)
  assert.ok(calls.some(c => c.function.name === 'Bash'), `expected Bash call, got: ${JSON.stringify(calls)}`)
})

test('extractFromDom: data-tool-name attribute', () => {
  const snapshot: DomSnapshot = {
    toolAttributes: [{ selector: '[data-test="submit"]', attributes: { 'data-tool-name': 'click', 'data-tool-args': '{"selector":"#btn"}' } }],
  }
  const calls = extractFromDom(snapshot)
  assert.ok(calls.some(c => c.function.name === 'click'), `expected click call, got: ${JSON.stringify(calls)}`)
})

test('extractFromDom: global window variable', () => {
  const snapshot: DomSnapshot = {
    globalToolVars: { window__TOOL_CALLS__: [{ name: 'Read', arguments: { filePath: '/tmp/a' } }] },
  }
  const calls = extractFromDom(snapshot)
  assert.ok(calls.some(c => c.function.name === 'Read'), `expected Read call, got: ${JSON.stringify(calls)}`)
})

test('extractFromDom: empty snapshot returns empty', () => {
  const calls = extractFromDom({})
  assert.equal(calls.length, 0)
})

// ─── extractFromApiRecords ────────────────────────────────────────

test('extractFromApiRecords: request + response pair', () => {
  const records: ApiCallRecord[] = [
    {
      url: 'https://chat.example.com/v1/chat/completions',
      method: 'POST',
      requestBody: { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }], tool_choice: 'auto' },
      responseBody: { choices: [{ message: { role: 'assistant', content: 'ok' } }] },
    },
  ]
  const calls = extractFromApiRecords(records)
  assert.equal(calls.length, 0) // no tool_calls in response, no tool_calls in request body
})

test('extractFromApiRecords: tool_calls in response', () => {
  const records: ApiCallRecord[] = [
    {
      url: 'https://chat.example.com/v1/chat/completions',
      method: 'POST',
      requestBody: { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }], tool_choice: 'auto' },
      responseBody: { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Grep', arguments: '{"pattern":"test"}' } }] } }] },
    },
  ]
  const calls = extractFromApiRecords(records)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'Grep')
})

// ─── BrowserToolCallExtractor (unified) ──────────────────────────

test('BrowserToolCallExtractor: unified extraction from all signals', () => {
  const extractor = new BrowserToolCallExtractor({ minConfidence: 'medium' })
  const result = extractor.extract({
    requests: [
      { url: 'https://chat.example.com/v1/chat/completions', method: 'POST', body: JSON.stringify({ tool_choice: 'auto', messages: [] }) },
    ] as RawHttpRequest[],
    responses: [
      { status: 200, body: JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Edit', arguments: '{"path":"/tmp/a"}' } }] } }] }) },
    ] as RawHttpResponse[],
    domSnapshot: {
      scriptContents: ['const calls = [{ name: "Write", arguments: { file_path: "/tmp/b" } }];'],
    } as DomSnapshot,
  })

  assert.ok(result.toolCalls.length >= 1, `expected >= 1 call, got: ${result.toolCalls.length}`)
  assert.ok(result.toolCalls.some(c => c.function.name === 'Edit'), `expected Edit call, got: ${JSON.stringify(result.toolCalls)}`)
  assert.ok(result.toolCalls.some(c => c.function.name === 'Write'), `expected Write call, got: ${JSON.stringify(result.toolCalls)}`)
})

test('BrowserToolCallExtractor: de-duplicates across sources', () => {
  const extractor = new BrowserToolCallExtractor()
  const callArgs = JSON.stringify({ filePath: '/tmp/a' })
  const result = extractor.extract({
    responses: [
      { status: 200, body: JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Read', arguments: callArgs } }] } }] }) },
    ] as RawHttpResponse[],
    apiRecords: [
      { url: '/test', method: 'POST', responseBody: JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Read', arguments: callArgs } }] } }] }) },
    ] as ApiCallRecord[],
  })

  // Same call from response and apiRecords should be deduped
  assert.equal(result.toolCalls.filter(c => c.function.name === 'Read').length, 1)
})

test('BrowserToolCallExtractor: respects maxCalls limit', () => {
  const extractor = new BrowserToolCallExtractor({ maxCalls: 2 })
  const bodies = Array.from({ length: 5 }, (_, i) =>
    JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: `c${i}`, type: 'function', function: { name: `Tool${i}`, arguments: '{}' } }] } }] })
  )
  const result = extractor.extract({
    responses: bodies.map(b => ({ status: 200, body: b })) as RawHttpResponse[],
  })

  assert.ok(result.toolCalls.length <= 2, `expected <= 2, got: ${result.toolCalls.length}`)
})

test('BrowserToolCallExtractor: respects confidence filter', () => {
  const extractor = new BrowserToolCallExtractor({ minConfidence: 'high' })
  // extractFromDom only returns high-confidence calls for script function calls
  const result = extractor.extract({
    domSnapshot: {
      toolAttributes: [{ selector: '[data-tool="x"]', attributes: { 'data-tool-name': 'LowTool', 'data-tool-args': '{}' } }],
    } as DomSnapshot,
  })

  // data-tool-name is medium confidence, should be filtered out
  assert.equal(result.toolCalls.filter(c => c.function.name === 'LowTool').length, 0)
})

test('BrowserToolCallExtractor: reset clears state', () => {
  const extractor = new BrowserToolCallExtractor()
  extractor.extract({
    responses: [{ status: 200, body: JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'Read', arguments: '{"fp":"/a"}' } }] } }] }) }],
  })
  const count1 = extractor.extract({
    responses: [{ status: 200, body: JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c2', type: 'function', function: { name: 'Read', arguments: '{"fp":"/a"}' } }] } }] }) }],
  }).toolCalls.length
  assert.equal(count1, 0) // deduped by same args
})

test('BrowserToolCallExtractor: empty signals returns empty', () => {
  const extractor = new BrowserToolCallExtractor()
  const result = extractor.extract({})
  assert.equal(result.toolCalls.length, 0)
  assert.equal(result.protocol, 'unknown')
})
