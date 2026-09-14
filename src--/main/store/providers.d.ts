/**
 * Credential Storage Module - Provider Management API
 * Provides CRUD operations for providers
 */
import { Provider, ProviderType, AuthType } from './types';
/**
 * Provider Manager Class
 * Provides all provider-related operations
 */
export declare class ProviderManager {
    /**
     * Get All Providers
     */
    static getAll(): Provider[];
    /**
     * Get Provider By ID
     * @param id Provider ID
     */
    static getById(id: string): Provider | undefined;
    /**
     * Get All Enabled Providers
     */
    static getEnabled(): Provider[];
    /**
     * Get Providers By Type
     * @param type Provider type
     */
    static getByType(type: ProviderType): Provider[];
    /**
     * Get Providers By Auth Type
     * @param authType Authentication type
     */
    static getByAuthType(authType: AuthType): Provider[];
    /**
     * Create Provider
     * @param data Provider data
     * @returns Created provider
     */
    static create(data: {
        name: string;
        authType: AuthType;
        apiEndpoint: string;
        headers?: Record<string, string>;
        description?: string;
        icon?: string;
        supportedModels?: string[];
        credentialFields?: Array<{
            name: string;
            label: string;
            type: 'text' | 'password' | 'textarea';
            required: boolean;
            placeholder?: string;
            helpText?: string;
        }>;
        type?: ProviderType;
        id?: string;
    }): Provider;
    /**
     * Update Provider
     * @param id Provider ID
     * @param updates Update data
     * @returns Updated provider
     */
    static update(id: string, updates: Partial<Omit<Provider, 'id' | 'type' | 'createdAt'>>): Provider | null;
    /**
     * Delete Provider
     * @param id Provider ID
     * @returns Whether deletion was successful
     */
    static delete(id: string): boolean;
    /**
     * Enable Provider
     * @param id Provider ID
     */
    static enable(id: string): Provider | null;
    /**
     * Disable Provider
     * @param id Provider ID
     */
    static disable(id: string): Provider | null;
    /**
     * Check if Provider Exists
     * @param id Provider ID
     */
    static exists(id: string): boolean;
    /**
     * Get Provider's Account Count
     * @param id Provider ID
     */
    static getAccountCount(id: string): number;
    /**
     * Get Provider's Active Account Count
     * @param id Provider ID
     */
    static getActiveAccountCount(id: string): number;
    /**
     * Reset Built-in Providers
     * Restore built-in providers to default configuration
     */
    static resetBuiltinProviders(): void;
    /**
     * Get Provider's Supported Models List
     * @param id Provider ID
     */
    static getSupportedModels(id: string): string[];
    /**
     * Add Supported Model
     * @param id Provider ID
     * @param model Model name
     */
    static addSupportedModel(id: string, model: string): Provider | null;
    /**
     * Remove Supported Model
     * @param id Provider ID
     * @param model Model name
     */
    static removeSupportedModel(id: string, model: string): Provider | null;
    /**
     * Get Provider Statistics
     */
    static getStatistics(): {
        total: number;
        builtin: number;
        custom: number;
        enabled: number;
        disabled: number;
    };
    /**
     * Batch Update Provider Status
     * @param ids Provider ID list
     * @param enabled Whether to enable
     */
    static batchUpdateStatus(ids: string[], enabled: boolean): void;
}
export default ProviderManager;
