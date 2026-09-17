import type { BuiltinProviderConfig } from '../../store/types'

export const ollamaConfig: BuiltinProviderConfig = {
  id: 'ollama',
  name: 'Ollama',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'http://localhost:11434',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'Ollama local LLM runtime',
  supportedModels: [
    'llama3', 'llama3.1', 'llama3.2', 'llama2', 'mistral',
    'codellama', 'phi3', 'gemma', 'qwen', 'deepseek-coder',
  ],
  modelMappings: {},
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key (Optional)',
      type: 'password',
      required: false,
      placeholder: 'Optional API key',
      helpText: 'Ollama 通常本地运行，无需认证',
    },
  ],
  tokenCheckEndpoint: '/api/tags',
  tokenCheckMethod: 'GET',
}

export default ollamaConfig
