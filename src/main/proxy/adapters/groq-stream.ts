/**
 * Groq Stream Handler
 * Groq uses OpenAI-compatible streaming format
 */

import { PassThrough } from 'stream'
import { OpenAIStreamHandler } from './openai-stream'

export class GroqStreamHandler extends OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }
}

export default GroqStreamHandler
