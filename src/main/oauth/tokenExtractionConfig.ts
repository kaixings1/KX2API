/**
 * Token Extraction Configuration
 * Defines how to extract tokens from different providers
 */

import { ProviderType } from './types'

export type TokenSourceType = 'networkHeader' | 'localStorage' | 'cookie'

export interface TokenSource {
  type: TokenSourceType
  key: string
  alias?: string
  urlPattern?: string
  extractPattern?: string
}

export interface TokenExtractionConfig {
  loginUrl: string
  tokenSources: TokenSource[]
  targetDomains: string[]
  successUrlPatterns?: RegExp[]
  windowTitle?: string
}

export const TOKEN_EXTRACTION_CONFIGS: Record<ProviderType, TokenExtractionConfig> = {
  kimi: {
    loginUrl: 'https://www.kimi.com',
    tokenSources: [
      {
        type: 'networkHeader',
        key: 'token',
        urlPattern: '*://*.kimi.com/*',
        extractPattern: '^Bearer\\s+(.+)$',
      },
    ],
    targetDomains: ['kimi.com'],
    successUrlPatterns: [/kimi\.com/i],
    windowTitle: 'Kimi Login',
  },

  deepseek: {
    loginUrl: 'https://chat.deepseek.com',
    tokenSources: [
      {
        type: 'localStorage',
        key: 'userToken',
      },
    ],
    targetDomains: ['deepseek.com'],
    successUrlPatterns: [/chat\.deepseek\.com/i],
    windowTitle: 'DeepSeek Login',
  },

  glm: {
    loginUrl: 'https://chatglm.cn',
    tokenSources: [
      {
        type: 'cookie',
        key: 'chatglm_refresh_token',
      },
    ],
    targetDomains: ['chatglm.cn'],
    successUrlPatterns: [/chatglm\.cn/i],
    windowTitle: 'GLM Login',
  },

  qwen: {
    loginUrl: 'https://www.qianwen.com',
    tokenSources: [
      {
        type: 'cookie',
        key: 'tongyi_sso_ticket',
      },
    ],
    targetDomains: ['qianwen.com'],
    successUrlPatterns: [/qianwen\.com/i],
    windowTitle: 'Qwen Login',
  },

  minimax: {
    loginUrl: 'https://agent.minimaxi.com',
    tokenSources: [
      {
        type: 'localStorage',
        key: '_token',
      },
      {
        type: 'localStorage',
        key: 'user_detail_agent',
      },
    ],
    targetDomains: ['minimaxi.com'],
    successUrlPatterns: [/agent\.minimaxi\.com/i],
    windowTitle: 'MiniMax Login',
  },

  zai: {
    loginUrl: 'https://chat.z.ai',
    tokenSources: [
      {
        type: 'localStorage',
        key: 'token',
      },
      {
        type: 'cookie',
        key: 'token',
      },
    ],
    targetDomains: ['z.ai', 'chat.z.ai'],
    successUrlPatterns: [/chat\.z\.ai/i, /z\.ai/i],
    windowTitle: 'Z.ai Login',
  },
  mimo: {
    loginUrl: 'https://aistudio.xiaomimimo.com',
    tokenSources: [
      {
        type: 'cookie',
        key: 'serviceToken',
      },
      {
        type: 'cookie',
        key: 'userId',
      },
      {
        type: 'cookie',
        key: 'xiaomichatbot_ph',
      },
    ],
    targetDomains: ['xiaomimimo.com'],
    successUrlPatterns: [/aistudio\.xiaomimimo\.com/i],
    windowTitle: 'Mimo AI Studio Login',
  },
  'qwen-ai': {
    loginUrl: 'https://chat.qwen.ai',
    tokenSources: [
      {
        type: 'localStorage',
        key: 'token',
      },
      {
        type: 'cookie',
        key: 'token',
      },
    ],
    targetDomains: ['qwen.ai', 'chat.qwen.ai'],
    successUrlPatterns: [/chat\.qwen\.ai/i, /qwen\.ai/i],
    windowTitle: 'Qwen AI Login',
  },
  perplexity: {
    loginUrl: 'https://www.perplexity.ai',
    tokenSources: [
      {
        type: 'cookie',
        key: '__Secure-next-auth.session-token',
      },
      {
        type: 'cookie',
        key: 'next-auth.session-token',
      },
    ],
    targetDomains: ['perplexity.ai'],
    successUrlPatterns: [/perplexity\.ai/i],
    windowTitle: 'Perplexity Login - Please click Sign In to login',
  },
  // StepFun stores its identity in three places that all have to agree for a
  // session to work:
  //
  //   Oasis-Token (cookie)   the account, plus activated / exp
  //   Oasis-Webid (cookie)   the device the token signature is checked against
  //   deviceId    (localStorage) the same device id, used by the web client
  //
  // There is NO localStorage key named "web_id" — the app's own
  // device-storage blob calls it deviceId, and reads looked for the wrong name
  // so the login flow waited forever and then validated a partial set.
  //
  // deviceId is aliased to web_id because that is the credential field the
  // adapter and the account store expect.
  stepfun: {
    loginUrl: 'https://chat.stepfun.com',
    tokenSources: [
      {
        type: 'cookie',
        key: 'Oasis-Token',
      },
      {
        type: 'localStorage',
        key: 'deviceId',
        alias: 'web_id',
      },
      {
        type: 'cookie',
        key: 'Oasis-Webid',
        alias: 'device_id',
      },
    ],
    targetDomains: ['stepfun.com', 'chat.stepfun.com'],
    successUrlPatterns: [/chat\.stepfun\.com/i, /stepfun\.com/i],
    windowTitle: 'StepFun Login',
  },
}

export function getTokenExtractionConfig(providerType: ProviderType): TokenExtractionConfig | null {
  return TOKEN_EXTRACTION_CONFIGS[providerType] || null
}
