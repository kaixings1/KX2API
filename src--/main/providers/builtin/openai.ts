import type { BuiltinProviderConfig } from '../../store/types'

export const openaiConfig: BuiltinProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.openai.com',
  chatPath: '/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'OpenAI GPT-4o, GPT-4, GPT-3.5 and other models',
  supportedModels: [
    'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
    'o1', 'o1-mini', 'o3-mini', 'o3', 'o4-mini',
  ],
  modelMappings: {
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'sk-...',
      helpText: 'OpenAI API key from platform.openai.com',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default openaiConfig
