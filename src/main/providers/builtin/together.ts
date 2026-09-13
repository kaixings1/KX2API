import type { BuiltinProviderConfig } from '../../store/types'

export const togetherConfig: BuiltinProviderConfig = {
  id: 'together',
  name: 'Together AI',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.together.xyz',
  chatPath: '/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'Together AI open-source model hosting',
  supportedModels: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'Qwen/Qwen2.5-72B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1',
    'meta-llama/Llama-3.1-8B-Instruct-Turbo',
  ],
  modelMappings: {},
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: '...',
      helpText: 'Together AI API key from api.together.xyz',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default togetherConfig
