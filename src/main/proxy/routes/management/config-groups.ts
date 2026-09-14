/**
 * Management API - Config Groups Routes
 * Provides CRUD operations for .doge/*.json config group management
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import { configGroupManager } from '../../../store/configGroups'
import type { ConfigGroup } from '../../../store/configGroups'

const router = new Router({ prefix: '/v0/management/config-groups' })

router.use(managementAuthMiddleware)

function createErrorResponse(code: string, message: string): { success: false; error: { code: string; message: string } } {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

function createSuccessResponse<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data,
  }
}

// List all config groups
router.get('/', async (ctx: Context) => {
  try {
    const groups = configGroupManager.listGroups()
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(groups)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list config groups'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Get active config group info
router.get('/active', async (ctx: Context) => {
  try {
    const active = configGroupManager.getActiveGroup()
    if (!active) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'No active config group')
      return
    }
    const data = configGroupManager.readGroup(active.id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({
      group: active,
      data,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get active config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Get single config group
router.get('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const group = configGroupManager.getGroup(id)

    if (!group) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Config group not found')
      return
    }

    const data = configGroupManager.readGroup(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({
      group,
      data,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Create config group
router.post('/', async (ctx: Context) => {
  try {
    const body = ctx.request.body as {
      id: string
      data?: {
        presets?: Record<string, unknown>
        activePreset?: string
      }
    }

    if (!body.id || typeof body.id !== 'string') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: id')
      return
    }

    const group = configGroupManager.createGroup(body.id, body.data)

    if (!group) {
      ctx.status = 409
      ctx.body = createErrorResponse('conflict', 'Config group already exists')
      return
    }

    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(group)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Update config group
router.put('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const body = ctx.request.body as {
      data?: {
        presets?: Record<string, unknown>
        activePreset?: string
      }
    }

    const existing = configGroupManager.readGroup(id)
    if (!existing) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Config group not found')
      return
    }

    const data = {
      presets: body.data?.presets ?? existing.presets,
      activePreset: body.data?.activePreset ?? existing.activePreset,
    }

    const success = configGroupManager.writeGroup(id, data)

    if (!success) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', 'Failed to write config group')
      return
    }

    const group = configGroupManager.getGroup(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(group)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Delete config group
router.delete('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id

    const success = configGroupManager.deleteGroup(id)

    if (!success) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Config group not found')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ id, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Set active config group
router.patch('/:id/activate', async (ctx: Context) => {
  try {
    const id = ctx.params.id

    const success = configGroupManager.setActiveGroup(id)

    if (!success) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Config group not found')
      return
    }

    const group = configGroupManager.getGroup(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(group)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set active config group'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
