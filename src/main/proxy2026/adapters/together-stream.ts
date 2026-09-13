/**
 * Together AI Stream Handler
 * Together AI uses OpenAI-compatible streaming format
 */

import { PassThrough } from 'stream'
import { OpenAIStreamHandler } from './openai-stream'

export class TogetherStreamHandler extends OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }
}

export default TogetherStreamHandler
