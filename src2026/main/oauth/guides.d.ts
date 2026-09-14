export interface TokenExtractionGuide {
    loginUrl: string;
    steps: string[];
    tokenKey: string;
    tokenLabel: string;
    storageType: 'localStorage' | 'cookie' | 'other';
    placeholder?: string;
    helpUrl?: string;
}
export declare const TOKEN_EXTRACTION_GUIDES: Record<string, TokenExtractionGuide>;
export declare function getGuideByProvider(providerType: string): TokenExtractionGuide | undefined;
