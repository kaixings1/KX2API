# llm-tool-parser

A TypeScript utility for extracting and normalizing tool calls from large language model outputs.

It supports both native tool calling formats (OpenAI `tool_calls`, Claude `tool_use`, etc.) and “text-based tool calls” commonly produced by open-source or fine-tuned models.

The library converts inconsistent, streaming, or partially corrupted LLM outputs into a clean and unified `ToolCall` structure, making it easier to build reliable agent runtimes.

### Key features

* Supports multiple LLM ecosystems (OpenAI, Claude, DeepSeek, Qwen, etc.)
* Extracts tool calls from raw text, JSON, XML, and hybrid formats
* Handles streaming, trailing text, and malformed outputs
* Normalizes all inputs into a unified `ToolCall` schema
* Works with both structured tool calling and prompt-based agents

## Live parse

**Live parse:** https://saber2pr.top/llm-tool-parser/

## Simple usage

Examples below are based on `src/parser.test.ts`.

```ts
import { parseLlmToolCalls } from 'llm-tool-parser'

const text =
  '{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/a.ts"}}]}'

const { content, toolCalls } = parseLlmToolCalls(text)

console.log(content)
console.log(toolCalls[0]?.name)
console.log(toolCalls[0]?.arguments)
```

You can also parse model outputs that contain extra text:

```ts
const text =
  '让我来查看一下\n{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}'

const { content, toolCalls } = parseLlmToolCalls(text)

console.log(content) // 让我来查看一下
console.log(toolCalls)
/**
[
  {
    id: 'call_1780567643675_6a8b',
    name: 'fileRead',
    arguments: { filePath: '/a.ts' }
  }
]
 */
```

And code-fenced JSON is supported too:

```ts
const text =
  '我来读取文件\n```json\n{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/a.ts"}}]}\n```'

const { content, toolCalls } = parseLlmToolCalls(text)
```

## Supported parsable formats

Based on all test cases in `src/parser.test.ts`, the parser currently supports these input patterns:

### 1. OpenAI-style `tool_calls`

```json
{"tool_calls":[{"tool_name":"fileRead","arguments":{"filePath":"/tmp/a.ts"}}]}
```

- single or multiple calls in one `tool_calls` array
- multiple consecutive JSON blocks
- JSON at the start with trailing text
- plain text before the JSON block
- JSON inside fenced code blocks

### 2. Single `tool_name` object

```json
{"tool_name":"bash","arguments":{"command":"ls"}}
```

### 3. `[tool_calls]` marker + JSON objects

```txt
[tool_calls]{"tool":"grep","args":{"pattern":"hello"}}{"tool":"glob","args":{"pattern":"*.ts"}}
```

### 4. `Action` / `Arguments` text format

```txt
Action: fileRead
Arguments: {"filePath":"/tmp/test.ts"}
```

Also supports non-JSON arguments:

```txt
Action: grep
Arguments: foo
```

### 5. XML-style tool tags

```xml
<fileRead>{"filePath":"/tmp/a.ts"}</fileRead>
```

- ignores non-tool tags like `<thinking>`
- supports XML inside fenced code blocks

### 6. CLI log style `[Called tools: ...]`

```txt
● [Called tools: fileRead({"filePath":"/tmp/a.ts"})]
```

Also supports multiple calls:

```txt
● [Called tools: grep({"pattern":"foo"}), glob({"pattern":"*.ts"})]
```

### 7. OpenAI legacy `function_call`

```json
{
  "function_call": {
    "name": "fileRead",
    "arguments": "{\"filePath\":\"/tmp/a.ts\"}"
  }
}
```

### 8. Claude `tool_use`

Content array form:

```json
{
  "content": [
    {
      "type": "tool_use",
      "name": "fileRead",
      "input": {"filePath": "/tmp/a.ts"}
    }
  ]
}
```

Standalone form:

```json
{
  "type": "tool_use",
  "name": "fileRead",
  "input": {"filePath": "/tmp/a.ts"}
}
```

### 9. OpenAI Responses API `function_call`

```json
{
  "type": "function_call",
  "name": "fileRead",
  "arguments": "{\"filePath\":\"/tmp/a.ts\"}"
}
```

### 10. Simple `tool` + `args` object

```json
{"tool":"fileRead","args":{"filePath":"/tmp/a.ts"}}
```

### 11. Root array of tool calls

```json
[
  {"tool":"grep","args":{"pattern":"foo"}},
  {"tool":"glob","args":{"pattern":"*.ts"}}
]
```
