import type { Provider, ProviderCheckResult, Account } from '../../shared/types';
export interface TokenCheckResult {
    valid: boolean;
    error?: string;
    userInfo?: {
        name?: string;
        email?: string;
        quota?: number;
        used?: number;
    };
}
export declare class ProviderChecker {
    static checkProviderStatus(provider: Provider): Promise<ProviderCheckResult>;
    private static checkBuiltinProvider;
    private static checkCustomProvider;
    static checkAccountToken(provider: Provider, account: Account): Promise<TokenCheckResult>;
    private static checkMimoToken;
    private static checkStepFunToken;
    private static checkDeepSeekToken;
    private static checkGLMToken;
    private static generateGLMSignV2;
    private static checkKimiToken;
    private static checkMiniMaxToken;
    private static checkQwenToken;
    private static checkQwenAiToken;
    private static checkPerplexityToken;
    private static checkGenericToken;
    private static checkCustomAccountToken;
    private static generateUUID;
    private static generateGLMSign;
    static fetchProviderModels(providerId: string): Promise<{
        supportedModels: string[];
        modelMappings: Record<string, string>;
    }>;
}
export default ProviderChecker;
