import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'node:fs'
import { storeManager } from '../store/store'

let mainWindow: BrowserWindow | null = null

/**
 * 解析应用图标路径。
 *
 * 原实现用 `join(__dirname, '../../resources/icon.png')`：
 * 源码下 __dirname 是 `out/main`，`../../resources` 恰好回到仓库根，
 * 但仓库里**根本没有 resources 目录** —— 图标一直没能加载（静默失效）。
 * 图标实际在 `build/` 下。
 *
 * 这里按候选顺序探测并回退：优先用 app 根（打包后指向 asar 内），
 * 再退到构建输出相对路径。全部不存在时返回空值，
 * 让 Electron 用默认图标，而不是传一个坏路径。
 */
function resolveAppIcon(): string | undefined {
  const candidates = [
    // 打包后：extraResources 把 build/icon.png 拷到 resources 根（见 package.json）
    app.isPackaged && process.resourcesPath
      ? join(process.resourcesPath, 'icon.png')
      : '',
    // 兼容某些打包布局（图标落在 resources/build 下）
    app.isPackaged && process.resourcesPath
      ? join(process.resourcesPath, 'build', 'icon.png')
      : '',
    // 开发态：应用根下的 build 目录
    join(app.getAppPath(), 'build', 'icon.png'),
    // 源码直接运行 tsx 时 app.getAppPath 可能指向别处，用 __dirname 兜底
    join(__dirname, '../../build', 'icon.png'),
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      /* 单个候选探测失败继续下一个 */
    }
  }
  return void 0
}

export interface WindowOptions {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  title?: string
  show?: boolean
}

export function createWindow(options: WindowOptions = {}): BrowserWindow {
  const {
    width = 1200,
    height = 800,
    minWidth = 800,
    minHeight = 600,
    title = 'Chat2API',
    show = false,
  } = options

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
    title,
    show,
    autoHideMenuBar: true,
    frame: true,
    backgroundColor: '#1a1a1a',
    icon: resolveAppIcon(),
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['<all_urls>'] },
    (details, callback) => {
      const isMainDocument = details.resourceType === 'mainFrame'

      if (!isMainDocument) {
        return callback({ responseHeaders: details.responseHeaders })
      }

      const isDev = process.env.NODE_ENV === 'development'
      const csp = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://localhost:5173;"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:* http://localhost:*;"

      const headers: Record<string, string[]> = {}
      for (const [key, value] of Object.entries(details.responseHeaders)) {
        headers[key] = Array.isArray(value) ? value : [String(value)]
      }
      headers['Content-Security-Policy'] = [csp]
      callback({ responseHeaders: headers })
    }
  )

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDev = process.env.NODE_ENV === 'development'
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
    const prodPrefix = 'file://'

    if (isDev) {
      if (!url.startsWith(devUrl)) {
        event.preventDefault()
        shell.openExternal(url)
      }
    } else {
      if (!url.startsWith(prodPrefix)) {
        event.preventDefault()
        shell.openExternal(url)
      }
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      try {
        const config = storeManager.getConfig()
        if (config.minimizeToTray) {
          event.preventDefault()
          mainWindow?.hide()
        }
      } catch (error) {
        console.error('[Window] Failed to get config during close:', error)
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function showWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  }
}

export function hideWindow(): void {
  mainWindow?.hide()
}

export function minimizeWindow(): void {
  mainWindow?.minimize()
}

export function maximizeWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
}

export function closeWindow(): void {
  mainWindow?.close()
}

export function isWindowVisible(): boolean {
  return mainWindow?.isVisible() ?? false
}

export function isWindowMaximized(): boolean {
  return mainWindow?.isMaximized() ?? false
}

export function isWindowMinimized(): boolean {
  return mainWindow?.isMinimized() ?? false
}

export function loadUrl(url: string): Promise<void> {
  return mainWindow?.loadURL(url) ?? Promise.resolve()
}

export function loadFile(filePath: string): Promise<void> {
  return mainWindow?.loadFile(filePath) ?? Promise.resolve()
}

export function reloadWindow(): void {
  mainWindow?.reload()
}

export function openDevTools(): void {
  mainWindow?.webContents.openDevTools()
}

export function closeDevTools(): void {
  mainWindow?.webContents.closeDevTools()
}

export function toggleDevTools(): void {
  mainWindow?.webContents.toggleDevTools()
}
