import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// Set UTF-8 encoding for stdout/stderr to fix Chinese character display on Windows
process.stdout.setDefaultEncoding?.('utf8')
process.stderr.setDefaultEncoding?.('utf8')

import { createWindow, getMainWindow, loadUrl, loadFile, openDevTools } from './window/manager'
import { createTrayManager, TrayManager } from './tray/TrayManager'
import { registerIpcHandlers } from './ipc/handlers'
import { registerChatHandlers } from './ipc/chat-handlers'
import { initEngineBridge } from './engine-bridge'
import { kimiSessionManager } from './oauth/kimiSessionManager'
import { cookieSessionManager } from './oauth/cookieSessionManager'
import { UpdaterManager } from './updater'
import type { ProviderVendor } from '../shared/types'
import { storeManager } from './store/store'
import { logManager } from './logger/manager'

// Prevent uncaught exceptions from crashing the app
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

// Bypass SSL certificate verification globally (workaround for ERR_SSL_PROTOCOL_ERROR)
app.commandLine.appendSwitch('ignore-certificate-errors')

// Workaround for V8 JIT compiler crash on macOS ARM64 (Electron 33 bug)
// Completely disable JIT compilation to prevent EXC_BAD_ACCESS crashes
// This trades some performance for stability
if (process.platform === 'darwin' && process.arch === 'arm64') {
  app.commandLine.appendSwitch('js-flags', '--jitless --no-opt')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}

// Automatically add --no-sandbox flag when running as root user
if (process.getuid && process.getuid() === 0) {
  console.log('Detected running as root user, sandbox settings have been automatically handled')
}

declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })

  initializeApp()
}

let trayManager: TrayManager | null = null

async function initializeApp(): Promise<void> {
  app.on('ready', async () => {
    await setupApp()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })

  app.on('before-quit', () => {
    app.isQuitting = true
    trayManager?.destroy()
  })

  app.on('will-quit', () => {
    cleanup()
  })
}

async function setupApp(): Promise<void> {
  const mainWindow = createWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'KX2Code',
    show: false,
  })

  await logManager.initialize()
  await registerIpcHandlers(mainWindow)
  registerChatHandlers()
  await initEngineBridge(mainWindow)

  // 初始化 Kimi 持久登录会话（用于 401 时自动刷新 cookie）
  try {
    await kimiSessionManager.initialize()
    console.log('[App] Kimi session manager initialized')
    logManager.info('[App] Kimi session manager initialized', {})
  } catch (err) {
    console.log('[App] Kimi session manager init failed:', err)
    logManager.warn('[App] Kimi session manager init failed', { error: String(err) })
  }

  // 初始化通用 Cookie 会话管理器（网页版 Cookie 持续注入）
  try {
    const allProviderTypes: ProviderVendor[] = ['deepseek', 'glm', 'kimi', 'mimo', 'minimax', 'qwen', 'qwen-ai', 'zai', 'perplexity', 'stepfun']
    await cookieSessionManager.initialize(allProviderTypes)
    console.log('[App] Cookie session manager initialized for', allProviderTypes.length, 'providers')
    logManager.info('[App] Cookie session manager initialized', { providers: allProviderTypes.length })
  } catch (err) {
    console.log('[App] Cookie session manager init failed:', err)
    logManager.warn('[App] Cookie session manager init failed', { error: String(err) })
  }

  trayManager = createTrayManager(mainWindow)

  await loadAppContent(mainWindow)

  if (process.env.NODE_ENV === 'development') {
    openDevTools()
  }
}

async function loadAppContent(mainWindow: BrowserWindow): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    try {
      await loadUrl(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173')
    } catch (error) {
      console.error('Failed to load development server:', error)
    }
  } else {
    try {
      await loadFile(join(__dirname, '../renderer/index.html'))
    } catch (error) {
      console.error('Failed to load production files:', error)
    }
  }
}

function cleanup(): void {
  console.log('Application is exiting, performing cleanup...')
  storeManager.flushPendingWrites()
  const updaterManager = UpdaterManager.getInstance()
  updaterManager.destroy()
}

export function restartApp(): void {
  app.relaunch()
  app.quit()
}

export function getAppVersion(): string {
  return app.getVersion()
}

export function isAppQuitting(): boolean {
  return app.isQuitting ?? false
}

export { getMainWindow }
