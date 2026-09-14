/**
 * StepFun Stream Response Handler
 * Handles SSE text format from StepFun WebSocket binary protocol adapter
 */
export declare class StepFunStreamHandler {
    private model;
    private sessionId;
    private plan;
    private toolCallState;
    private isFirstChunk;
    private created;
    private accumulatedContent;
    constructor(model: string, sessionId: any, plan: any);
    handleStream(stream: any): Promise<any>;
    private processChunk;
    private handleDone;
    handleNonStream(stream: any): Promise<any>;
}
