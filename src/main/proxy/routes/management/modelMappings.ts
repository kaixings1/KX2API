/**
 * Management API - Model Mapping Routes
 * Provides CRUD operations for model mapping management
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import ConfigManager from '../../../store/config'
import type {
  ModelMapping,
  CreateModelMappingRequest,
  UpdateModelMappingRequest,
  ManagementApiResponse,
} from '../../../../shared/types'

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
 * GET /v0/management/model-mappings
 * List all model mappings
 */
router.get('/model-mappings', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const mappings = ConfigManager.getModelMappings()
    const mappingList = Object.values(mappings)

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(mappingList)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取模型映射失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * POST /v0/management/model-mappings
 * Create new model mapping
 */
router.post('/model-mappings', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const request = ctx.request.body as CreateModelMappingRequest

    if (!request.requestModel) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少必填字段：requestModel')
      return
    }

    if (!request.actualModel) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', '缺少必填字段：actualModel')
      return
    }

    const existingMapping = ConfigManager.getModelMapping(request.requestModel)
    if (existingMapping) {
      ctx.status = 409
      ctx.body = createErrorResponse('mapping_exists', `模型映射已存在：${request.requestModel}`)
      return
    }

    const mapping: ModelMapping = {
      requestModel: request.requestModel,
      actualModel: request.actualModel,
      preferredProviderId: request.preferredProviderId,
      preferredAccountId: request.preferredAccountId,
    }

    ConfigManager.setModelMapping(mapping)

    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(mapping)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '创建模型映射失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * PUT /v0/management/model-mappings/:model
 * Update model mapping
 */
router.put('/model-mappings/:model', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const model = decodeURIComponent(ctx.params.model)
    const request = ctx.request.body as UpdateModelMappingRequest

    const existingMapping = ConfigManager.getModelMapping(model)
    if (!existingMapping) {
      ctx.status = 404
      ctx.body = createErrorResponse('mapping_not_found', `模型映射不存在：${model}`)
      return
    }

    const updatedMapping: ModelMapping = {
      requestModel: model,
      actualModel: request.actualModel ?? existingMapping.actualModel,
      preferredProviderId: request.preferredProviderId ?? existingMapping.preferredProviderId,
      preferredAccountId: request.preferredAccountId ?? existingMapping.preferredAccountId,
    }

    ConfigManager.setModelMapping(updatedMapping)

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updatedMapping)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '更新模型映射失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * DELETE /v0/management/model-mappings/:model
 * Delete model mapping
 */
router.delete('/model-mappings/:model', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const model = decodeURIComponent(ctx.params.model)

    const deleted = ConfigManager.removeModelMapping(model)

    if (!deleted) {
      ctx.status = 404
      ctx.body = createErrorResponse('mapping_not_found', `模型映射不存在：${model}`)
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ model, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除模型映射失败'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
