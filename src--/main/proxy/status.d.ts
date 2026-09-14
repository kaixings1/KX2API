/**
 * Proxy Service Module - Status Management
 * Records request count, success rate, response time and other statistics
 */
import { ProxyStatistics, ProxyConfig } from './types';
/**
 * Proxy status manager
 */
export declare class ProxyStatusManager {
    private statistics;
    private config;
    private startTime;
    private isRunning;
    private requestTimestamps;
    private latencySum;
    /**
     * Get statistics
     */
    getStatistics(): ProxyStatistics;
    /**
     * Get configuration
     */
    getConfig(): ProxyConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ProxyConfig>): void;
    /**
     * Get running status
     */
    getRunningStatus(): {
        isRunning: boolean;
        startTime: number | null;
        uptime: number;
    };
    /**
     * Start proxy
     */
    start(): void;
    /**
     * Stop proxy
     */
    stop(): void;
    /**
     * Record request start
     */
    recordRequestStart(model: string, providerId?: string, accountId?: string): void;
    /**
     * Record request success
     */
    recordRequestSuccess(latency: number): void;
    /**
     * Record request failure
     */
    recordRequestFailure(latency: number): void;
    /**
     * Clean up expired timestamps (older than 1 minute)
     */
    private cleanupOldTimestamps;
    /**
     * Reset statistics
     */
    resetStatistics(): void;
    /**
     * Get port
     */
    getPort(): number;
    /**
     * Set port
     */
    setPort(port: number): void;
    /**
     * Get host
     */
    getHost(): string;
    /**
     * Set host
     */
    setHost(host: string): void;
}
export declare const proxyStatusManager: ProxyStatusManager;
export default proxyStatusManager;
