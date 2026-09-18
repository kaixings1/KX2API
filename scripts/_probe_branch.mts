import { extractToolCallsFromText, ToolCallExtractor } from '../src/main/proxy/toolCalling/toolCallExtractor.ts'

const text = `<tool_call>
  <toolName>ls</toolName>
  <arguments>
    <path>.</path>
    <showHidden>false</showHidden>
  </arguments>
</tool_call>`

console.log('=== extractToolCallsFromText（非流式入口）===')
console.log(JSON.stringify(extractToolCallsFromText(text), null, 2))

console.log('\n=== 直接构造 ToolCallExtractor.process + flush ===')
const ex = new ToolCallExtractor()
const r1 = ex.process(text)
const r2 = ex.flush()
console.log('process:', JSON.stringify({ content: r1.content, toolCalls: r1.toolCalls?.length, protocol: r1.protocol }))
console.log('flush  :', JSON.stringify(r2, null, 2))
