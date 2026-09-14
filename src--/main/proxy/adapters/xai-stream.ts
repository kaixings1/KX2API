/**
 * xAI Stream Handler
 * xAI uses OpenAI-compatible streaming format
 */

import { PassThrough } from 'stream'
import { OpenAIStreamHandler } from './openai-stream'

export class XAIStreamHandler extends OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }
}

export default XAIStreamHandler
