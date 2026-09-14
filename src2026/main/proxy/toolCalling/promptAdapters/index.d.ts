/**
 * Prompt Adapters - Client-specific prompt adaptation system
 *
 * Ported from fork project: detects client-injected tool prompts and
 * replaces them with our standard format that models understand better.
 *
 * Integrates with the existing ToolCallingEngine as a pre-processing layer.
 */
export { PromptAdapterRegistry, promptAdapterRegistry } from './PromptAdapterRegistry';
export { BasePromptAdapter } from './BasePromptAdapter';
export { DefaultPromptAdapter, defaultPromptAdapter } from './DefaultPromptAdapter';
export { CherryStudioPromptAdapter, cherryStudioPromptAdapter } from './CherryStudioPromptAdapter';
export { KiloCodePromptAdapter, kiloCodePromptAdapter } from './KiloCodePromptAdapter';
export type { PromptVariant, TransformResult, ParseResult, ToolCallFormat, } from './BasePromptAdapter';
