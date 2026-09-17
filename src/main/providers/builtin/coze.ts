import type { BuiltinProviderConfig } from '../../store/types'

export const cozeConfig: BuiltinProviderConfig = {
  id: 'coze',
  name: 'Coze (ByteDance)',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.coze.com',
  chatPath: '/open_api/v2/chat',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: '字节跳动出品的 Coze 机器人平台',
  supportedModels: [
    'gpt-4-0506', 'gpt-4o', 'claude-3-5-sonnet-20240620',
    'doubao-lite-32k', 'doubao-pro-32k', 'moonshot-v1-8k',
  ],
  modelMappings: {},
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'pat_...',
      helpText: 'Coze API token from coze.com',
    },
  ],
  tokenCheckEndpoint: '/open_api/v1/me',
  tokenCheckMethod: 'GET',
}

export default cozeConfig
