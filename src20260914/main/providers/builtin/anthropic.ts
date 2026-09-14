import type { BuiltinProviderConfig } from '../../store/types'

export const anthropicConfig: BuiltinProviderConfig = {
  id: 'anthropic',
  name: 'Anthropic',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.anthropic.com',
  chatPath: '/v1/messages',
  headers: {
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  },
  enabled: true,
  description: 'Anthropic Claude models (Opus, Sonnet, Haiku)',
  supportedModels: [
    'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
  ],
  modelMappings: {
    'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'sk-ant-...',
      helpText: 'Anthropic API key from console.anthropic.com',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default anthropicConfig
