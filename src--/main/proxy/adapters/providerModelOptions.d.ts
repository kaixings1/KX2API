export interface DeepSeekChatOptionInput {
    model: string;
    web_search?: boolean;
    reasoning_effort?: string;
}
export interface DeepSeekChatOptions {
    modelType: 'default' | 'expert';
    searchEnabled: boolean;
    thinkingEnabled: boolean;
}
export declare function resolveDeepSeekChatOptions(request: DeepSeekChatOptionInput, _prompt?: string): DeepSeekChatOptions;
export type KimiScenario = 'SCENARIO_K2D5' | 'SCENARIO_K2D6';
export declare function resolveKimiScenario(model: string): KimiScenario;
export declare function createKimiChatPayload(options: {
    model: string;
    content: string;
    enableWebSearch: boolean;
    enableThinking: boolean;
    chatId?: string;
    parentId?: string;
}): {
    scenario: KimiScenario;
    chat_id: string;
    tools: {
        type: string;
        search: {};
    }[];
    message: {
        parent_id: string;
        role: string;
        blocks: {
            message_id: string;
            text: {
                content: string;
            };
        }[];
        scenario: KimiScenario;
    };
    options: {
        thinking: boolean;
    };
};
export declare function encodeKimiGrpcFrame(payload: unknown): Buffer;
