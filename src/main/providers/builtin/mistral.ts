import type { BuiltinProviderConfig } from '../../store/types'

export const mistralConfig: BuiltinProviderConfig = {
  id: 'mistral',
  name: 'Mistral',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.mistral.ai',
  chatPath: '/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'Mistral AI (France) - Mistral, Mixtral, Codestral models',
  supportedModels: [
    'mistral-small-latest', 'mistral-large-latest', 'open-mistral-7b',
    'open-mixtral-8x7b', 'codestral-latest', 'ministral-8b',
  ],
  modelMappings: {
    'mistral-small-latest': 'mistral-small-latest',
    'mistral-large-latest': 'mistral-large-latest',
    'codestral-latest': 'codestral-latest',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: '...',
      helpText: 'Mistral API key from console.mistral.ai',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default mistralConfig
