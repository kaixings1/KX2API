/**
 * Credential Storage Module - Account Management API
 * Provides CRUD operations for accounts
 */
import { Account, AccountStatus, ValidationResult } from './types';
/**
 * Account Manager class
 * Provides all operations related to accounts
 */
export declare class AccountManager {
    /**
     * Get all accounts
     * @param includeCredentials Whether to include credentials (sensitive data)
     */
    static getAll(includeCredentials?: boolean): Account[];
    /**
     * Get account by ID
     * @param id Account ID
     * @param includeCredentials Whether to include credentials
     */
    static getById(id: string, includeCredentials?: boolean): Account | undefined;
    /**
     * Get account list by provider ID
     * @param providerId Provider ID
     * @param includeCredentials Whether to include credentials
     */
    static getByProviderId(providerId: string, includeCredentials?: boolean): Account[];
    /**
     * Get all active accounts
     * @param includeCredentials Whether to include credentials
     */
    static getActive(includeCredentials?: boolean): Account[];
    /**
     * Create new account
     * @param data Account data
     * @returns Created account
     */
    static create(data: {
        providerId: string;
        name: string;
        email?: string;
        credentials: Record<string, string>;
        dailyLimit?: number;
    }): Account;
    /**
     * Update account
     * @param id Account ID
     * @param updates Update data
     * @returns Updated account
     */
    static update(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Account | null;
    /**
     * Delete account
     * @param id Account ID
     * @returns Whether deletion was successful
     */
    static delete(id: string): boolean;
    /**
     * Update account status
     * @param id Account ID
     * @param status New status
     * @param errorMessage Error message (optional)
     */
    static updateStatus(id: string, status: AccountStatus, errorMessage?: string): Account | null;
    /**
     * Update last used time
     * @param id Account ID
     */
    static touchLastUsed(id: string): void;
    /**
     * Increment request count
     * @param id Account ID
     */
    static incrementRequestCount(id: string): void;
    /**
     * Reset daily usage count
     * Should be called at midnight
     */
    static resetDailyUsage(): void;
    /**
     * Validate account credentials
     * @param id Account ID
     * @returns Validation result
     */
    static validate(id: string): Promise<ValidationResult>;
    /**
     * Batch validate all accounts
     * @returns Validation result mapping
     */
    static validateAll(): Promise<Map<string, ValidationResult>>;
    /**
     * Check if account is available
     * @param id Account ID
     * @returns Whether account is available
     */
    static isAvailable(id: string): boolean;
    /**
     * Get available account list
     * @param providerId Optional, filter by provider
     * @returns Available account list
     */
    static getAvailable(providerId?: string): Account[];
    /**
     * Select next available account (load balancing)
     * @param providerId Provider ID
     * @param strategy Load balance strategy
     * @returns Selected account or null
     */
    static selectNext(providerId: string, strategy?: 'round-robin' | 'fill-first'): Account | null;
    /**
     * Get account statistics
     */
    static getStatistics(): {
        total: number;
        active: number;
        inactive: number;
        expired: number;
        error: number;
    };
}
export default AccountManager;
