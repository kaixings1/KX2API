import type { BuiltinProviderConfig } from '../../store/types'

export const groqConfig: BuiltinProviderConfig = {
  id: 'groq',
  name: 'Groq',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.groq.com',
  chatPath: '/openai/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'Groq fast inference (Llama, Mixtral, Gemma)',
  supportedModels: [
    'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b',
  ],
  modelMappings: {
    'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
    'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'gsk_...',
      helpText: 'Groq API key from console.groq.com',
    },
  ],
  tokenCheckEndpoint: '/openai/v1/models',
  tokenCheckMethod: 'GET',
}

export default groqConfig
