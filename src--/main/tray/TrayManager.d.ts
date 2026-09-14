import { BrowserWindow } from 'electron';
export declare class TrayManager {
    private static instance;
    private tray;
    private trayWindow;
    private mainWindow;
    private isRunning;
    private constructor();
    static getInstance(): TrayManager;
    create(mainWindow: BrowserWindow): void;
    private setupEventHandlers;
    private setupIpcHandlers;
    private toggleWindow;
    private openDashboard;
    private buildMenu;
    private updateContextMenu;
    updateProxyStatus(running: boolean): void;
    destroy(): void;
}
export declare function createTrayManager(mainWindow: BrowserWindow): TrayManager;
