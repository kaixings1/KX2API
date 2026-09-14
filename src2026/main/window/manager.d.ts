import { BrowserWindow } from 'electron';
export interface WindowOptions {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    title?: string;
    show?: boolean;
}
export declare function createWindow(options?: WindowOptions): BrowserWindow;
export declare function getMainWindow(): BrowserWindow | null;
export declare function showWindow(): void;
export declare function hideWindow(): void;
export declare function minimizeWindow(): void;
export declare function maximizeWindow(): void;
export declare function closeWindow(): void;
export declare function isWindowVisible(): boolean;
export declare function isWindowMaximized(): boolean;
export declare function isWindowMinimized(): boolean;
export declare function loadUrl(url: string): Promise<void>;
export declare function loadFile(filePath: string): Promise<void>;
export declare function reloadWindow(): void;
export declare function openDevTools(): void;
export declare function closeDevTools(): void;
export declare function toggleDevTools(): void;
