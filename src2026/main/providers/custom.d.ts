import type { Provider, AuthType } from '../../shared/types';
import type { CredentialField } from '../store/types';
export interface CustomProviderData {
    id?: string;
    name: string;
    type?: 'builtin' | 'custom';
    authType: AuthType;
    apiEndpoint: string;
    headers?: Record<string, string>;
    description?: string;
    icon?: string;
    supportedModels?: string[];
    credentialFields?: CredentialField[];
}
export interface CustomProviderValidation {
    valid: boolean;
    errors: string[];
}
export declare class CustomProviderManager {
    private static validateName;
    private static validateApiEndpoint;
    private static validateAuthType;
    private static validateHeaders;
    private static validateCredentialFields;
    static validate(data: CustomProviderData): CustomProviderValidation;
    static create(data: CustomProviderData): Provider;
    static update(id: string, updates: Partial<CustomProviderData>): Provider;
    static delete(id: string): boolean;
    static duplicate(id: string, newName?: string): Provider;
    static exportProvider(id: string): string;
    static importProvider(jsonData: string): Provider;
    static getTemplate(authType: AuthType): CustomProviderData;
}
export default CustomProviderManager;
