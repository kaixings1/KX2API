/**
 * Management API Authentication Middleware
 * Provides Bearer token authentication for management API endpoints
 */
import type { Context, Next } from 'koa';
/**
 * Management API Error Response Interface
 * Follows the error response format defined in spec
 */
export interface ManagementApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
/**
 * Generate a cryptographically secure management secret
 * Uses UUID v4 format for secure random key generation
 * @returns Generated secret key in format: mgmt_<uuid>
 */
export declare function generateManagementSecret(): string;
/**
 * Management API Authentication Middleware
 * Validates Bearer token from Authorization header or X-Management-Secret header
 * Compares against managementApiSecret from config
 * Returns 401 Unauthorized for invalid/missing authentication
 */
export declare function managementAuthMiddleware(ctx: Context, next: Next): Promise<void>;
export default managementAuthMiddleware;
