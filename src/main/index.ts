import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// Set UTF-8 encoding for stdout/stderr to fix Chinese character display on Windows
process.stdout.setDefaultEncoding?.('utf8')
process.stderr.setDefaultEncoding?.('utf8')

import { createWindow, getMainWindow, loadUrl, loadFile, openDevTools } from './window/manager'
import { createTrayManager, TrayManager } from './tray/TrayManager'
import { registerIpcHandlers } from './ipc/handlers'
import { registerChatHandlers } from './ipc/chat-handlers'
import { registerTaskHandlers } from './ipc/task-handlers'
import { registerAgentHandlers } from './agents/registerHandlers'
import { initEngineBridge } from './engine-bridge'
import { kimiSessionManager } from './oauth/kimiSessionManager'
import { stepfunSessionManager } from './oauth/stepfunSessionManager'
import { cookieSessionManager } from './oauth/cookieSessionManager'
import { UpdaterManager } from './updater'
import { storeManager } from './store/store'
import { ProviderManager } from './store/providers'
import { logManager } from './logger/manager'
import { planScheduler } from './plans/planScheduler'
import { taskScheduler } from './tasks/taskScheduler'
import { proxyServer } from './proxy/server'
import { proxyStatusManager } from './proxy/status'
// 静态导入：cleanup() 是同步的（退出路径无法 await），必须在模块加载期就可用
import { toolSessionStore, setToolSessionStorePath } from './tools/toolSessionStore.ts'

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

// Suppress DevTools CDP warning: "Autofill.enable wasn't found"
app.commandLine.appendSwitch('disable-features', 'Autofill')

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
let appInitialized = false

// Parse --debug-file <filename> from command line
function getDebugFilePath(): string | null {
  const args = process.argv
  const idx = args.indexOf('--debug-file')
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  const eqArg = args.find(a => a.startsWith('--debug-file='))
  if (eqArg) {
    return eqArg.split('=')[1]
  }
  return null
}
const debugFilePath = getDebugFilePath()
if (debugFilePath) {
  console.log('[App] Debug log file:', debugFilePath)
}

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
    logManager.destroy()
  })

  app.on('will-quit', () => {
    cleanup()
  })
}

async function setupApp(): Promise<void> {
  if (appInitialized) return
  appInitialized = true

  const mainWindow = createWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'KX2Code',
    show: false,
  })

  await logManager.initialize(debugFilePath)

  // 日志保留策略：内存条数与磁盘保留天数由配置决定（此前硬编码在 LogManager 内）。
  // 必须在 initialize 之后应用 —— 初始化会读盘恢复历史日志，届时才知道要裁多少。
  try {
    const { applyLogLimitsTo } = await import('./runtimeConfigApply.ts')
    applyLogLimitsTo(logManager)
    const lim = logManager.getLimits()
    logManager.info('[App] Log limits applied', {
      maxLogs: lim.maxLogs,
      retentionDays: lim.retentionDays,
    })
  } catch (err) {
    logManager.warn('[App] Apply log limits failed', { error: String(err) })
  }

  // 工具结果落盘目录：超限的工具输出（读日志、跑构建、列大目录）会写到这里，
  // 上下文里只留预览 + 路径，模型按需 Read 取回。放在 userData 下便于随应用清理。
  try {
    const { setToolResultsBaseDir, cleanupToolResults } = await import('../engine/toolResultStore.ts')
    const resultsDir = join(app.getPath('userData'), 'tool-results-root')
    setToolResultsBaseDir(resultsDir)
    const removed = await cleanupToolResults(30)
    logManager.info('[App] Tool result store ready', { dir: resultsDir, cleaned: removed })
  } catch (err) {
    logManager.warn('[App] Tool result store init failed', { error: String(err) })
  }

  // 工具会话状态落盘：让 tool_load 进来的工具在重启后仍可用
  // （原先纯内存 Map，重启即丢，而对话历史还在 → 模型以为工具可用但调用失败）
  try {
    setToolSessionStorePath(join(app.getPath('userData'), 'tool-sessions.json'))
    logManager.info('[App] Tool session store ready', {})
  } catch (err) {
    logManager.warn('[App] Tool session store init failed', { error: String(err) })
  }

  await registerIpcHandlers(mainWindow)
  registerTaskHandlers(mainWindow)
  registerAgentHandlers(mainWindow)
  planScheduler.initialize(mainWindow)
  taskScheduler.initialize(mainWindow)
  registerChatHandlers()
  await initEngineBridge(mainWindow)

  // 启动本地代理服务器
  try {
    await proxyServer.start()
    console.log('[App] Proxy server started on 127.0.0.1:8080')
  } catch (err) {
    console.log('[App] Proxy server start failed:', err)
  }

  // 初始化 Kimi 持久登录会话（用于 401 时自动刷新 cookie）
  try {
    await kimiSessionManager.initialize()
    console.log('[App] Kimi session manager initialized')
    logManager.info('[App] Kimi session manager initialized', {})
  } catch (err) {
    console.log('[App] Kimi session manager init failed:', err)
    logManager.warn('[App] Kimi session manager init failed', { error: String(err) })
  }

  // 初始化 StepFun 持久登录会话（保持 web session token 活跃，避免反复登录）
  try {
    await stepfunSessionManager.initialize()
    console.log('[App] StepFun session manager initialized')
    logManager.info('[App] StepFun session manager initialized', {})
  } catch (err) {
    console.log('[App] StepFun session manager init failed:', err)
    logManager.warn('[App] StepFun session manager init failed', { error: String(err) })
  }

  // 初始化通用 Cookie 会话管理器（网页版 Cookie 持续注入）
  try {
    const providers = ProviderManager.getEnabled().map(p => p.type)
    await cookieSessionManager.initialize(providers)
    console.log('[App] Cookie session manager initialized for', providers.length, 'providers')
    logManager.info('[App] Cookie session manager initialized', { providers: providers.length })
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
  // 工具会话状态用的是防抖落盘，退出时必须补一次同步刷新，
  // 否则最后 2 秒内的 tool_load / tool_unload 会丢失。
  // 这里用同步 IO 是刻意的：退出路径没有机会 await。
  try {
    toolSessionStore.flushSync()
  } catch {
    /* 未初始化时忽略 */
  }
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
