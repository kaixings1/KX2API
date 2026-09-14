/**
 * Credential Storage Module - App Config Management API
 * Provides read/write operations for app configuration
 */
import { AppConfig, LoadBalanceStrategy, Theme, ModelMapping } from './types';
/**
 * Config Manager class
 * Provides all operations related to app configuration
 */
export declare class ConfigManager {
    /**
     * Get complete configuration
     */
    static get(): AppConfig;
    /**
     * Update configuration
     * @param updates Configuration items to update
     * @returns Updated complete configuration
     */
    static update(updates: Partial<AppConfig>): AppConfig;
    /**
     * Reset configuration to default values
     * @returns Default configuration
     */
    static reset(): AppConfig;
    /**
     * Get proxy port
     */
    static getProxyPort(): number;
    /**
     * Set proxy port
     * @param port Port number
     */
    static setProxyPort(port: number): void;
    /**
     * Get load balance strategy
     */
    static getLoadBalanceStrategy(): LoadBalanceStrategy;
    /**
     * Set load balance strategy
     * @param strategy Strategy type
     */
    static setLoadBalanceStrategy(strategy: LoadBalanceStrategy): void;
    /**
     * Get all model mappings
     */
    static getModelMappings(): Record<string, ModelMapping>;
    /**
     * Get mapping config for specified model
     * @param model Model name
     */
    static getModelMapping(model: string): ModelMapping | undefined;
    /**
     * Add or update model mapping
     * @param mapping Mapping config
     */
    static setModelMapping(mapping: ModelMapping): void;
    /**
     * Delete model mapping
     * @param model Model name
     */
    static removeModelMapping(model: string): boolean;
    /**
     * Batch set model mappings
     * @param mappings Mapping config list
     */
    static setModelMappings(mappings: ModelMapping[]): void;
    /**
     * Resolve actual model to use
     * @param requestedModel Requested model name
     * @returns Actual model name to use
     */
    static resolveActualModel(requestedModel: string): string;
    /**
     * Get theme setting
     */
    static getTheme(): Theme;
    /**
     * Set theme
     * @param theme Theme type
     */
    static setTheme(theme: Theme): void;
    /**
     * Get auto-start on boot setting
     */
    static getAutoStart(): boolean;
    /**
     * Set auto-start on boot
     * @param autoStart Whether to auto-start on boot
     */
    static setAutoStart(autoStart: boolean): void;
    /**
     * Get minimize to tray setting
     */
    static getMinimizeToTray(): boolean;
    /**
     * Set minimize to tray
     * @param minimizeToTray Whether to minimize to tray
     */
    static setMinimizeToTray(minimizeToTray: boolean): void;
    /**
     * Get log level
     */
    static getLogLevel(): 'debug' | 'info' | 'warn' | 'error';
    /**
     * Set log level
     * @param level Log level
     */
    static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
    /**
     * Get log retention days
     */
    static getLogRetentionDays(): number;
    /**
     * Set log retention days
     * @param days Number of days
     */
    static setLogRetentionDays(days: number): void;
    /**
     * Get request timeout
     */
    static getRequestTimeout(): number;
    /**
     * Set request timeout
     * @param timeout Timeout in milliseconds
     */
    static setRequestTimeout(timeout: number): void;
    /**
     * Get retry count
     */
    static getRetryCount(): number;
    /**
     * Set retry count
     * @param count Retry count
     */
    static setRetryCount(count: number): void;
    /**
     * Validate if configuration is valid
     * @param config Configuration to validate
     * @returns Validation result
     */
    static validate(config: Partial<AppConfig>): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Get configuration diff
     * @param newConfig New configuration
     * @returns Diff from default configuration
     */
    static getDiff(newConfig: Partial<AppConfig>): Partial<AppConfig>;
    /**
     * Export configuration (for backup)
     */
    static export(): AppConfig;
    /**
     * Import configuration (for restore)
     * @param config Configuration data
     */
    static import(config: Partial<AppConfig>): {
        success: boolean;
        errors: string[];
    };
}
export default ConfigManager;
