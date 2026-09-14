import { BrowserWindow } from 'electron';
import { UpdateInfo } from 'electron-updater';
import { EventEmitter } from 'events';
export interface DownloadProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}
export interface UpdateStatus {
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    error: string | null;
    progress: DownloadProgress | null;
    version: string | null;
    releaseDate: string | null;
    releaseNotes: string | null;
}
export interface UpdaterEvents {
    'checking-for-update': () => void;
    'update-available': (info: UpdateInfo) => void;
    'update-not-available': (info: UpdateInfo) => void;
    'download-progress': (progress: DownloadProgress) => void;
    'update-downloaded': (info: UpdateInfo) => void;
    'error': (error: Error) => void;
}
export declare class UpdaterManager extends EventEmitter {
    private static instance;
    private mainWindow;
    private status;
    private constructor();
    static getInstance(): UpdaterManager;
    initialize(mainWindow: BrowserWindow): void;
    private setupAutoUpdater;
    checkForUpdates(): Promise<void>;
    downloadUpdate(): Promise<void>;
    quitAndInstall(): void;
    getStatus(): UpdateStatus;
    isUpdateAvailable(): boolean;
    isUpdateDownloaded(): boolean;
    isDownloading(): boolean;
    isChecking(): boolean;
    private updateStatus;
    private sendToRenderer;
    private getErrorMessage;
    destroy(): void;
}
export default UpdaterManager;
