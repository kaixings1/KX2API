import type { NormalizedToolResult, ToolProtocolId } from './types.ts';
export interface ProviderToolProfile {
    providerId: 'deepseek' | 'kimi' | 'glm' | 'qwen' | string;
    managedSupport: boolean;
    supportsNativeTools: boolean;
    preferredManagedProtocol: ToolProtocolId;
    formatAssistantToolCalls(calls: Array<{
        id: string;
        name: string;
        arguments: string;
    }>): string;
    formatToolResult(result: NormalizedToolResult): string;
}
export declare function getProviderToolProfile(providerId: string): ProviderToolProfile;
