/**
 * src/engine/__tests__/client.test.ts — API client URL 构建测试
 */
declare let passed: number;
declare let failed: number;
declare function assert(condition: boolean, msg: string): void;
declare function buildOpenAIEndpoint(baseUrl: string): string;
declare function buildAnthropicEndpoint(baseUrl: string): string;
