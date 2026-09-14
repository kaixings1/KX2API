/**
 * Browser Tool Call Extractor
 *
 * 专门用于浏览器插件 / content script / DOM 场景的工具调用提取。
 * 与纯文本提取器（toolCallExtractor.ts）互补，处理浏览器环境特有的信号：
 *
 *   - 网络层：fetch / XMLHttpRequest 拦截到的原始请求体和 SSE/NDJSON 流式响应
 *   - DOM 层：页面中 <script> 标签内的工具调用、data-tool-* 属性、全局变量快照
 *   - Content Script：注入页面的 API 调用记录
 *
 * 设计原则：
 *   1. 所有方法都是纯函数，不依赖 DOM / chrome.* API（调用方负责注入环境）
 *   2. 与现有的 ToolCallExtractor 复用相同的类型和工具函数
 *   3. 无法解析时返回空结果，不抛异常
 */
import type { ExtractedToolCall, ExtractionResult } from './toolCallExtractor.ts';
/**
 * 原始 HTTP 请求的元信息，用于从请求体中推断工具调用
 */
export interface RawHttpRequest {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
}
/**
 * 原始 HTTP 响应的元信息
 */
export interface RawHttpResponse {
    status: number;
    headers?: Record<string, string>;
    body?: string;
    /** 如果是流式响应，提供已接收的文本块序列 */
    streamChunks?: string[];
}
/**
 * DOM 快照信息
 */
export interface DomSnapshot {
    /** 页面 <script> 标签内容 */
    scriptContents?: string[];
    /** 页面中带有 data-tool-* 属性的元素属性 */
    toolAttributes?: Array<{
        selector: string;
        attributes: Record<string, string>;
    }>;
    /** 页面全局变量快照（仅包含工具调用相关变量） */
    globalToolVars?: Record<string, unknown>;
}
/**
 * Content Script 记录的 API 调用
 */
export interface ApiCallRecord {
    url: string;
    method: string;
    requestBody?: unknown;
    responseBody?: unknown;
    timestamp?: number;
}
/**
 * 浏览器提取选项
 */
export interface BrowserExtractOptions {
    /** 从请求体中提取（默认 true） */
    extractFromRequest?: boolean;
    /** 从响应体中提取（默认 true） */
    extractFromResponse?: boolean;
    /** 从流式响应块中提取（默认 true） */
    extractFromStream?: boolean;
    /** 从 DOM 快照中提取（默认 true） */
    extractFromDom?: boolean;
    /** 从 content script API 记录中提取（默认 true） */
    extractFromApiRecords?: boolean;
    /** 是否提取工具 schema 定义（默认 false，仅提取调用） */
    extractSchemas?: boolean;
    /** 最小置信度阈值 */
    minConfidence?: 'high' | 'medium' | 'low';
    /** 每次提取的最大工具调用数 */
    maxCalls?: number;
}
/**
 * 从原始 HTTP 请求体中提取工具调用
 * 处理：
 *   - OpenAI 标准格式（含 tool_calls 字段的消息体）
 *   - 直接包含工具调用的 JSON 体
 *   - MCP JSON-RPC 调用
 */
export declare function extractFromHttpRequest(req: RawHttpRequest): ExtractedToolCall[];
/**
 * 从原始 HTTP 响应体中提取工具调用
 * 处理：
 *   - OpenAI 标准响应格式
 *   - 直接包含 tool_calls 的 JSON 响应
 *   - GLM 网页版的特殊格式
 */
export declare function extractFromHttpResponse(resp: RawHttpResponse): ExtractedToolCall[];
/**
 * 从流式响应块（NDJSON / SSE）中提取工具调用
 * 处理：data: {...}\n\n 格式的逐块解析
 */
export declare function extractFromStreamChunks(chunks: string[]): ExtractedToolCall[];
/**
 * 从 DOM 快照中提取工具调用
 * 处理：
 *   - <script> 标签内的工具调用代码
 *   - data-tool-call / data-tool-name / data-tool-args 属性
 *   - 全局变量（如 window.__TOOL_CALLS__）
 */
export declare function extractFromDom(snapshot: DomSnapshot): ExtractedToolCall[];
/**
 * 从 content script 记录的 API 调用中提取工具调用
 * 这是浏览器插件特有的场景：通过拦截 fetch/XHR 获取原始请求/响应
 */
export declare function extractFromApiRecords(records: ApiCallRecord[]): ExtractedToolCall[];
/**
 * 主入口：从浏览器插件的多种信号源中提取工具调用
 */
export declare class BrowserToolCallExtractor {
    private options;
    private seenKeys;
    constructor(options?: BrowserExtractOptions);
    reset(): void;
    /**
     * 从浏览器插件收集的所有信号中提取工具调用
     */
    extract(signals: {
        requests?: RawHttpRequest[];
        responses?: RawHttpResponse[];
        domSnapshot?: DomSnapshot;
        apiRecords?: ApiCallRecord[];
    }): ExtractionResult;
}
