export type ToolCallingModeSetting = 'off' | 'auto' | 'force';
export type ToolClientAdapterId = 'standard-openai-tools' | 'cherry-studio-mcp' | string;
export type ToolSmokeCategory = 'pass' | 'no_tools_received' | 'model_did_not_call_tool' | 'invalid_tool_name' | 'parser_failed' | 'wrapper_leaked' | 'client_did_not_return_tool_result' | 'provider_or_account_error' | 'not_run';
export interface ToolCallingConfig {
    enabled: boolean;
    mode: ToolCallingModeSetting;
    clientAdapterId: ToolClientAdapterId;
    diagnosticsEnabled: boolean;
    advanced: {
        customPromptTemplate?: string;
        promptPreviewEnabled: boolean;
    };
}
export interface LegacyToolPromptConfig {
    mode?: 'auto' | 'always' | 'never' | string;
    defaultFormat?: 'bracket' | 'xml' | string;
    customPromptTemplate?: string;
    enableToolCallParsing?: boolean;
}
export interface ToolClientAdapterMeta {
    id: 'standard-openai-tools' | 'cherry-studio-mcp';
    label: string;
    descriptionKey: string;
    smokeTestKind: 'openai-tools' | 'cherry-mcp-weather';
}
export interface ToolProviderSupportMeta {
    providerId: 'deepseek' | 'kimi' | 'glm' | 'qwen' | 'mimo';
    label: string;
    managed: true;
    protocolId: 'managed_xml';
    status: 'supported';
}
export declare const DEFAULT_TOOL_CALLING_CONFIG: ToolCallingConfig;
export declare const P0_TOOL_CLIENT_ADAPTERS: ToolClientAdapterMeta[];
export declare const P0_TOOL_PROVIDER_SUPPORT: ToolProviderSupportMeta[];
export declare function normalizeToolCallingConfig(value: unknown): ToolCallingConfig;
