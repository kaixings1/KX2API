/**
 * Proxy Service Module - Model Mapper
 * Supports mapping request models to actual models
 */
import { ModelMapping, Provider } from '../store/types';
/**
 * Model mapper
 */
export declare class ModelMapper {
    /**
     * Map model name
     * @param requestedModel Requested model name
     * @param provider Provider (optional, for provider-specific mapping)
     */
    mapModel(requestedModel: string, provider?: Provider): string;
    /**
     * Find wildcard mapping
     */
    private findWildcardMapping;
    /**
     * Check if model name matches wildcard pattern
     */
    private matchesPattern;
    /**
     * Get actual model name for a model
     */
    getActualModel(requestedModel: string, providerId?: string): string;
    /**
     * Get preferred provider for a model
     */
    getPreferredProvider(requestedModel: string): string | undefined;
    /**
     * Get preferred account for a model
     */
    getPreferredAccount(requestedModel: string): string | undefined;
    /**
     * Add model mapping
     */
    addMapping(requestModel: string, actualModel: string, preferredProviderId?: string, preferredAccountId?: string): void;
    /**
     * Remove model mapping
     */
    removeMapping(requestModel: string): boolean;
    /**
     * Get all mappings
     */
    getAllMappings(): Record<string, ModelMapping>;
    /**
     * Get list of providers supporting specified model
     */
    getProvidersForModel(model: string): Provider[];
}
export declare const modelMapper: ModelMapper;
export default modelMapper;
