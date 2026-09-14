import { getMainWindow } from './window/manager';
declare module 'electron' {
    interface App {
        isQuitting?: boolean;
    }
}
export declare function restartApp(): void;
export declare function getAppVersion(): string;
export declare function isAppQuitting(): boolean;
export { getMainWindow };
