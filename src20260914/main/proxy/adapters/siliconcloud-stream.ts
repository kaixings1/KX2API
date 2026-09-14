/**
 * SiliconCloud Stream Handler
 * SiliconCloud uses OpenAI-compatible streaming format
 */

import { PassThrough } from 'stream'
import { OpenAIStreamHandler } from './openai-stream'

export class SiliconCloudStreamHandler extends OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }
}

export default SiliconCloudStreamHandler
