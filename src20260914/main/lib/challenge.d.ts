export declare class DeepSeekHash {
    private wasmInstance;
    private offset;
    private cachedUint8Memory;
    private cachedTextEncoder;
    private encodeString;
    private getCachedUint8Memory;
    calculateHash(algorithm: string, challenge: string, salt: string, difficulty: number, expireAt: number): number | undefined;
    init(wasmPath: string): Promise<any>;
}
export declare function getDeepSeekHash(): Promise<DeepSeekHash>;
export default DeepSeekHash;
