/**
 * main/profiles/manager.ts — 配置组管理
 *
 * 直接读写 doge-code 的配置文件，不做数据复制：
 * - 项目级: .doge/api.json（或 DOGE_API_JSON 环境变量指向的文件）
 * - 全局级: ~/.doge/providers.json
 *
 * UI 状态（activePreset）单独存储在 .doge/state.json，避免污染 DOGE_API_JSON 指向的文件。
 */
export interface Profile {
    name: string;
    provider: 'openai' | 'anthropic' | 'custom';
    baseUrl: string;
    apiKey: string;
    model: string;
    savedModels?: string[];
    savedApiKeys?: string[];
    /** 来源标记 */
    _source?: 'project' | 'global';
    /** 是否项目激活预设 */
    _active?: boolean;
    /** 最大工具调用轮次 */
    maxToolRounds?: number;
    /** 重复循环检测阈值 */
    maxRepeat?: number;
}
export declare class ProfileManager {
    private projectPath;
    private globalPath;
    private statePath;
    constructor();
    getProjectPath(): string;
    getGlobalPath(): string;
    private readProject;
    private readGlobal;
    private writeProject;
    private readState;
    private writeState;
    list(): Profile[];
    getActive(): Profile | null;
    get(name: string): Profile | undefined;
    upsert(profile: Profile): void;
    setActive(name: string): Profile | null;
    remove(name: string): boolean;
    toEngineConfig(profile: Profile): {
        provider: 'openai' | 'anthropic' | 'custom';
        baseUrl: string;
        apiKey: string;
        model: string;
        maxTokens: number;
        maxToolRounds: number;
        maxRepeat: number;
    };
}
