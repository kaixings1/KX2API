/**
 * Prompt Generator
 * Unified prompt generation for all protocol formats
 * Supports custom templates with variable substitution
 */
import { ChatCompletionTool } from '../types';
/**
 * Protocol format type
 */
export type ProtocolFormat = 'bracket' | 'xml';
/**
 * Prompt generation options
 */
export interface PromptGenerationOptions {
    format: ProtocolFormat;
    customTemplate?: string;
    provider?: string;
}
/**
 * Template variables that can be used in custom templates
 */
export interface TemplateVariables {
    tools: string;
    toolNames: string;
    format: string;
}
/**
 * Prompt Generator class
 * Single entry point for all prompt generation
 */
export declare class PromptGenerator {
    /**
     * Generate tool prompt based on format and options
     * Supports custom templates with variable substitution
     */
    static generate(tools: ChatCompletionTool[], options: PromptGenerationOptions): string;
    /**
     * Generate tool definitions only (without protocol instructions)
     */
    static generateToolDefinitions(tools: ChatCompletionTool[]): string;
    /**
     * Generate tool names list
     */
    static generateToolNames(tools: ChatCompletionTool[]): string;
    /**
     * Generate tool wrap hint
     */
    static generateWrapHint(): string;
    /**
     * Get format example for a given protocol format
     */
    static getFormatExample(format: ProtocolFormat): string;
}
/**
 * Convenience function for direct usage
 */
export declare function generateToolPrompt(tools: ChatCompletionTool[], format?: ProtocolFormat): string;
