/**
 * Mistral Stream Handler
 * Mistral uses OpenAI-compatible streaming format
 */

import { PassThrough } from 'stream'
import { OpenAIStreamHandler } from './openai-stream'

export class MistralStreamHandler extends OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }
}

export default MistralStreamHandler
