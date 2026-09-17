/**
 * ToolOrchestrator — KX2API 适配版
 *
 * 从 doge-desktop 的 toolOrchestration.ts 提取核心逻辑：
 * - partitionToolCalls：将工具调用按 isConcurrencySafe 分批
 * - runTools：并发安全工具并发执行，互斥工具串行执行
 */

import { pMap } from '../../utils/pMap.ts'
import type { ContentBlock, ToolDefinition } from '../../../engine/api/client.ts'

export interface ToolExecuteContext {
  toolDefinitions: ToolDefinition[]
  onToolResult: (toolCallId: string, result: string, error?: string) => void
  onProgress?: (message: string) => void
}

export interface MessageUpdate {
  content?: string
  toolCallId?: string
  newContext: ToolExecuteContext
}

/**
 * 判断工具是否可并发执行
 */
export function isConcurrencySafe(
  toolDef: ToolDefinition | undefined,
  input: Record<string, unknown>,
): boolean {
  if (!toolDef) return false

  try {
    const fn = toolDef.function
    const name = fn.name.toLowerCase()
    if (name === 'bash' || name === 'read' || name === 'write') {
      return false
    }
    return true
  } catch {
    return false
  }
}

type Batch = { isConcurrencySafe: boolean; blocks: ContentBlock[] }

/**
 * 将工具调用分批：连续的可并发工具归为一批，不可并发的单独一批
 */
export function partitionToolCalls(
  toolUseMessages: ContentBlock[],
  context: ToolExecuteContext,
): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const toolDef = findToolDefinition(context.toolDefinitions, toolUse.name)
    const safe = isConcurrencySafe(toolDef, (toolUse.input as Record<string, unknown>) || {})
    if (safe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1]!.blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe: safe, blocks: [toolUse] })
    }
    return acc
  }, [])
}

function findToolDefinition(
  toolDefinitions: ToolDefinition[],
  name: string,
): ToolDefinition | undefined {
  return toolDefinitions.find(t => t.function.name === name)
}

/**
 * 串行执行工具调用批次
 */
export async function* runToolsSerially(
  blocks: ContentBlock[],
  context: ToolExecuteContext,
  executeToolFn: (block: ContentBlock) => Promise<{ output: string; error?: string }>,
): AsyncGenerator<MessageUpdate, void> {
  for (const block of blocks) {
    context.onToolResult(block.id || '', '')
    try {
      const result = await executeToolFn(block)
      context.onToolResult(block.id || '', result.output, result.error)
      yield {
        content: result.output,
        toolCallId: block.id,
        newContext: context,
      }
    } catch (e) {
      const errorMsg = (e as Error).message
      context.onToolResult(block.id || '', '', errorMsg)
      yield {
        content: `错误: ${errorMsg}`,
        toolCallId: block.id,
        newContext: context,
      }
    }
  }
}

/**
 * 并发执行工具调用批次
 */
export async function* runToolsConcurrently(
  blocks: ContentBlock[],
  context: ToolExecuteContext,
  executeToolFn: (block: ContentBlock) => Promise<{ output: string; error?: string }>,
): AsyncGenerator<MessageUpdate, void> {
  const results = await pMap(
    blocks,
    async (block) => {
      context.onToolResult(block.id || '', '')
      try {
        const result = await executeToolFn(block)
        context.onToolResult(block.id || '', result.output, result.error)
        return { block, result }
      } catch (e) {
        const errorMsg = (e as Error).message
        context.onToolResult(block.id || '', '', errorMsg)
        return { block, result: { output: `错误: ${errorMsg}`, error: errorMsg } }
      }
    },
    { concurrency: blocks.length },
  )

  for (const { block, result } of results) {
    yield {
      content: result.output,
      toolCallId: block.id,
      newContext: context,
    }
  }
}

/**
 * 主入口：编排工具调用执行
 * - 并发安全工具：按批次顺序执行，每批内顺序执行
 * - 非并发安全工具：串行执行
 */
export async function* runTools(
  toolUseMessages: ContentBlock[],
  context: ToolExecuteContext,
  executeToolFn: (block: ContentBlock) => Promise<{ output: string; error?: string }>,
): AsyncGenerator<MessageUpdate, void> {
  const batches = partitionToolCalls(toolUseMessages, context)

  for (const { isConcurrencySafe, blocks } of batches) {
    if (isConcurrencySafe) {
      yield* runToolsConcurrently(blocks, context, executeToolFn)
    } else {
      yield* runToolsSerially(blocks, context, executeToolFn)
    }
  }
}
