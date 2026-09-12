# tool-history-guard

`tool-history-guard` is a tiny TypeScript library that validates and safely repairs broken AI tool-call history before you send it to a model API.

This library is built for a common failure mode in agent systems: retries, resume flows, interrupts, and bad message assembly can leave tool-call and tool-result messages out of sync. The result is often a hard API error. This package gives you a focused preflight check without pulling in an agent framework.

## What it solves

- Detects missing tool results
- Detects orphan tool results
- Detects result ordering problems
- Detects duplicate tool results for the same call id
- Detects malformed `tool_call_id` / `tool_use_id` references
- Applies a few safe structural fixes when enabled

The default adapter understands common OpenAI-style and Anthropic-style message shapes. The API is intentionally small so custom adapters can be added later.

## Installation

```bash
npm install tool-history-guard
```

For local development in this repo:

```bash
npm install
npm test
```

## Usage

```ts
import { fixToolHistory, validateToolHistory } from "tool-history-guard";

const messages = [
  { role: "user", content: "Look up the weather in Dubai." },
  {
    role: "assistant",
    content: "",
    tool_calls: [{ id: "call_1", type: "function", function: { name: "weather" } }],
  },
  {
    role: "tool",
    tool_call_id: "call_1",
    content: "{\"tempC\":31}",
  },
];

const validation = validateToolHistory(messages);
console.log(validation.valid);

const fixed = fixToolHistory(messages, {
  removeOrphanToolResults: true,
});
console.log(fixed.fixedMessages);
```

## Example input / output

### 1. Valid history

```ts
const messages = [
  { role: "user", content: "Search the docs." },
  {
    role: "assistant",
    tool_calls: [{ id: "call_1", type: "function", function: { name: "search" } }],
  },
  { role: "tool", tool_call_id: "call_1", content: "{\"hits\":3}" },
];

validateToolHistory(messages);
// {
//   valid: true,
//   errors: [],
//   warnings: []
// }
```

### 2. Orphan tool result

```ts
const messages = [
  { role: "tool", tool_call_id: "missing_call", content: "{\"ok\":true}" },
];

validateToolHistory(messages);
// valid === false
// errors[0].code === "tool_result_without_call"
```

### 3. Missing tool result

```ts
const messages = [
  {
    role: "assistant",
    tool_calls: [{ id: "call_2", type: "function", function: { name: "search" } }],
  },
];

validateToolHistory(messages);
// valid === false
// errors[0].code === "tool_call_without_result"
```

### 4. Duplicated tool result

```ts
const messages = [
  {
    role: "assistant",
    tool_calls: [{ id: "call_3", type: "function", function: { name: "search" } }],
  },
  { role: "tool", tool_call_id: "call_3", content: "{\"ok\":true}" },
  { role: "tool", tool_call_id: "call_3", content: "{\"ok\":true}" },
];

fixToolHistory(messages);
// valid === true
// warnings include "applied_dedupe_tool_result"
```

### 5. Reordered fixed result

```ts
const messages = [
  { role: "tool", tool_call_id: "call_4", content: "{\"ok\":true}" },
  {
    role: "assistant",
    tool_calls: [{ id: "call_4", type: "function", function: { name: "search" } }],
  },
];

fixToolHistory(messages);
// fixedMessages[0].role === "assistant"
// fixedMessages[1].role === "tool"
```

## API

### `validateToolHistory(messages, options?)`

Validates message history and returns:

```ts
{
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
```

### `fixToolHistory(messages, options?)`

Runs the same validation and applies a small set of safe fixes:

- Reorder an adjacent misplaced tool result when it clearly matches the next assistant tool-call message
- Remove an orphan tool-result message when `removeOrphanToolResults: true`
- Dedupe identical adjacent tool-result messages

Returns:

```ts
{
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  fixedMessages: Message[];
}
```

### Options

```ts
{
  adapter?: HistoryAdapter;
  reorderAdjacentToolResults?: boolean; // default: true
  dedupeToolResults?: boolean; // default: true
  removeOrphanToolResults?: boolean; // default: false
}
```

### Custom adapters

If your stack uses a different message format, pass a small adapter:

```ts
import type { HistoryAdapter } from "tool-history-guard";

const adapter: HistoryAdapter = {
  getToolCalls(message) {
    return [];
  },
  getToolResults(message) {
    return [];
  },
};
```

## Limitations

- The default fixer only performs message-level repairs. It does not rewrite mixed-content messages.
- It does not invent missing tool results or patch malformed ids.
- It assumes tool call ids are unique within the history.
- Duplicate result auto-fix is intentionally conservative and only removes identical adjacent duplicates.
- Validation focuses on structural correctness, not tool schema correctness or business logic.

## Future ideas

- Provider-specific adapters for stricter OpenAI, Anthropic, and Gemini validation
- Optional duplicate tool-call id detection
- More fix strategies for batched tool-result containers
- A debug formatter for compact issue reports

## Author

Arman Aslanyan  
LinkedIn: https://www.linkedin.com/in/arman-aslanyan/

## Development

```bash
npm install
npm run build
npm test
```
