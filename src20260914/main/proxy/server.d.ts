/**
 * Proxy Service Module - Proxy Server Core
 * Implements proxy server based on Koa
 */
/**
 * Proxy Server Class
 */
export declare class ProxyServer {
    private app;
    private router;
    private server;
    private port;
    private host;
    constructor();
    /**
     * Setup middleware
     */
    private setupMiddleware;
    /**
     * Setup routes
     */
    private setupRoutes;
    /**
     * Setup error handler
     */
    private setupErrorHandler;
    /**
     * Start server
     */
    start(port?: number, host?: string): Promise<boolean>;
    /**
     * Stop server
     */
    stop(): Promise<boolean>;
    /**
     * Restart server
     */
    restart(port?: number, host?: string): Promise<boolean>;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * Get server port
     */
    getPort(): number;
    /**
     * Get statistics
     */
    getStatistics(): import("./types").ProxyStatistics;
    /**
     * Get running status
     */
    getStatus(): {
        isRunning: boolean;
        startTime: number | null;
        uptime: number;
    };
    /**
     * Reset statistics
     */
    resetStatistics(): void;
}
export declare const proxyServer: ProxyServer;
export default proxyServer;
