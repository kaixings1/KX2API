export interface LlmToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmToolCallParseResult {
  content: string;
  toolCalls: LlmToolCall[];
}

const IGNORED_XML_TAGS = new Set([
  "think", "thinking", "reflection", "output", "result", "answer", "response",
]);

/**
 * Parse tool calls from LLM response text.
 * Supports:
 * 1. [tool_calls] marker format: [tool_calls]{"tool":"name","args":{...}}...
 * 2. Standard JSON tool_calls embedded in text
 * 3. Action/Arguments text format
 * 4. XML tag format: <tool_name>{...}</tool_name>
 *
 * Returns the cleaned content (with tool call syntax removed) and parsed calls.
 */
export function parseLlmToolCalls(text: string): LlmToolCallParseResult {
  if (!text) return { content: "", toolCalls: [] };

  const trimmedText = text.trim();

  if (trimmedText.startsWith("[")) {
    const parsed = tryParseLooseJson(trimmedText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const toolCalls = extractToolCallsFromArray(parsed);
      if (toolCalls.length > 0) {
        return { content: "", toolCalls };
      }
    }
  }

  if (trimmedText.startsWith("{")) {
    try {
      const parsed = tryParseLooseJson<any>(trimmedText);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON object");
      }

      const result = tryParseJsonToolCalls(parsed);
      if (result) return result;

      if (typeof parsed.tool_calls === "string") {
        const nested = parseLlmToolCalls(parsed.tool_calls);
        if (nested.toolCalls.length > 0) return nested;
      }
    } catch {
      const looseRoot = tryExtractToolCallsFromToolCallsArrayText(trimmedText);
      if (looseRoot) {
        const remainderResult = looseRoot.remainder
          ? parseLlmToolCalls(looseRoot.remainder)
          : { content: "", toolCalls: [] };
        return {
          content: remainderResult.content,
          toolCalls: [...looseRoot.toolCalls, ...remainderResult.toolCalls],
        };
      }

      const allToolCalls: LlmToolCall[] = [];
      let pos = 0;
      let lastJsonEnd = 0;

      while (pos < trimmedText.length) {
        while (pos < trimmedText.length && trimmedText[pos] !== "{") pos++;
        if (pos >= trimmedText.length) break;

        const jsonStr = extractBalancedJson(trimmedText, pos);
        if (!jsonStr) break;

        try {
          const parsed = tryParseLooseJson<any>(jsonStr);
          if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid JSON object");
          }

          const result = tryParseJsonToolCalls(parsed);
          if (result && result.toolCalls.length > 0) {
            allToolCalls.push(...result.toolCalls);
            pos += jsonStr.length;
            lastJsonEnd = pos;
            continue;
          }
        } catch {
          // Not valid JSON.
        }
        break;
      }

      if (allToolCalls.length > 0) {
        const content = trimmedText.substring(lastJsonEnd).trim();
        return { content, toolCalls: allToolCalls };
      }
    }
  }

  const toolCallsJsonIdx = trimmedText.lastIndexOf('{"tool_calls"');
  if (toolCallsJsonIdx >= 0) {
    const jsonStr = extractBalancedJson(trimmedText, toolCallsJsonIdx);
    if (jsonStr) {
      const parsed = tryParseLooseJson<any>(jsonStr);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.tool_calls)) {
        const toolCalls: LlmToolCall[] = parsed.tool_calls.map((tc: any) => ({
          id: tc.id || generateId(),
          name: tc.tool_name || tc.tool || tc.name || tc.function?.name,
          arguments: parseToolArgs(
            tc.arguments || tc.args || tc.input || tc.function?.arguments,
          ),
        }));
        if (toolCalls.length > 0) {
          const content = trimmedText.substring(0, toolCallsJsonIdx).trim();
          return { content, toolCalls };
        }
      }
    } else {
      const partialToolCalls = tryExtractPartialToolCalls(
        trimmedText.substring(toolCallsJsonIdx),
      );
      if (partialToolCalls.length > 0) {
        const content = trimmedText.substring(0, toolCallsJsonIdx).trim();
        return { content, toolCalls: partialToolCalls };
      }
    }
  }

  const toolCallsMarkerIdx = text.indexOf("[tool_calls]");
  if (toolCallsMarkerIdx !== -1) {
    const content = text.substring(0, toolCallsMarkerIdx).trim();
    const toolCallsStr = text.substring(toolCallsMarkerIdx + "[tool_calls]".length).trim();
    const toolCalls = parseConsecutiveJsonObjects(toolCallsStr);

    if (toolCalls.length > 0) {
      return { content, toolCalls };
    }
  }

  const jsonToolCallsMatch = text.match(
    /```json\s*\n?\s*\{[\s\S]*?"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}?\s*\n?\s*```/,
  );
  if (jsonToolCallsMatch) {
    const jsonStr = jsonToolCallsMatch[0]
      .replace(/```json\s*\n?/, "")
      .replace(/\n?\s*```$/, "")
      .trim();
    const parsed = tryParseLooseJson<any>(jsonStr);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.tool_calls)) {
      const toolCalls: LlmToolCall[] = parsed.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name || tc.name || tc.tool,
        arguments: parseToolArgs(
          tc.function?.arguments || tc.arguments || tc.args,
        ),
      }));
      const content = text.replace(jsonToolCallsMatch[0], "").trim();
      return { content, toolCalls };
    }
  }

  const actionMatch = text.match(/Action:\s*(\w+)/);
  if (actionMatch) {
    let args: Record<string, unknown> = {};
    const argsMatch = text.match(/Arguments:\s*([\s\S]*)/);
    if (argsMatch) {
      const argsBody = argsMatch[1]!.trim();
      if (argsBody.startsWith("{")) {
        const jsonStr = extractBalancedJson(argsBody, 0);
        if (jsonStr) {
          const parsedArgs = tryParseLooseJson<Record<string, unknown>>(jsonStr);
          if (parsedArgs && typeof parsedArgs === "object") {
            args = parsedArgs;
          } else {
            args = { value: argsBody };
          }
        } else {
          args = { value: argsBody };
        }
      } else if (argsBody) {
        args = { value: argsBody };
      }
    }

    const content = text
      .replace(/Action:\s*\w+/, "")
      .replace(/Arguments:\s*[\s\S]*/, "")
      .trim();

    return {
      content,
      toolCalls: [
        {
          id: generateId(),
          name: actionMatch[1]!,
          arguments: args,
        },
      ],
    };
  }

  const xmlCodeBlockMatch = text.match(
    /```(?:xml|)\s*\n([\s\S]*?)\n\s*```/,
  );
  if (xmlCodeBlockMatch) {
    const innerXml = xmlCodeBlockMatch[1]!;
    const xmlInBlockPattern = /<(\w+)>\s*([\s\S]*?)\s*<\/\1>/g;
    const xmlInBlockResults: LlmToolCall[] = [];
    let xmlInBlockMatch: RegExpExecArray | null;

    while ((xmlInBlockMatch = xmlInBlockPattern.exec(innerXml)) !== null) {
      const tagName = xmlInBlockMatch[1]!;
      if (IGNORED_XML_TAGS.has(tagName.toLowerCase())) continue;

      const innerContent = xmlInBlockMatch[2]!.trim();
      const args = tryParseLooseJson<Record<string, unknown>>(innerContent);
      if (args && typeof args === "object") {
        xmlInBlockResults.push({
          id: generateId(),
          name: tagName,
          arguments: args,
        });
      }
    }

    if (xmlInBlockResults.length > 0) {
      const content = text.replace(xmlCodeBlockMatch[0], "").trim();
      return { content, toolCalls: xmlInBlockResults };
    }
  }

  const xmlPattern = /<(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1>/g;
  const xmlResults: LlmToolCall[] = [];
  let xmlMatch: RegExpExecArray | null;
  let cleanText = text;

  while ((xmlMatch = xmlPattern.exec(text)) !== null) {
    const tagName = xmlMatch[1]!;
    if (IGNORED_XML_TAGS.has(tagName.toLowerCase())) {
      continue;
    }

    const innerContent = xmlMatch[2]!.trim();
    const args = tryParseLooseJson<Record<string, unknown>>(innerContent);
    if (args && typeof args === "object") {
      xmlResults.push({
        id: generateId(),
        name: tagName,
        arguments: args,
      });
      cleanText = cleanText.replace(xmlMatch[0], "");
    }
  }

  if (xmlResults.length > 0) {
    return { content: cleanText.trim(), toolCalls: xmlResults };
  }

  const calledToolsIdx = text.search(/\[Called tools?:\s*/);
  if (calledToolsIdx !== -1) {
    const markerMatch = text.substring(calledToolsIdx).match(/^\[Called tools?:\s*/);
    if (markerMatch) {
      const innerStart = calledToolsIdx + markerMatch[0].length;
      const calledToolCalls = parseCalledToolsFormat(text.substring(innerStart));
      if (calledToolCalls.length > 0) {
        const content = text.substring(0, calledToolsIdx).replace(/●\s*$/, "").trim();
        return { content, toolCalls: calledToolCalls };
      }
    }
  }

  const partialToolCalls = tryExtractPartialToolCalls(trimmedText);
  if (partialToolCalls.length > 0) {
    return { content: "", toolCalls: partialToolCalls };
  }

  // Never surface raw tool-call JSON as user-visible content (including truncated streams).
  if (looksLikeToolCall(text)) {
    return { content: "", toolCalls: [] };
  }

  return { content: text, toolCalls: [] };
}

/**
 * Quick heuristic to detect if text is likely a tool call response.
 * Used to suppress intermediate streaming of raw JSON that will be parsed
 * as tool calls.
 */
export function looksLikeToolCall(text: string): boolean {
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[tool_calls]") || t.startsWith("[{")) return true;
  if (/^Action:\s*\w+/.test(t)) return true;
  if (t.includes('{"tool_calls"')) return true;
  if (/"tool_calls"\s*:\s*\[/.test(t)) return true;
  if (/"tool_name"\s*:\s*"/.test(t) && t.includes("{")) return true;
  if (t.includes('"function_call"')) return true;
  if (t.includes('"tool_use"')) return true;
  if (/\[Called tools?:/.test(t)) return true;
  if (/```(?:json)?[\s\S]*"tool_calls"/.test(t)) return true;
  return false;
}

function generateId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function tryParseJsonToolCalls(parsed: any): LlmToolCallParseResult | null {
  if (Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
    const toolCalls: LlmToolCall[] = parsed.tool_calls.map((tc: any) => ({
      id: tc.id || generateId(),
      name: tc.tool_name || tc.tool || tc.name || tc.function?.name,
      arguments: parseToolArgs(tc.arguments || tc.args || tc.input || tc.function?.arguments),
    }));
    return { content: "", toolCalls };
  }

  if (parsed.function_call?.name) {
    return {
      content: "",
      toolCalls: [{
        id: generateId(),
        name: parsed.function_call.name,
        arguments: parseToolArgs(parsed.function_call.arguments),
      }],
    };
  }

  if (Array.isArray(parsed.content)) {
    const toolUseBlocks = parsed.content.filter((b: any) => b.type === "tool_use" && b.name);
    if (toolUseBlocks.length > 0) {
      const toolCalls: LlmToolCall[] = toolUseBlocks.map((b: any) => ({
        id: b.id || generateId(),
        name: b.name,
        arguments: parseToolArgs(b.input || b.arguments || b.args),
      }));
      return { content: "", toolCalls };
    }
  }

  if (parsed.type === "tool_use" && parsed.name) {
    return {
      content: "",
      toolCalls: [{
        id: parsed.id || generateId(),
        name: parsed.name,
        arguments: parseToolArgs(parsed.input || parsed.arguments || parsed.args),
      }],
    };
  }

  if (parsed.type === "function_call" && parsed.name) {
    return {
      content: "",
      toolCalls: [{
        id: parsed.call_id || generateId(),
        name: parsed.name,
        arguments: parseToolArgs(parsed.arguments || parsed.args),
      }],
    };
  }

  const name = parsed.tool_name || parsed.tool || parsed.function?.name || parsed.name;
  if (name && typeof name === "string") {
    const args = parseToolArgs(
      parsed.arguments || parsed.args || parsed.input || parsed.function?.arguments,
    );
    return {
      content: "",
      toolCalls: [{ id: generateId(), name, arguments: args }],
    };
  }

  return null;
}

function extractToolCallsFromArray(arr: any[]): LlmToolCall[] {
  const results: LlmToolCall[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;

    const name = item.tool_name || item.tool || item.name || item.function?.name;
    if (!name || typeof name !== "string") continue;

    results.push({
      id: item.id || item.call_id || generateId(),
      name,
      arguments: parseToolArgs(
        item.arguments || item.args || item.input || item.function?.arguments,
      ),
    });
  }
  return results;
}

function parseConsecutiveJsonObjects(text: string): LlmToolCall[] {
  const results: LlmToolCall[] = [];
  let pos = 0;

  while (pos < text.length) {
    while (pos < text.length && /\s/.test(text[pos]!)) pos++;
    if (pos >= text.length) break;

    if (text[pos] !== "{") break;

    const jsonStr = extractBalancedJson(text, pos);
    if (!jsonStr) break;

    const obj = tryParseLooseJson<any>(jsonStr);
    if (!obj || typeof obj !== "object") {
      break;
    }

    const toolName = obj.tool || obj.name || obj.function?.name;
    const toolArgs = obj.args || obj.arguments || obj.function?.arguments || {};

    if (toolName) {
      results.push({
        id: generateId(),
        name: toolName,
        arguments: parseToolArgs(toolArgs),
      });
    }

    pos += jsonStr.length;
  }

  return results;
}

function parseCalledToolsFormat(inner: string): LlmToolCall[] {
  const results: LlmToolCall[] = [];
  let pos = 0;

  while (pos < inner.length) {
    while (pos < inner.length && /[\s,\]]/.test(inner[pos]!)) pos++;
    if (pos >= inner.length) break;

    if (!/[a-zA-Z_]/.test(inner[pos]!)) break;

    const nameStart = pos;
    while (pos < inner.length && /\w/.test(inner[pos]!)) pos++;
    const toolName = inner.substring(nameStart, pos);

    while (pos < inner.length && inner[pos] === " ") pos++;

    if (pos >= inner.length || inner[pos] !== "(") break;
    pos++;

    const argsStart = pos;
    let args: Record<string, unknown> = {};
    let parsed = false;

    if (pos < inner.length && inner[pos] === "{") {
      const jsonStr = extractBalancedJson(inner, pos);
      if (jsonStr) {
        pos += jsonStr.length;
        const parsedArgs = tryParseLooseJson<Record<string, unknown>>(jsonStr);
        if (parsedArgs && typeof parsedArgs === "object") {
          args = parsedArgs;
          parsed = true;
        }
      }
    }

    if (!parsed) {
      while (pos < inner.length && inner[pos] !== ")") pos++;
      const rawArgs = inner.substring(argsStart, pos).trim();
      if (rawArgs) {
        const parsedArgs = tryParseLooseJson<Record<string, unknown>>(rawArgs);
        if (parsedArgs && typeof parsedArgs === "object") {
          args = parsedArgs;
        } else {
          args = {};
        }
      }
    }

    while (pos < inner.length && inner[pos] !== ")") pos++;
    if (pos < inner.length) pos++;

    results.push({
      id: generateId(),
      name: toolName,
      arguments: args,
    });
  }

  return results;
}

function parseToolArgs(args: unknown): Record<string, unknown> {
  if (!args) return {};
  if (typeof args === "string") {
    return tryParseLooseJson<Record<string, unknown>>(args) ?? {};
  }
  if (typeof args === "object") return args as Record<string, unknown>;
  return {};
}

function tryExtractToolCallsFromToolCallsArrayText(text: string): {
  toolCalls: LlmToolCall[];
  remainder: string;
} | null {
  const markerMatch = /"tool_calls"\s*:\s*\[/.exec(text);
  if (!markerMatch) return null;

  const toolCalls: LlmToolCall[] = [];
  let pos = markerMatch.index + markerMatch[0].length;

  while (pos < text.length) {
    while (pos < text.length && /\s/.test(text[pos]!)) pos++;
    if (pos >= text.length) break;

    const ch = text[pos]!;
    if (ch === "]") {
      pos++;
      while (pos < text.length && /[\s}]/.test(text[pos]!)) pos++;
      return {
        toolCalls,
        remainder: text.slice(pos).trim(),
      };
    }
    if (ch === "," || ch === "}") {
      pos++;
      continue;
    }
    if (ch !== "{") {
      break;
    }

    const jsonStr = extractBalancedJson(text, pos);
    if (!jsonStr) return null;

    const parsed = tryParseLooseJson<any>(jsonStr);
    if (!parsed || typeof parsed !== "object") return null;

    const result = tryParseJsonToolCalls(parsed);
    if (!result || result.toolCalls.length === 0) return null;

    toolCalls.push(...result.toolCalls);
    pos += jsonStr.length;
  }

  return null;
}

function tryParseLooseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const sanitized = escapeLiteralControlCharsInJsonStrings(text);
    if (sanitized === text) {
      return null;
    }

    try {
      return JSON.parse(sanitized) as T;
    } catch {
      return null;
    }
  }
}

function escapeLiteralControlCharsInJsonStrings(text: string): string {
  let result = "";
  let inString = false;
  let escape = false;

  for (const ch of text) {
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      result += ch;
      escape = true;
      continue;
    }

    if (ch === "\"") {
      result += ch;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += ch;
  }

  return result;
}

/**
 * Best-effort extraction from incomplete/truncated tool_calls JSON.
 * Used when streaming ends before the model finishes the response.
 */
function tryExtractPartialToolCalls(text: string): LlmToolCall[] {
  const toolCalls: LlmToolCall[] = [];
  const arrayMarker = /"tool_calls"\s*:\s*\[/.exec(text);

  if (arrayMarker) {
    let pos = arrayMarker.index + arrayMarker[0].length;

    while (pos < text.length) {
      while (pos < text.length && /[\s,]/.test(text[pos]!)) pos++;
      if (pos >= text.length || text[pos] === "]") break;
      if (text[pos] !== "{") break;

      const entry = tryParsePartialToolEntry(text, pos);
      if (!entry) break;

      toolCalls.push(entry);

      const jsonStr = extractBalancedJson(text, pos);
      if (jsonStr) {
        pos += jsonStr.length;
        continue;
      }

      break;
    }
  }

  if (toolCalls.length > 0) {
    return toolCalls;
  }

  const singleNameMatch = /"tool_name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(text);
  if (singleNameMatch) {
    toolCalls.push({
      id: generateId(),
      name: singleNameMatch[1]!,
      arguments: tryParsePartialArguments(text),
    });
  }

  return toolCalls;
}

function tryParsePartialToolEntry(text: string, start: number): LlmToolCall | null {
  const slice = text.substring(start);
  const nameMatch = /^\{\s*"tool_name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(slice);
  if (!nameMatch) return null;

  return {
    id: generateId(),
    name: nameMatch[1]!,
    arguments: tryParsePartialArguments(slice),
  };
}

function tryParsePartialArguments(text: string): Record<string, unknown> {
  const argsMatch = /"arguments"\s*:\s*(\{[\s\S]*)/.exec(text);
  if (!argsMatch) return {};

  const argsBody = argsMatch[1]!.trim();
  const balanced = extractBalancedJson(argsBody, 0);
  if (balanced) {
    return tryParseLooseJson<Record<string, unknown>>(balanced) ?? {};
  }

  return tryRepairIncompleteJsonObject(argsBody) ?? {};
}

function tryRepairIncompleteJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;

  const balanced = extractBalancedJson(trimmed, 0);
  if (balanced) {
    return tryParseLooseJson<Record<string, unknown>>(balanced);
  }

  let repaired = trimmed;
  let inString = false;
  let escape = false;
  let depth = 0;

  for (const ch of repaired) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }

  if (inString) {
    repaired += "\"";
  }
  while (depth > 0) {
    repaired += "}";
    depth--;
  }

  return tryParseLooseJson<Record<string, unknown>>(repaired);
}

function extractBalancedJson(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }

  return null;
}
