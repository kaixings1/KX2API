/**
 * Management API - Provider Routes
 * Provides CRUD operations for provider management
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import ProviderManager from '../../../store/providers'
import type {
  Provider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderStatusRequest,
  ManagementApiResponse,
} from '../../../../shared/types'

const router = new Router({ prefix: '/v0/management/providers' })

router.use(managementAuthMiddleware)

function createErrorResponse(code: string, message: string): ManagementApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

function createSuccessResponse<T>(data: T): ManagementApiResponse<T> {
  return {
    success: true,
    data,
  }
}

router.get('/', async (ctx: Context) => {
  try {
    const providers = ProviderManager.getAll()

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(providers)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取供应商列表失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.get('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)

    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', '供应商不存在')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(provider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取供应商失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/', async (ctx: Context) => {
  try {
    const request = ctx.request.body as CreateProviderRequest

    if (!request.name || typeof request.name !== 'string') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少必填字段：name')
      return
    }

    if (!request.authType) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少必填字段：authType')
      return
    }

    if (!request.apiEndpoint || typeof request.apiEndpoint !== 'string') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少必填字段：apiEndpoint')
      return
    }

    const provider = ProviderManager.create({
      name: request.name,
      type: request.type || 'custom',
      authType: request.authType,
      apiEndpoint: request.apiEndpoint,
      chatPath: request.chatPath,
      headers: request.headers || {},
      description: request.description,
      icon: request.icon,
      supportedModels: request.supportedModels,
    })

    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(provider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '创建供应商失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.put('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const request = ctx.request.body as UpdateProviderRequest

    const existingProvider = ProviderManager.getById(id)
    if (!existingProvider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', '供应商不存在')
      return
    }

    const updates: Partial<Omit<Provider, 'id' | 'type' | 'createdAt'>> = {}

    if (request.name !== undefined) {
      updates.name = request.name
    }

    if (request.apiEndpoint !== undefined) {
      updates.apiEndpoint = request.apiEndpoint
    }

    if (request.chatPath !== undefined) {
      updates.chatPath = request.chatPath
    }

    if (request.headers !== undefined) {
      updates.headers = request.headers
    }

    if (request.enabled !== undefined) {
      updates.enabled = request.enabled
    }

    if (request.description !== undefined) {
      updates.description = request.description
    }

    if (request.icon !== undefined) {
      updates.icon = request.icon
    }

    if (request.supportedModels !== undefined) {
      updates.supportedModels = request.supportedModels
    }

    if (request.modelMappings !== undefined) {
      updates.modelMappings = request.modelMappings
    }

    const updatedProvider = ProviderManager.update(id, updates)

    if (!updatedProvider) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', '更新供应商失败')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updatedProvider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '更新供应商失败'

    if (errorMessage.includes('Built-in providers cannot modify')) {
      ctx.status = 403
      ctx.body = createErrorResponse('forbidden', errorMessage)
      return
    }

    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.delete('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id

    const deleted = ProviderManager.delete(id)

    if (!deleted) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', '供应商不存在')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ id, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除供应商失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.patch('/:id/status', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const request = ctx.request.body as ProviderStatusRequest

    if (request.enabled === undefined || typeof request.enabled !== 'boolean') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少或无效的必填字段：enabled（必须是布尔值）')
      return
    }

    const existingProvider = ProviderManager.getById(id)
    if (!existingProvider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', '供应商不存在')
      return
    }

    const updatedProvider = ProviderManager.update(id, { enabled: request.enabled })

    if (!updatedProvider) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', '更新供应商状态失败')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updatedProvider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '更新供应商状态失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
