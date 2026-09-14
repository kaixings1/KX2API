import { ToolCall } from '../../types';
import { ToolCallFormat } from '../../constants/signatures';
/**
 * 工具调用解析结果
 */
export interface ToolParseResult {
    content: string;
    toolCalls: ToolCall[];
    format: ToolCallFormat;
    rawMatches: string[];
}
/**
 * 流式处理状态
 */
export interface StreamState {
    contentBuffer: string;
    isBufferingToolCall: boolean;
    toolCallIndex: number;
    hasEmittedToolCall: boolean;
}
/**
 * 流式处理结果
 */
export interface StreamParseResult {
    chunks: any[];
    shouldFlush: boolean;
}
/**
 * 统一工具调用解析入口
 * 支持 bracket、xml、anthropic、json 格式
 */
export declare function parseToolCalls(content: string): ToolParseResult;
/**
 * 统一流式处理入口
 * 用于处理流式响应中的工具调用
 */
export declare function parseToolCallsStream(content: string, state: StreamState): StreamParseResult;
/**
 * 刷新流式缓冲区
 */
export declare function flushToolCallBuffer(state: StreamState): any[];
/**
 * 提取平衡的 JSON 对象字符串
 */
export declare function extractBalancedJson(str: string): string | null;
/**
 * 尝试多种策略解析 JSON
 */
export declare function tryParseJSON(str: string): any | null;
/**
 * 针对特定已知工具的正则回退
 * 这是完全损坏的 JSON 的最后手段
 */
export declare function tryRegexFallback(str: string): any | null;
/**
 * 创建流式状态
 */
export declare function createStreamState(): StreamState;
/**
 * 检查是否应该阻止正常输出
 */
export declare function shouldBlockOutput(state: StreamState): boolean;
