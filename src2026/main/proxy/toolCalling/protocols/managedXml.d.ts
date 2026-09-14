import type { ToolProtocolAdapter } from './base.ts';
declare const PROTOCOL_PREFIX = "KX2API";
export { PROTOCOL_PREFIX };
/**
 * Default allowed tool-name set.
 *
 * When the client does NOT send an explicit OpenAI `tools` array (e.g. a plain
 * natural-language instruction such as "列出 src/"), `context.tools` is empty,
 * so `toolNames(context.tools)` yields an EMPTY set. The original parser then
 * treated every tool name as invalid (`!allowedNames.has(name)` → skip), which
 * is exactly why no tool could ever be extracted from the website's response.
 *
 * This fallback set lets the parser accept the platform's well-known native
 * tool names even when the request carried no tool declaration. Extend it as
 * new provider-native tools are discovered — do NOT remove existing entries.
 */
export declare const DEFAULT_ALLOWED_NAMES: Set<string>;
export declare const managedXmlProtocol: ToolProtocolAdapter;
