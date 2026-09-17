/**
 * Management API - Upstream Chat Session Routes
 *
 * Exposes the provider-side conversation APIs (capy.agent.v1.AgentService for
 * StepFun) so a conversation can be listed, created, renamed, starred and
 * deleted without leaving the app.
 *
 * Distinct from routes/management/sessions.ts, which manages the proxy's own
 * local session records. These routes reach the upstream service and require a
 * configured account.
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import AccountManager from '../../../store/accounts'
import ProviderManager from '../../../store/providers'
import { StepFunAdapter } from '../../adapters/stepfun'
import type { ManagementApiResponse } from '../../../../shared/types'

const router = new Router({ prefix: '/v0/management' })

function createErrorResponse(code: string, message: string): ManagementApiResponse {
  return { success: false, error: { code, message } }
}

function createSuccessResponse<T>(data: T): ManagementApiResponse<T> {
  return { success: true, data }
}

/**
 * Resolve the provider and account to operate on.
 *
 * Defaults to the first StepFun account when the caller does not name one, so
 * the common case needs no parameters.
 */
function resolveTarget(providerId?: string, accountId?: string): StepFunAdapter | null {
  let provider = providerId ? ProviderManager.getById(providerId) : null
  if (!provider) {
    provider = ProviderManager.getAll().find(p => StepFunAdapter.isStepFunProvider(p)) || null
  }
  if (!provider) return null

  let account = accountId ? AccountManager.getById(accountId, false) : null
  if (!account) {
    const candidates = AccountManager.getByProviderId(provider.id, false)
    account = candidates[0] || null
  }
  if (!account) return null

  return new StepFunAdapter(provider, account)
}

function readTarget(ctx: Context): { providerId?: string; accountId?: string } {
  const q = ctx.query || {}
  const b = (ctx.request.body || {}) as Record<string, any>
  return {
    providerId: (b.providerId as string) || (q.providerId as string) || undefined,
    accountId: (b.accountId as string) || (q.accountId as string) || undefined,
  }
}

function fail(ctx: Context, status: number, code: string, message: string): void {
  ctx.status = status
  ctx.body = createErrorResponse(code, message)
}

/**
 * GET /v0/management/chat-sessions
 * List upstream conversations. Query: providerId, accountId, pageSize, pageToken, favorites
 */
router.get('/chat-sessions', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const q = ctx.query as Record<string, string>
    const pageSize = q.pageSize ? parseInt(q.pageSize, 10) : 50
    const favorites = q.favorites === 'true' || q.favorites === '1'

    const opts: { pageSize: number; pageToken?: string; favorites?: boolean } = {
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50,
      favorites,
    }
    if (q.pageToken) opts.pageToken = q.pageToken

    const result = await adapter.listChatSessions(opts)

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : '列出会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * GET /v0/management/chat-sessions/search?query=...
 */
router.get('/chat-sessions/search', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const query = (ctx.query.query as string) || ''
    if (!query) {
      return fail(ctx, 400, 'query_required', 'Query parameter "query" is required')
    }

    const sessions = await adapter.searchChatSessions(query)

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ sessions })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '搜索会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * GET /v0/management/chat-sessions/:id
 */
router.get('/chat-sessions/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const session = await adapter.getChatSession(ctx.params.id)
    if (!session) {
      return fail(ctx, 404, 'chat_session_not_found', `会话不存在：${ctx.params.id}`)
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(session)
  } catch (error) {
    const msg = error instanceof Error ? error.message : '获取会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * POST /v0/management/chat-sessions
 * Create a conversation. Body: { providerId?, accountId?, type?, scene?, studioId? }
 */
router.post('/chat-sessions', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const body = (ctx.request.body || {}) as Record<string, any>
    const opts: { type?: string; scene?: string; studioId?: string } = {}
    if (body.type) opts.type = String(body.type)
    if (body.scene) opts.scene = String(body.scene)
    if (body.studioId) opts.studioId = String(body.studioId)

    // createChatSession is private; expose the operation through a public entry.
    const sessionId = await adapter.createSession(opts)

    ctx.set('Content-Type', 'application/json')
    ctx.status = 201
    ctx.body = createSuccessResponse({ chatSessionId: sessionId })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '创建会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * PATCH /v0/management/chat-sessions/:id
 * Body: { displayName?: string, favorite?: boolean }
 */
router.patch('/chat-sessions/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const body = (ctx.request.body || {}) as Record<string, any>
    const id = ctx.params.id
    const results: Record<string, boolean> = {}

    if (typeof body.displayName === 'string' && body.displayName) {
      results.renamed = await adapter.updateChatSession(id, body.displayName)
    }
    if (typeof body.favorite === 'boolean') {
      results.favored = await adapter.favorChatSession(id, body.favorite)
    }

    if (Object.keys(results).length === 0) {
      return fail(ctx, 400, 'nothing_to_update',
        'Provide "displayName" (string) and/or "favorite" (boolean)')
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ chatSessionId: id, ...results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '更新会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * DELETE /v0/management/chat-sessions/:id
 */
router.delete('/chat-sessions/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const id = ctx.params.id
    const ok = await adapter.deleteSession(id)
    if (!ok) {
      return fail(ctx, 500, 'delete_failed', `删除会话失败：${id}`)
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ chatSessionId: id, deleted: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '删除会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

/**
 * DELETE /v0/management/chat-sessions
 * Delete every stored conversation. Body: { confirm: true }
 */
router.delete('/chat-sessions', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const body = (ctx.request.body || {}) as Record<string, any>
    if (body.confirm !== true) {
      return fail(ctx, 400, 'confirmation_required',
        '删除全部会话需在请求体带上 { confirm: true }')
    }

    const { providerId, accountId } = readTarget(ctx)
    const adapter = resolveTarget(providerId, accountId)
    if (!adapter) {
      return fail(ctx, 404, 'no_account', '没有可用的供应商账户')
    }

    const ok = await adapter.deleteAllChats()
    if (!ok) {
      return fail(ctx, 500, 'delete_failed', '删除全部会话失败')
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ deleted: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '删除会话失败'
    fail(ctx, 500, 'internal_error', msg)
  }
})

export default router
