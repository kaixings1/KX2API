/**
 * Error Types and Error Handler
 * Unified error handling system for the application
 */
export declare enum ErrorCode {
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
    AUTH_FAILED = "AUTH_FAILED",
    RATE_LIMIT = "RATE_LIMIT",
    NETWORK_ERROR = "NETWORK_ERROR",
    INVALID_REQUEST = "INVALID_REQUEST",
    PROVIDER_ERROR = "PROVIDER_ERROR",
    TIMEOUT = "TIMEOUT",
    UNKNOWN = "UNKNOWN"
}
export declare class AppError extends Error {
    code: ErrorCode;
    details?: any | undefined;
    constructor(code: ErrorCode, message: string, details?: any | undefined);
    toJSON(): {
        name: string;
        code: ErrorCode;
        message: string;
        details: any;
    };
}
export declare class ProviderUnavailableError extends AppError {
    constructor(providerId: string, details?: any);
}
export declare class AuthFailedError extends AppError {
    constructor(providerId: string, details?: any);
}
export declare class RateLimitError extends AppError {
    constructor(providerId: string, retryAfter?: number, details?: any);
}
export declare class NetworkError extends AppError {
    constructor(message: string, details?: any);
}
export declare class InvalidRequestError extends AppError {
    constructor(message: string, details?: any);
}
export declare class ProviderError extends AppError {
    constructor(providerId: string, message: string, details?: any);
}
export declare class TimeoutError extends AppError {
    constructor(operation: string, timeout: number, details?: any);
}
export declare function isAppError(error: unknown): error is AppError;
export declare function getErrorMessage(error: unknown): string;
export declare function getErrorCode(error: unknown): ErrorCode;
export declare function createErrorFromAxiosError(error: any, providerId?: string): AppError;
