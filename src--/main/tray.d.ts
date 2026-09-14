import { Tray, BrowserWindow } from 'electron';
export declare function createTray(mainWindow: BrowserWindow | null): Tray;
export declare function updateTrayIcon(isRunning: boolean): void;
export declare function updateTrayMenu(mainWindow: BrowserWindow | null): void;
export declare function destroyTray(): void;
export declare function getTray(): Tray | null;
export declare function setTrayTooltip(tooltip: string): void;
export declare function showTrayBalloon(title: string, content: string): void;
