import type { BuiltinProviderConfig } from '../../store/types'

export const xaiConfig: BuiltinProviderConfig = {
  id: 'xai',
  name: 'xAI (Grok)',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.x.ai',
  chatPath: '/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'xAI Grok models with real-time knowledge',
  supportedModels: [
    'grok-3', 'grok-3-latest', 'grok-2-vision-1212', 'grok-2-latest',
    'grok-2-image-1212', 'grok-vision-beta',
  ],
  modelMappings: {
    'grok-3': 'grok-3',
    'grok-2-vision-1212': 'grok-2-vision-1212',
    'grok-2-latest': 'grok-2-latest',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'xai-...',
      helpText: 'xAI API key from console.x.ai',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default xaiConfig
