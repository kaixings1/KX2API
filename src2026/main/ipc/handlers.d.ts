import { BrowserWindow } from 'electron';
import type { ProxyStatus } from '../../shared/types';
declare let engine: {
    query: (text: string) => Promise<{
        content: string;
        toolOutput?: string;
    }>;
    getHistory: () => {
        messages: Array<{
            role: string;
            content: string;
        }>;
    };
    clearHistory: () => void;
    getConfig: () => Record<string, unknown>;
    executeCommand: (name: string, args: string[]) => Promise<{
        success: boolean;
        output?: string;
        error?: string;
    }>;
} | null;
export declare function setEngineRef(eng: typeof engine): void;
export declare function registerIpcHandlers(mainWindow: BrowserWindow | null): Promise<void>;
export declare function getProxyStatus(): ProxyStatus;
export declare function setProxyStatus(status: ProxyStatus): void;
export {};
