import type { BuiltinProviderConfig } from '../../store/types'

export const googleConfig: BuiltinProviderConfig = {
  id: 'google',
  name: 'Google',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://generativelanguage.googleapis.com',
  headers: {
    'Content-Type': 'application/json',
  },
  enabled: true,
  description: 'Google Gemini models (Pro, Flash, etc.)',
  supportedModels: [
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
    'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro',
  ],
  modelMappings: {
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-1.5-flash': 'gemini-1.5-flash',
  },
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'AIza...',
      helpText: 'Google AI API key from aistudio.google.com',
    },
  ],
  tokenCheckEndpoint: '/v1beta/models',
  tokenCheckMethod: 'GET',
}

export default googleConfig
