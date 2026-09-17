/**
 * Proxy Service Module - Stream Response Handler
 * Properly handles SSE format, supports stream and non-stream response conversion
 */

import { PassThrough, Transform } from 'stream'
import { SSEEvent, ChatCompletionResponse, ChatCompletionChoice, ToolCall } from './types'
import { parseToolCalls } from './utils/toolParser/index'
import { StreamQueueDetector } from './utils/streamQueueDetector'

/**
 * SSE Parser
 */
export class SSEParser {
  private buffer: string = ''

  /**
   * Parse SSE data
   */
  parse(data: string): SSEEvent[] {
    this.buffer += data
    const events: SSEEvent[] = []
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    let currentEvent: Partial<SSEEvent> = {}

    for (const line of lines) {
      if (line === '') {
        if (currentEvent.data !== undefined) {
          events.push({
            event: currentEvent.event,
            data: currentEvent.data,
            id: currentEvent.id,
            retry: currentEvent.retry,
          })
        }
        currentEvent = {}
        continue
      }

      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) {
        continue
      }

      const field = line.slice(0, colonIndex)
      let value = line.slice(colonIndex + 1)

      if (value.startsWith(' ')) {
        value = value.slice(1)
      }

      switch (field) {
        case 'event':
          currentEvent.event = value
          break
        case 'data':
          currentEvent.data = (currentEvent.data || '') + value
          break
        case 'id':
          currentEvent.id = value
          break
        case 'retry':
          currentEvent.retry = parseInt(value, 10)
          break
      }
    }

    return events
  }

  /**
   * Reset parser
   */
  reset(): void {
    this.buffer = ''
  }
}

/**
 * SSE Formatter
 */
export class SSEFormatter {
  /**
   * Format SSE event
   */
  format(event: SSEEvent): string {
    let result = ''

    if (event.id) {
      result += `id: ${event.id}\n`
    }

    if (event.event) {
      result += `event: ${event.event}\n`
    }

    if (event.retry !== undefined) {
      result += `retry: ${event.retry}\n`
    }

    result += `data: ${event.data}\n\n`

    return result
  }

  /**
   * Format JSON data
   */
  formatJSON(data: object, event?: string): string {
    return this.format({
      event,
      data: JSON.stringify(data),
    })
  }

  /**
   * Format done marker
   */
  formatDone(): string {
    return 'data: [DONE]\n\n'
  }
}

/**
 * Stream Response Handler
 */
export class StreamHandler {
  private parser: SSEParser
  private formatter: SSEFormatter

  constructor() {
    this.parser = new SSEParser()
    this.formatter = new SSEFormatter()
  }

  /**
   * Create SSE transform stream
   * Converts upstream response to OpenAI compatible format
   */
  createTransformStream(
    model: string,
    responseId: string,
    onEnd?: () => void
  ): Transform {
    let isFirstChunk = true
    const created = Math.floor(Date.now() / 1000)
    const parser = this.parser
    const formatter = this.formatter
    const transformChunk = this.transformChunk.bind(this)

    // Queue-based tool call detector (always-on sliding window)
    const detector = new StreamQueueDetector()

    // Tool call buffering state (fallback / bracket format legacy)
    let contentBuffer = ''
    let isBufferingToolCall = false
    let toolCallIndex = 0

    // pushFn 由 Transform 实例提供；箭头函数里的 this 是 StreamHandler，不能直接 this.push
    const emitToolCalls = (toolCalls: any[], transformedData: any, pushFn: (data: string) => void) => {
      for (const tc of toolCalls) {
        tc.index = toolCallIndex++
        const toolCallData = {
          ...transformedData,
          choices: [{
            index: 0,
            delta: {
              role: isFirstChunk ? 'assistant' : undefined,
              tool_calls: [tc]
            },
            finish_reason: null
          }]
        }
        isFirstChunk = false
        pushFn(formatter.formatJSON(toolCallData))
      }
    }

    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding, callback) {
        try {
          const events = parser.parse(chunk.toString())

          for (const event of events) {
            if (event.data === '[DONE]') {
              // Feed any remaining content through detector before done
              if (contentBuffer) {
                const results = detector.feed(contentBuffer)
                for (const r of results) {
                  if (r.kind === 'tool_calls') {
                    emitToolCalls(r.toolCalls, {}, d => this.push(d))
                  } else if (r.kind === 'text') {
                    const finalData = transformChunk({ content: r.content }, model, responseId, created, isFirstChunk)
                    if (finalData) {
                      isFirstChunk = false
                      this.push(formatter.formatJSON(finalData))
                    }
                  }
                }
                contentBuffer = ''
              }
              // Flush detector
              const flushResults = detector.flush()
              for (const r of flushResults) {
                if (r.kind === 'tool_calls') {
                  emitToolCalls(r.toolCalls, {}, d => this.push(d))
                } else if (r.kind === 'text') {
                  const finalData = transformChunk({ content: r.content }, model, responseId, created, isFirstChunk)
                  if (finalData) {
                    isFirstChunk = false
                    this.push(formatter.formatJSON(finalData))
                  }
                }
              }
              this.push(formatter.formatDone())
              continue
            }

            let parsedData: any
            try {
              parsedData = JSON.parse(event.data)
            } catch {
              this.push(formatter.format(event))
              continue
            }

            const transformedData = transformChunk(parsedData, model, responseId, created, isFirstChunk)
            if (!transformedData) continue

            // Handle text content through queue detector
            const deltaContent = transformedData.choices[0] && transformedData.choices[0].delta ? (transformedData.choices[0].delta.content || '') : ''

            if (deltaContent) {
              // Feed content through detector
              const results = detector.feed(deltaContent)

              // Also maintain legacy contentBuffer for non-tool content fallback
              contentBuffer += deltaContent

              // Safety: enforce max queue size
              const sizeResults = detector.enforceMaxSize()
              for (const r of sizeResults) {
                if (r.kind === 'text') {
                  const finalData = transformChunk({ content: r.content }, model, responseId, created, isFirstChunk)
                  if (finalData) {
                    isFirstChunk = false
                    this.push(formatter.formatJSON(finalData))
                  }
                }
              }

              for (const r of results) {
                if (r.kind === 'tool_calls') {
                  // Found complete tool call via queue detector
                  emitToolCalls(r.toolCalls, transformedData, d => this.push(d))
                  contentBuffer = ''
                } else if (r.kind === 'text') {
                  // Queue head flushed as text
                  const finalData = transformChunk({ content: r.content }, model, responseId, created, isFirstChunk)
                  if (finalData) {
                    isFirstChunk = false
                    this.push(formatter.formatJSON(finalData))
                  }
                  contentBuffer = contentBuffer.slice(r.content.length)
                }
              }

              // Legacy bracket format handling (still active as fallback)
              const marker = '[function_calls]'

              if (!isBufferingToolCall) {
                const markerIdx = contentBuffer.indexOf(marker)

                if (markerIdx !== -1) {
                  isBufferingToolCall = true
                  if (markerIdx > 0) {
                    const textBefore = contentBuffer.substring(0, markerIdx)
                    const textData = {
                      ...transformedData,
                      choices: [{
                        index: 0,
                        delta: { content: textBefore },
                        finish_reason: null
                      }]
                    }
                    this.push(formatter.formatJSON(textData))
                    isFirstChunk = false
                  }
                  contentBuffer = contentBuffer.substring(markerIdx)
                } else {
                  for (let i = 0; i < contentBuffer.length; i++) {
                    if (contentBuffer[i] === '[') {
                      const potentialMarker = contentBuffer.substring(i)
                      if (marker.startsWith(potentialMarker)) {
                        isBufferingToolCall = true
                        if (i > 0) {
                          const textBefore = contentBuffer.substring(0, i)
                          const textData = {
                            ...transformedData,
                            choices: [{
                              index: 0,
                              delta: { content: textBefore },
                              finish_reason: null
                            }]
                          }
                          this.push(formatter.formatJSON(textData))
                          isFirstChunk = false
                        }
                        contentBuffer = potentialMarker
                        break
                      }
                    }
                  }
                }
              }

              if (isBufferingToolCall) {
                // Try to parse tool calls from buffer
                const { content: cleanContent, toolCalls } = parseToolCalls(contentBuffer)

                if (toolCalls.length > 0) {
                  // We found complete tool calls!
                  emitToolCalls(toolCalls, transformedData, d => this.push(d))

                  // Reset buffer with remaining content
                  contentBuffer = cleanContent
                  isBufferingToolCall = contentBuffer.includes('[function_calls]')

                  if (contentBuffer && !isBufferingToolCall) {
                    const textData = {
                      ...transformedData,
                      choices: [{
                        index: 0,
                        delta: { content: contentBuffer },
                        finish_reason: null
                      }]
                    }
                    this.push(formatter.formatJSON(textData))
                    contentBuffer = ''
                  }
                  continue
                } else {
                  // Still buffering, waiting for complete JSON or closing tag
                  // Safety check: if buffer is too long and no tool call found, flush it
                  if (contentBuffer.length > 10000) {
                    isBufferingToolCall = false
                    // Fall through to normal text output
                  } else {
                    continue
                  }
                }
              }

              // Normal text output
              const outDelta = transformedData.choices[0]?.delta
              if (outDelta) outDelta.content = contentBuffer
              contentBuffer = ''
            }

            // Handle tool_calls in streaming response
            const inDelta = parsedData.choices?.[0]?.delta
            const outDelta2 = transformedData.choices[0]?.delta
            if (inDelta?.tool_calls && outDelta2) {
              outDelta2.tool_calls = inDelta.tool_calls
            }

            // Only push if we are NOT currently buffering a potential tool call
            if (!isBufferingToolCall) {
              isFirstChunk = false
              this.push(formatter.formatJSON(transformedData))
            }
          }

          callback()
        } catch (error) {
          callback(error as Error)
        }
      },

      flush(callback) {
        // Final detector flush
        const flushResults = detector.flush()
        for (const r of flushResults) {
          if (r.kind === 'tool_calls') {
            emitToolCalls(r.toolCalls, {}, d => this.push(d))
          } else if (r.kind === 'text') {
            const finalData = transformChunk({ content: r.content }, model, responseId, created, isFirstChunk)
            if (finalData) {
              isFirstChunk = false
              this.push(formatter.formatJSON(finalData))
            }
          }
        }

        if (contentBuffer) {
          // Final check for tool calls in buffer
          const { content: cleanContent, toolCalls } = parseToolCalls(contentBuffer)

          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              tc.index = toolCallIndex++
              const toolCallData = {
                id: responseId,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [{
                  index: 0,
                  delta: {
                    tool_calls: [tc]
                  },
                  finish_reason: null
                }]
              }
              this.push(formatter.formatJSON(toolCallData))
            }
          } else {
            // No tool calls, just flush content
            const finalData = transformChunk({ content: contentBuffer }, model, responseId, created, isFirstChunk)
            if (finalData) {
              this.push(formatter.formatJSON(finalData))
            }
          }
        }
        this.push(formatter.formatDone())
        onEnd?.()
        callback()
      },
    })
  }

  /**
   * Transform chunk to OpenAI format
   */
  private transformChunk(
    data: any,
    model: string,
    responseId: string,
    created: number,
    isFirstChunk: boolean
  ): ChatCompletionResponse | null {
    if (!data) return null

    const delta: ChatCompletionChoice['delta'] = {}

    if (isFirstChunk) {
      delta.role = 'assistant'
    }

    // Set reasoning_content first to ensure it appears before content in the response
    if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.reasoning_content) {
      delta.reasoning_content = data.choices[0].delta.reasoning_content
    } else if (data.reasoning_content) {
      delta.reasoning_content = data.reasoning_content
    }

    if (typeof data === 'string') {
      delta.content = data
    } else if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content !== undefined) {
      delta.content = data.choices[0].delta.content
    } else if (data.content) {
      delta.content = data.content
    }

    const response: ChatCompletionResponse = {
      id: responseId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta,
        finish_reason: data.choices && data.choices[0] && data.choices[0].finish_reason ? data.choices[0].finish_reason : null,
      }],
    }

    if (data.usage) {
      response.usage = data.usage
    }

    return response
  }
}

export const streamHandler = new StreamHandler()
