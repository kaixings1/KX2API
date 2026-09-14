import { Rectangle } from 'electron';
export declare class TrayWindow {
    private window;
    private isShowing;
    constructor();
    private createWindow;
    show(trayBounds: Rectangle): void;
    hide(): void;
    toggle(trayBounds: Rectangle): void;
    isVisible(): boolean;
    setHeight(height: number): void;
    destroy(): void;
}
