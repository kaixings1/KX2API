/**
 * main/engine-bridge.ts — 桥接引擎和主进程
 *
 * 职责：
 * - 初始化 KX2Code 引擎
 * - 加载命令注册表
 * - 通过 IPC handlers.ts 暴露功能给渲染层
 */
import { BrowserWindow } from 'electron';
export declare function initEngineBridge(_mainWindow: BrowserWindow | null): Promise<void>;
export declare function isEngineReady(): boolean;
