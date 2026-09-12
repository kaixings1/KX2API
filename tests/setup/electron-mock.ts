/**
 * Test setup — mock Electron and Node.js built-ins that are unavailable in test environment
 */

// Mock electron module
const mockElectron = {
  app: {
    getPath: () => '/tmp',
    getVersion: () => '1.0.0',
    isPackaged: false,
    on: () => {},
    once: () => {},
    quit: () => {},
    relaunch: () => {},
    commandLine: {
      appendSwitch: () => {},
    },
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: () => true,
    on: () => {},
    addListener: () => {},
    removeListener: () => {},
  },
  BrowserWindow: class MockBrowserWindow {
    webContents = {
      on: () => {},
      loadURL: () => Promise.resolve(),
      reload: () => Promise.resolve(),
      executeJavaScript: () => Promise.resolve(''),
    }
    isDestroyed() { return false }
    loadURL() { return Promise.resolve() }
    close() {}
    show() {}
    hide() {}
    focus() {}
    minimize() {}
    restore() {}
    setSize() {}
    setPosition() {}
    on() {}
    once() {}
    removeListener() {}
    webContents = {
      on: () => {},
      once: () => {},
      send: () => {},
      executeJavaScript: () => Promise.resolve(null),
    }
    destroy() {}
  },
  session: {
    fromPartition: () => ({
      cookies: {
        get: () => Promise.resolve([]),
        on: () => {},
      },
    }),
    defaultSession: {
      cookies: {
        get: () => Promise.resolve([]),
        on: () => {},
      },
    },
  },
  ipcMain: {
    handle: () => {},
    on: () => {},
    removeHandler: () => {},
  },
  ipcRenderer: {
    invoke: () => Promise.resolve(null),
    on: () => {},
    removeListener: () => {},
    send: () => {},
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
  dialog: {
    showMessageBox: () => Promise.resolve({ response: 0 }),
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
  },
  shell: {
    openExternal: () => {},
  },
  clipboard: {
    writeText: () => {},
    readText: () => '',
  },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }),
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: () => {},
  },
  Tray: class MockTray {},
  Menu: {
    buildFromTemplate: () => ({}),
    setApplicationMenu: () => {},
  },
  Notification: class MockNotification {
    constructor() {}
    show() {}
  },
  globalShortcut: {
    register: () => true,
    unregister: () => {},
    unregisterAll: () => {},
  },
  powerMonitor: {
    on: () => {},
  },
  net: {
    fetch: () => Promise.resolve({}),
  },
}

export default mockElectron

export const app = mockElectron.app
export const BrowserWindow = mockElectron.BrowserWindow as unknown as typeof mockElectron.BrowserWindow
export const session = mockElectron.session
export const safeStorage = mockElectron.safeStorage
export const dialog = mockElectron.dialog
export const shell = mockElectron.shell
export const clipboard = mockElectron.clipboard
export const screen = mockElectron.screen
export const nativeTheme = mockElectron.nativeTheme
export const Tray = mockElectron.Tray as unknown as typeof mockElectron.Tray
export const Menu = mockElectron.Menu
export const Notification = mockElectron.Notification as unknown as typeof mockElectron.Notification
export const globalShortcut = mockElectron.globalShortcut
export const powerMonitor = mockElectron.powerMonitor
export const net = mockElectron.net
export const ipcMain = mockElectron.ipcMain
export const ipcRenderer = mockElectron.ipcRenderer

// Mock Node.js built-ins that may be missing
import { EventEmitter } from 'node:events'
export { EventEmitter }
