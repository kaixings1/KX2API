/**
 * Proxy Service Module - Request Forwarder
 * Forwards requests to corresponding API based on provider configuration
 */
import { Account, Provider } from '../store/types';
import { ForwardResult, ChatCompletionRequest, ProxyContext } from './types';
/**
 * Request Forwarder
 */
export declare class RequestForwarder {
    private axiosInstance;
    private readonly providerForwarders;
    /**
     * Transform request for prompt-based tool calling
     * For models that don't support native function calling
     * Delegates tool normalization, prompt injection, and parser planning to ToolCallingEngine.
     */
    private transformRequestForPromptToolUse;
    private applyToolCallsToResponse;
    private extractToolsFromContent;
    private meetsConfidenceThreshold;
    private extractJsonSchemaTools;
    private extractHtmlStructuredTools;
    private extractMarkdownCodeBlockTools;
    private extractDomAttributeTools;
    /**
     * Create summary generator function for context management
     * Uses the current provider and account to generate summaries
     */
    private createSummaryGenerator;
    /**
     * Forward Chat Completions Request
     */
    forwardChatCompletion(request: ChatCompletionRequest, account: Account, provider: Provider, actualModel: string, context: ProxyContext): Promise<ForwardResult>;
    /**
     * Execute Forward
     */
    private doForward;
    /**
     * DeepSeek Dedicated Forward
     */
    private forwardDeepSeek;
    /**
     * GLM Dedicated Forward
     */
    private forwardGLM;
    private forwardKimi;
    /**
     * Qwen Dedicated Forward
     */
    private forwardQwen;
    /**
     * Qwen AI (International) Dedicated Forward
     */
    private forwardQwenAi;
    /**
     * Z.ai Dedicated Forward
     */
    private forwardZai;
    /**
     * MiniMax Dedicated Forward
     */
    private forwardMiniMax;
    /**
     * Mimo Dedicated Forward
     * Uses Mimo adapter for Xiaomi AI Studio
     */
    private forwardMimo;
    /**
     * Perplexity Dedicated Forward
     * Uses Electron's net API to bypass Cloudflare protection
     */
    private forwardPerplexity;
    /**
     * StepFun Dedicated Forward
     * Uses standard OpenAI-compatible API format
     */
    private forwardStepFun;
    /**
     * Build URL
     */
    private buildUrl;
    /**
     * Build Request Headers
     */
    private buildHeaders;
    /**
     * Build Request Body
     */
    private buildRequestBody;
    /**
     * Extract Response Headers
     */
    private extractHeaders;
    /**
     * Extract Error Message
     */
    private extractErrorMessage;
    /**
     * Delay
     */
    private delay;
    /**
     * Forward Request to Specified URL
     */
    forwardToUrl(url: string, method: string, headers: Record<string, string>, body: any, isStream?: boolean): Promise<ForwardResult>;
}
export declare const requestForwarder: RequestForwarder;
export default requestForwarder;
