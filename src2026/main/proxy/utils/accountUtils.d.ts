/**
 * Shared Account Utilities
 * Unified logic for adding accounts across different components
 */
import type { Account, Provider } from '../../store/types';
export interface OAuthCredentials {
    [key: string]: string | undefined;
}
export interface CredentialField {
    name: string;
    label: string;
    type: 'text' | 'password';
    required: boolean;
    placeholder?: string;
    helpText?: string;
}
export declare function mapOAuthCredentials(credentials: OAuthCredentials, provider: Provider): Record<string, string>;
export declare function validateCredentials(credentials: OAuthCredentials, provider: Provider): {
    valid: boolean;
    errors: string[];
};
export declare function createAccount(providerId: string, credentials: Record<string, string>, accountInfo?: {
    name?: string;
    email?: string;
    userId?: string;
}): Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
export declare function getAccountDisplayName(account: Account, provider?: Provider): string;
export declare function maskCredential(value: string, visibleChars?: number): string;
export declare function getMaskedCredentials(credentials: Record<string, string>, provider: Provider): Record<string, string>;
