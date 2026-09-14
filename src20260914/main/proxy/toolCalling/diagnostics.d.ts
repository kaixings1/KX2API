import type { ToolClientAdapterId, ToolSmokeCategory } from '../../../shared/toolCalling.ts';
export interface ToolCallingSmokeResult {
    success: boolean;
    category: ToolSmokeCategory;
    message: string;
    clientAdapterId: ToolClientAdapterId;
    providerId?: string;
    requestId?: string;
    timestamp: number;
}
export declare function getLatestToolCallingSmokeResult(): ToolCallingSmokeResult;
export declare function setLatestToolCallingSmokeResult(result: ToolCallingSmokeResult): ToolCallingSmokeResult;
export declare function buildSmokeFixture(clientAdapterId: ToolClientAdapterId): {
    model: string;
    stream: boolean;
    messages: {
        role: string;
        content: string;
    }[];
    tools: {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    city: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
    }[];
    tool_choice: string | {
        type: string;
        function: {
            name: string;
        };
    };
};
