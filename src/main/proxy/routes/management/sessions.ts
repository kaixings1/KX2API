/**
 * Management API - Session Routes
 * Provides session management operations
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import sessionManager from '../../sessionManager'
import type { ManagementApiResponse } from '../../../../shared/types'
// SessionRecord 的单一真源在 main/store/types（shared/types 未定义该类型）
import type { SessionRecord } from '../../../store/types'

const router = new Router({ prefix: '/v0/management' })

/**
 * Create error response
 */
function createErrorResponse(code: string, message: string): ManagementApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

/**
 * Create success response
 */
function createSuccessResponse<T>(data: T): ManagementApiResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Transform session for API response
 * Omits sensitive or internal fields if needed
 */
function transformSession(session: SessionRecord): SessionRecord {
  return {
    ...session,
  }
}

/**
 * GET /v0/management/sessions
 * List all active sessions
 */
router.get('/sessions', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const sessions = sessionManager.getAllActiveSessions()
    const transformedSessions = sessions.map(transformSession)
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(transformedSessions)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取会话列表失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * GET /v0/management/sessions/:id
 * Get session by ID with message history
 */
router.get('/sessions/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const session = sessionManager.getSession(id)
    
    if (!session) {
      ctx.status = 404
      ctx.body = createErrorResponse('session_not_found', `会话不存在：${id}`)
      return
    }
    
    const transformedSession = transformSession(session)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(transformedSession)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取会话失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * DELETE /v0/management/sessions/:id
 * Delete specific session
 */
router.delete('/sessions/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const session = sessionManager.getSession(id)
    
    if (!session) {
      ctx.status = 404
      ctx.body = createErrorResponse('session_not_found', `会话不存在：${id}`)
      return
    }
    
    const deleted = sessionManager.deleteSession(id)
    
    if (!deleted) {
      ctx.status = 500
      ctx.body = createErrorResponse('delete_failed', `删除会话失败：${id}`)
      return
    }
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ id, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除会话失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * DELETE /v0/management/sessions
 * Clear all sessions (requires confirmation)
 * Body: { confirm: true }
 */
router.delete('/sessions', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const body = ctx.request.body as { confirm?: boolean } | undefined
    
    if (!body || body.confirm !== true) {
      ctx.status = 400
      ctx.body = createErrorResponse('confirmation_required', '清空全部会话需在请求体带上 { confirm: true }')
      return
    }
    
    sessionManager.clearAllSessions()
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ cleared: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '清空会话失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
