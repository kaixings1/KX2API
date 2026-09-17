/**
 * Proxy Service Module - Proxy Server Core
 * Implements proxy server based on Koa
 */

import Koa, { type Context, type Next } from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Server as HttpServer } from 'http'
import routes from './routes'
import managementRoutes from './routes/management'
import { proxyStatusManager } from './status'
import { storeManager } from '../store/store'
import { checkApiKeyAuth } from './apiKeyAuth'
import { sessionManager } from './sessionManager'

const SLOW_REQUEST_THRESHOLD_MS = 1500

/**
 * Proxy Server Class
 */
export class ProxyServer {
  private app: Koa
  private router: Router
  private server: HttpServer | null = null
  private port: number = 8080
  private host: string = '127.0.0.1'

  constructor() {
    this.app = new Koa()
    this.router = new Router()

    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandler()
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(async (ctx, next) => {
      ctx.set('Access-Control-Allow-Origin', '*')
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
      ctx.set('Access-Control-Max-Age', '86400')

      if (ctx.method === 'OPTIONS') {
        ctx.status = 204
        return
      }

      await next()
    })

    this.app.use(bodyParser({
      jsonLimit: '50mb',
      formLimit: '50mb',
      textLimit: '50mb',
    }))

    // ── 调试日志中间件：打印 CLI↔Proxy 的上下行内容（含请求/响应头、耗时） ──
    this.app.use(async (ctx, next) => {
      const reqTime = Date.now()
      const reqTimeStr = new Date().toISOString().slice(11, 23)

      console.log(`[ProxyServer][MIDDLEWARE] ${reqTimeStr} ${ctx.method} ${ctx.path}`)

      // CLI→Proxy：外部客户端请求到达代理
      if (ctx.path.includes('/v1/') || ctx.path.includes('/chat')) {
        try {
          const reqBody = JSON.stringify(ctx.request.body ?? {})
          const rawHeaders = ctx.headers as Record<string, string | string[] | undefined>
          const safeHeaders: Record<string, string> = {}
          for (const [k, v] of Object.entries(rawHeaders)) {
            if (/authorization|api-key|x-api-key/i.test(k)) {
              safeHeaders[k] = typeof v === 'string' && v.startsWith('Bearer ') ? 'Bearer ***' : '***'
            } else {
              const val = typeof v === 'string' ? v : JSON.stringify(v)
              safeHeaders[k] = val.length > 200 ? '[truncated]' : val
            }
          }
          console.log(`\n[CLI→Proxy] ${reqTimeStr} ${ctx.method} ${ctx.path}`)
          console.log(`  Headers: ${JSON.stringify(safeHeaders, null, 2).slice(0, 800)}`)
          console.log(`  Body: ${reqBody.slice(0, 20000)}${reqBody.length > 20000 ? ' ...(truncated)' : ''}`)
        } catch { /* ignore */ }
      }

      await next()

      // Proxy→CLI / Proxy→CLI(gen)：代理返回响应给客户端
      try {
        if (ctx.path.includes('/v1/') || ctx.path.includes('/chat')) {
          const durationMs = Date.now() - reqTime
          const upTimeStr = new Date().toISOString().slice(11, 23)
          const genTag = (ctx.body as any)?.generatedByProxy ? '(gen)' : ''
          const resHeaderObj = ctx.response.header instanceof Map
            ? Object.fromEntries(ctx.response.header)
            : ctx.response.header
          const resHeaders = JSON.stringify(resHeaderObj ?? {}).slice(0, 500)
          console.log(`[Proxy→CLI${genTag}] ${upTimeStr} ${ctx.status} ${ctx.path} ${durationMs}ms`)
          console.log(`  Response Headers: ${resHeaders}`)

          const isStream = ctx.body && typeof (ctx.body as any).pipe === 'function'
          if (isStream) {
            const bodyStream = ctx.body as any
            console.log(`[Proxy→CLI${genTag}] ${upTimeStr} ${ctx.status} ${ctx.path} [STREAM 开始]`)
            // 逐行输出，避免 SSE 块自带的 \n\n 空行刷屏：
            // chunk.toString() 是 `data: {...}\n\n`，trim 掉首尾空白后再打，
            // 保证每个流块占一行、不产生空行。
            bodyStream.on('data', (chunk: Buffer) => {
              const text = chunk.toString().trim()
              if (!text) return
              console.log(`[Proxy→CLI${genTag}-STREAM] ${text}`)
            })
            bodyStream.on('end', () => {
              console.log(`[Proxy→CLI${genTag}-STREAM] <<END>> ${durationMs}ms total`)
            })
            bodyStream.on('error', (err: Error) => {
              console.error(`[Proxy→CLI${genTag}-STREAM] <<ERROR>> ${err.message}`)
            })
          } else {
            const rb = JSON.stringify(ctx.body ?? {})
            console.log(`  Body: ${rb.slice(0, 20000)}${rb.length > 20000 ? ' ...(truncated)' : ''}`)
          }
        }
      } catch { /* ignore */ }
    })

    // API Key validation middleware
    this.app.use(async (ctx, next) => {
      // Skip paths that don't require authentication
      const publicPaths = ['/', '/health', '/stats']
      if (publicPaths.includes(ctx.path)) {
        await next()
        return
      }

      // Skip management API paths - they have their own authentication
      if (ctx.path.startsWith('/v0/management')) {
        await next()
        return
      }

      const config = storeManager.getConfig()

      // 判定逻辑抽到 proxy/apiKeyAuth.ts（纯函数，可单测）。
      // 重点：开关开启但没建 Key 时必须拒绝，不能像以前那样静默放行（fail-open）。
      const decision = checkApiKeyAuth({
        enableApiKey: !!config.enableApiKey,
        apiKeys: config.apiKeys || [],
        clientIP: ctx.ip || '',
        authHeader: ctx.get('Authorization') || '',
        headerApiKey: ctx.get('X-API-Key'),
        queryApiKey: ctx.query.api_key as string,
      })

      if (decision.action === 'reject') {
        ctx.status = decision.status
        ctx.body = {
          error: {
            message: decision.message,
            type: 'invalid_request_error',
            code: decision.code,
          },
        }
        return
      }

      if (decision.action === 'accept') {
        // Update usage statistics
        const updatedKeys = (config.apiKeys || []).map(k =>
          k.id === decision.keyId
            ? {
                ...k,
                lastUsedAt: Date.now(),
                usageCount: k.usageCount + 1
              }
          : k
        )
        storeManager.updateConfig({ apiKeys: updatedKeys })
      }

      await next()
    })

    this.app.use(async (ctx, next) => {
      const startTime = Date.now()

      await next()

      const latency = Date.now() - startTime
      const shouldRecordAccessLog =
        !ctx.path.startsWith('/v1/models') &&
        (ctx.status >= 400 || latency >= SLOW_REQUEST_THRESHOLD_MS)

      if (shouldRecordAccessLog) {
        storeManager.addLog('warn', `${ctx.method} ${ctx.path} ${ctx.status} ${latency}ms`, {
          data: {
            method: ctx.method,
            path: ctx.path,
            status: ctx.status,
            latency,
            clientIP: ctx.ip,
            slowRequest: latency >= SLOW_REQUEST_THRESHOLD_MS,
          },
        })
      }
    })
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Register OpenAI API routes
    for (const route of routes) {
      this.router.use(route.routes())
      this.router.use(route.allowedMethods())
    }

    this.router.get('/', async (ctx) => {
      ctx.body = {
        name: 'Chat2API Proxy',
        version: '1.1.2',
        description: 'OpenAI API compatible proxy service',
        endpoints: [
          'POST /v1/chat/completions',
          'GET /v1/models',
          'GET /v1/models/:model',
          'POST /v1/completions',
        ],
      }
    })

    this.router.get('/health', async (ctx) => {
      const status = proxyStatusManager.getRunningStatus()
      const statistics = proxyStatusManager.getStatistics()

      ctx.body = {
        status: status.isRunning ? 'running' : 'stopped',
        uptime: status.uptime,
        statistics: {
          totalRequests: statistics.totalRequests,
          successRequests: statistics.successRequests,
          failedRequests: statistics.failedRequests,
          activeConnections: statistics.activeConnections,
        },
      }
    })

    this.router.get('/stats', async (ctx) => {
      const statistics = proxyStatusManager.getStatistics()
      ctx.body = statistics
    })

    // Management API enable check middleware
    // This must be registered before management routes
    const managementEnableCheck = async (ctx: Context, next: Next) => {
      if (!ctx.path.startsWith('/v0/management')) {
        await next()
        return
      }

      try {
        const config = storeManager.getConfig()
        if (!config.managementApi?.enableManagementApi) {
          ctx.status = 404
          ctx.body = {
            success: false,
            error: {
              code: 'management_api_disabled',
              message: 'Management API is not enabled',
            },
          }
          return
        }
        await next()
      } catch {
        ctx.status = 503
        ctx.body = {
          success: false,
          error: {
            code: 'service_unavailable',
            message: 'Service is initializing',
          },
        }
      }
    }

    this.app.use(managementEnableCheck)

    // Register all management routes (they already have /v0/management prefix)
    for (const route of managementRoutes) {
      this.app.use(route.routes())
      this.app.use(route.allowedMethods())
    }

    this.app.use(this.router.routes())
    this.app.use(this.router.allowedMethods())

    this.app.use(async (ctx) => {
      ctx.status = 404
      ctx.body = {
        error: {
          message: `Route not found: ${ctx.method} ${ctx.path}`,
          type: 'not_found_error',
        },
      }
    })
  }

  /**
   * Setup error handler
   */
  private setupErrorHandler(): void {
    this.app.on('error', (err, ctx) => {
      const status = err.status || 500
      const message = err.message || 'Internal Server Error'

      storeManager.addLog('error', `Server error: ${message}`, {
        data: {
          status,
          path: ctx.path,
          method: ctx.method,
          stack: err.stack,
        },
      })
    })
  }

  /**
   * Start server
   */
  async start(port?: number, host?: string): Promise<boolean> {
    if (this.server) {
      return false
    }

    this.port = port || proxyStatusManager.getPort()
    this.host = host || proxyStatusManager.getHost()

    sessionManager.initialize()

    return new Promise((resolve) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          proxyStatusManager.start()
          proxyStatusManager.setPort(this.port)
          proxyStatusManager.setHost(this.host)

          storeManager.addLog('info', `Proxy server started successfully, listening on ${this.host}:${this.port}`)
          console.log(`[ProxyServer] LISTENING on ${this.host}:${this.port}, pid=${process.pid}, routes=${this.router.url}`)

          resolve(true)
        })

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            storeManager.addLog('error', `Port ${this.port} is already in use`)
          } else {
            storeManager.addLog('error', `Server error: ${err.message}`)
          }
          this.server = null
          resolve(false)
        })

        this.server.on('close', () => {
          this.server = null
        })
      } catch (error) {
        storeManager.addLog('error', `Failed to start server: ${error instanceof Error ? error.message : '未知错误'}`)
        resolve(false)
      }
    })
  }

  /**
   * Stop server
   */
  async stop(): Promise<boolean> {
    if (!this.server) {
      return false
    }

    sessionManager.destroy()

    return new Promise((resolve) => {
      this.server!.close((err) => {
        if (err) {
          storeManager.addLog('error', `Failed to stop server: ${err.message}`)
          resolve(false)
          return
        }

        this.server = null
        proxyStatusManager.stop()

        storeManager.addLog('info', 'Proxy server stopped')

        resolve(true)
      })
    })
  }

  /**
   * Restart server
   */
  async restart(port?: number, host?: string): Promise<boolean> {
    await this.stop()
    return this.start(port, host)
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && proxyStatusManager.getRunningStatus().isRunning
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return proxyStatusManager.getStatistics()
  }

  /**
   * Get running status
   */
  getStatus() {
    return proxyStatusManager.getRunningStatus()
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    proxyStatusManager.resetStatistics()
  }
}

export const proxyServer = new ProxyServer()
export default proxyServer
