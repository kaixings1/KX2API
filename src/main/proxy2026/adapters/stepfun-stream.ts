/**
 * StepFun Stream Response Handler
 * Handles SSE text format from StepFun WebSocket binary protocol adapter
 */

import { PassThrough } from 'stream'
import {
  createToolCallState,
  processStreamContent,
  flushToolCallBuffer,
  createBaseChunk,
  ToolCallState
} from '../utils/streamToolHandler'

export class StepFunStreamHandler {
  private model: string
  private sessionId: any
  private plan: any
  private toolCallState: ToolCallState
  private isFirstChunk: boolean = true
  private created: number
  private accumulatedContent: string = ''

  constructor(model: string, sessionId: any, plan: any) {
    this.model = model
    this.sessionId = sessionId
    this.plan = plan
    this.created = Math.floor(Date.now() / 1000)
    this.toolCallState = createToolCallState()
  }

  async handleStream(stream: any): Promise<any> {
    console.log('[StepFun Stream][DIAG] handleStream CALLED, stream type=', stream?.constructor?.name, 'isDestroyed=', stream?.destroyed, 'readableEnded=', stream?.readableEnded)
    const transStream = new PassThrough()
    let doneCalled = false
    let dataChunkCount = 0

    // Safety timeout: if no data for 30s, end the stream to prevent infinite hang
    const safetyTimer = setTimeout(() => {
      console.error('[StepFun Stream][DIAG] SAFETY TIMEOUT: no data for 30s, ending stream. dataChunkCount=', dataChunkCount)
      if (!doneCalled) {
        doneCalled = true
        this.handleDone(transStream)
      }
    }, 30000)

    // The adapter emits SSE text format: "data: {json}\n\n"
    // Buffer incoming data and split by \n\n to get individual SSE messages
    let sseBuffer = ''
    stream.on('data', (chunk: Buffer) => {
      dataChunkCount++
      sseBuffer += chunk.toString()
      // Process all complete SSE messages (separated by \n\n)
      const messages = sseBuffer.split('\n\n')
      // Keep the last incomplete message in the buffer
      sseBuffer = messages.pop() || ''

      for (const msg of messages) {
        const trimmed = msg.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          clearTimeout(safetyTimer)
          if (!doneCalled) {
            doneCalled = true
            this.handleDone(transStream)
          }
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (dataChunkCount <= 5) {
            const contentLen = parsed?.choices?.[0]?.delta?.content?.length
            console.log('[StepFun Stream][DIAG] SSE event type=', parsed?.object, 'contentLen=', contentLen ?? 'n/a')
          }
          this.processChunk(parsed, transStream)
        } catch (err) {
          console.log('[StepFun Stream][DIAG] parse error for data=', data.slice(0, 200))
        }
      }
    })

    stream.on('end', () => {
      clearTimeout(safetyTimer)
      // Process any remaining data in buffer
      if (sseBuffer.trim() && sseBuffer.trim().startsWith('data:')) {
        const data = sseBuffer.trim().slice(5).trim()
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            this.processChunk(parsed, transStream)
          } catch {
            // ignore
          }
        }
      }
      console.log('[StepFun Stream][DIAG] source stream END, totalDataChunks=', dataChunkCount)
      if (!doneCalled) {
        doneCalled = true
        this.handleDone(transStream)
      }
    })

    stream.on('error', (err) => {
      clearTimeout(safetyTimer)
      console.error('[StepFun Stream] Stream error:', err)
      transStream.emit('error', err)
    })

    console.log('[StepFun Stream][DIAG] handleStream returning transStream, listeners attached')
    return transStream
  }

  private processChunk(chunk: any, transStream: PassThrough): void {
    // StepFun event stream format: {"data": {"event": {"reasoningEvent": {"text": "..."}}}}
    // or {"data": {"event": {"textEvent": {"text": "..."}}}}
    // or {"data": {"event": {"messageDoneEvent": {"message": {...}}}}}
    // or {"data": {"event": {"doneEvent": {}}}}
    const eventData = chunk?.data?.event
    if (!eventData) {
      // Try OpenAI format as fallback
      const choices = chunk.choices || []
      for (const choice of choices) {
        const delta = choice.delta || {}
        const content = delta.content || ''
        const reasoningContent = delta.reasoning_content || ''
        const toolCalls = delta.tool_calls
        const finishReason = choice.finish_reason

        if (reasoningContent) {
          const deltaChunk = {
            id: chunk.id || this.sessionId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: { role: 'assistant', reasoning_content: reasoningContent },
              finish_reason: null,
            }],
            created: this.created,
          }
          transStream.write(`data: ${JSON.stringify(deltaChunk)}\n\n`)
          this.isFirstChunk = false
        }

        if (content) {
          this.accumulatedContent += content

          const baseChunk = createBaseChunk(chunk.id || this.sessionId, this.model, this.created)
          const { chunks: outputChunks } = processStreamContent(
            content,
            this.toolCallState,
            baseChunk,
            !this.isFirstChunk,
            'stepfun'
          )

          for (const outChunk of outputChunks) {
            transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
          }

          if (outputChunks.length > 0) {
            this.isFirstChunk = false
          }
        }

        if (toolCalls && toolCalls.length > 0) {
          const deltaChunk = {
            id: chunk.id || this.sessionId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: { tool_calls: toolCalls },
              finish_reason: null,
            }],
            created: this.created,
          }
          transStream.write(`data: ${JSON.stringify(deltaChunk)}\n\n`)
          this.isFirstChunk = false
        }

        if (finishReason) {
          const deltaChunk = {
            id: chunk.id || this.sessionId,
            model: this.model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: finishReason,
            }],
            created: this.created,
          }
          transStream.write(`data: ${JSON.stringify(deltaChunk)}\n\n`)
        }
      }
      return
    }

    // Handle StepFun event types
    if (eventData.reasoningEvent) {
      const text = eventData.reasoningEvent.text || ''
      if (text) {
        const deltaChunk = {
          id: this.sessionId,
          model: this.model,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: { role: 'assistant', reasoning_content: text },
            finish_reason: null,
          }],
          created: this.created,
        }
        transStream.write(`data: ${JSON.stringify(deltaChunk)}\n\n`)
        this.isFirstChunk = false
      }
    }

    if (eventData.textEvent) {
      const text = eventData.textEvent.text || ''
      if (text) {
        this.accumulatedContent += text

        const baseChunk = createBaseChunk(this.sessionId, this.model, this.created)
        const { chunks: outputChunks } = processStreamContent(
          text,
          this.toolCallState,
          baseChunk,
          !this.isFirstChunk,
          'stepfun'
        )

        for (const outChunk of outputChunks) {
          transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
        }

        if (outputChunks.length > 0) {
          this.isFirstChunk = false
        }
      }
    }

    if (eventData.messageDoneEvent) {
      // Stream is complete, signal done
    }

    if (eventData.doneEvent) {
      // Final done event
    }
  }

  private handleDone(transStream: PassThrough): void {
    const baseChunk = createBaseChunk(this.sessionId, this.model, this.created)
    const flushChunks = flushToolCallBuffer(this.toolCallState, baseChunk, 'stepfun')
    console.log('[StepFun Stream][DIAG] handleDone, flushChunks=', flushChunks.length, 'toolCallState.hasEmittedToolCall=', this.toolCallState.hasEmittedToolCall)
    for (const outChunk of flushChunks) {
      transStream.write(`data: ${JSON.stringify(outChunk)}\n\n`)
    }

    const finishReason = this.toolCallState.hasEmittedToolCall ? 'tool_calls' : 'stop'

    transStream.write(`data: ${JSON.stringify({
      id: this.sessionId,
      model: this.model,
      object: 'chat.completion.chunk',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: finishReason,
      }],
      created: this.created,
    })}\n\n`)

    transStream.write('data: [DONE]\n\n')
    transStream.end()
  }

  async handleNonStream(stream: any): Promise<any> {
    if (stream && typeof stream.on === 'function') {
      return new Promise((resolve, reject) => {
        let buffer = ''
        let content = ''
        let reasoning = ''

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const choices = parsed.choices || []
              for (const choice of choices) {
                const delta = choice.delta || {}
                if (delta.content) content += delta.content
                if (delta.reasoning_content) reasoning += delta.reasoning_content
              }
            } catch {
              // Ignore parse errors
            }
          }
        })

        stream.on('end', () => {
          const message: any = {
            role: 'assistant',
            content: content,
          }
          if (reasoning) {
            message.reasoning_content = reasoning
          }

          resolve({
            id: this.sessionId,
            model: this.model,
            object: 'chat.completion',
            choices: [{
              index: 0,
              message,
              finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            created: this.created,
          })
        })

        stream.on('error', (err) => {
          console.error('[StepFun] Non-stream error:', err)
          reject(err)
        })
      })
    }

    if (stream && typeof stream === 'object') {
      return stream
    }

    return {
      id: this.sessionId,
      model: this.model,
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      created: this.created,
    }
  }
}
