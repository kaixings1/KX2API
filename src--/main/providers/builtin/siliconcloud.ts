import type { BuiltinProviderConfig } from '../../store/types'

export const siliconCloudConfig: BuiltinProviderConfig = {
  id: 'siliconcloud',
  name: 'SiliconCloud',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://api.siliconflow.cn',
  chatPath: '/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'SiliconCloud (硅基流动) - Chinese open-source model hosting',
  supportedModels: [
    'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct',
    'meta-llama/Llama-3.1-70B-Instruct', 'THUDM/glm-4-9b-chat',
  ],
  modelMappings: {},
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'sk-...',
      helpText: 'SiliconCloud API key from cloud.siliconflow.cn',
    },
  ],
  tokenCheckEndpoint: '/v1/models',
  tokenCheckMethod: 'GET',
}

export default siliconCloudConfig
