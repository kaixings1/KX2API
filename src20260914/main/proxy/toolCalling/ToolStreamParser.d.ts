import type { ToolCallingPlan } from './types.ts';
export declare class ToolStreamParser {
    private readonly plan;
    private buffer;
    private state;
    private nextToolCallIndex;
    private releasedLength;
    private emittedToolCall;
    constructor(plan: ToolCallingPlan);
    push(content: string, baseChunk: any, includeRole?: boolean): any[];
    private handlePassThrough;
    private handleBuffering;
    private handleEmitted;
    private tryFallbackOrRelease;
    private emitToolCalls;
    private emitFallbackToolCalls;
    private reset;
    flush(baseChunk: any): any[];
    hasEmittedToolCall(): boolean;
    isBuffering(): boolean;
}
