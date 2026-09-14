/**
 * Proxy Service Module - Load Balancer
 * Implements Round Robin and Fill First strategies
 */
import { LoadBalanceStrategy } from '../store/types';
import { AccountSelection } from './types';
/**
 * Load Balancer
 */
export declare class LoadBalancer {
    private roundRobinIndex;
    private failedAccounts;
    private static readonly FAIL_THRESHOLD;
    private static readonly RECOVERY_TIME;
    /**
     * Mark account as failed
     */
    markAccountFailed(accountId: string): void;
    /**
     * Clear account failure status
     */
    clearAccountFailure(accountId: string): void;
    /**
     * Check if account is in failure state
     */
    private isAccountInFailure;
    /**
     * Select account
     * @param model Requested model
     * @param strategy Load balance strategy
     * @param preferredProviderId Preferred provider ID
     * @param preferredAccountId Preferred account ID
     */
    selectAccount(model: string, strategy?: LoadBalanceStrategy, preferredProviderId?: string, preferredAccountId?: string): AccountSelection | null;
    /**
     * Get available accounts list
     */
    private getAvailableAccounts;
    /**
     * Check if provider supports model
     */
    private providerSupportsModel;
    /**
     * Check if account is available
     */
    private isAccountAvailable;
    /**
     * Map model name
     */
    private mapModel;
    /**
     * Round Robin strategy
     */
    private selectRoundRobin;
    /**
     * Fill First strategy
     * Use current account preferentially until limit is reached
     */
    private selectFillFirst;
    /**
     * Failover strategy
     * Select account with least failures, preferring healthy accounts
     */
    private selectFailover;
    /**
     * Reset Round Robin index
     */
    resetRoundRobinIndex(): void;
    /**
     * Get available account count
     */
    getAvailableAccountCount(model: string, providerId?: string): number;
    /**
     * Get all available models
     */
    getAvailableModels(): string[];
}
export declare const loadBalancer: LoadBalancer;
export default loadBalancer;
