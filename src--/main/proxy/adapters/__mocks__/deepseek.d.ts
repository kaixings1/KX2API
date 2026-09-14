export declare class DeepSeekAdapter {
    static isDeepSeekProvider(provider: any): boolean;
    static clearSessionCache(accountId: string): void;
}
export declare class DeepSeekStreamHandler {
}
export declare const deepSeekAdapter: {
    DeepSeekAdapter: typeof DeepSeekAdapter;
};
