export interface TokenExtractionGuide {
  loginUrl: string
  steps: string[]
  tokenKey: string
  tokenLabel: string
  storageType: 'localStorage' | 'cookie' | 'other'
  placeholder?: string
  helpUrl?: string
}

export const TOKEN_EXTRACTION_GUIDES: Record<string, TokenExtractionGuide> = {
  deepseek: {
    loginUrl: 'https://chat.deepseek.com',
    steps: [
      '1. Click the button below to open DeepSeek website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Local Storage → chat.deepseek.com on the left',
      '6. Find the userToken field and copy its value',
    ],
    tokenKey: 'userToken',
    tokenLabel: 'Token',
    storageType: 'localStorage',
    placeholder: 'Paste the Token obtained from DeepSeek',
  },
  qwen: {
    loginUrl: 'https://www.qianwen.com',
    steps: [
      '1. Click the button below to open Qwen website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Cookies → www.qianwen.com on the left',
      '6. Find tongyi_sso_ticket and copy its value',
    ],
    tokenKey: 'tongyi_sso_ticket',
    tokenLabel: 'Ticket',
    storageType: 'cookie',
    placeholder: 'Paste the Ticket obtained from Qwen',
  },
  glm: {
    loginUrl: 'https://chatglm.cn',
    steps: [
      '1. Click the button below to open GLM website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Local Storage → chatglm.cn on the left',
      '6. Find the token or access_token field and copy its value',
    ],
    tokenKey: 'token',
    tokenLabel: 'Token',
    storageType: 'localStorage',
    placeholder: 'Paste the Token obtained from GLM',
  },
  kimi: {
    loginUrl: 'https://www.kimi.com',
    steps: [
      '1. Click the button below to open Kimi website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Network tab',
      '5. Refresh the page or send a message',
      '6. Find any API request and check the Authorization header',
      '7. Copy the token value after Bearer',
    ],
    tokenKey: 'authorization',
    tokenLabel: 'Token',
    storageType: 'other',
    placeholder: 'Paste the Token obtained from Kimi',
  },
  minimax: {
    loginUrl: 'https://www.minimaxi.com',
    steps: [
      '1. Click the button below to open MiniMax website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Local Storage → www.minimaxi.com on the left',
      '6. Find the token or access_token field and copy its value',
    ],
    tokenKey: 'token',
    tokenLabel: 'Token',
    storageType: 'localStorage',
    placeholder: 'Paste the Token obtained from MiniMax',
  },
  'qwen-ai': {
    loginUrl: 'https://chat.qwen.ai',
    steps: [
      '1. Click the button below to open Qwen AI website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Local Storage → chat.qwen.ai on the left',
      '6. Find the "token" field (JWT format, starts with "eyJ...")',
      '7. Optionally also copy cookies from Cookies → chat.qwen.ai',
    ],
    tokenKey: 'token',
    tokenLabel: 'JWT Token',
    storageType: 'localStorage',
    placeholder: 'Paste the JWT Token obtained from Qwen AI',
  },
  zai: {
    loginUrl: 'https://chat.z.ai',
    steps: [
      '1. Click the button below to open Z.ai website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Cookies → chat.z.ai on the left',
      '6. Find the "token" field (JWT format, starts with "eyJ...") and copy its value',
    ],
    tokenKey: 'token',
    tokenLabel: 'JWT Token',
    storageType: 'cookie',
    placeholder: 'Paste the JWT Token obtained from Z.ai',
  },
  perplexity: {
    loginUrl: 'https://www.perplexity.ai',
    steps: [
      '1. Click the button below to open Perplexity website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Cookies → www.perplexity.ai on the left',
      '6. Find __Secure-next-auth.session-token and copy its value',
    ],
    tokenKey: '__Secure-next-auth.session-token',
    tokenLabel: 'Session Token',
    storageType: 'cookie',
    placeholder: 'Paste the Session Token obtained from Perplexity',
  },
  stepfun: {
    loginUrl: 'https://platform.stepfun.com',
    steps: [
      '1. Click the button below to open StepFun platform',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Cookies → platform.stepfun.com on the left',
      '6. Find the "Oasis-Token" field and copy its value',
    ],
    tokenKey: 'Oasis-Token',
    tokenLabel: 'Token',
    storageType: 'cookie',
    placeholder: 'Paste the Token obtained from StepFun',
  },
  mimo: {
    loginUrl: 'https://aistudio.xiaomimimo.com',
    steps: [
      '1. Click the button below to open Mimo AI Studio website',
      '2. Log in to your account',
      '3. Press F12 to open Developer Tools',
      '4. Switch to the Application tab',
      '5. Find Cookies → aistudio.xiaomimimo.com on the left',
      '6. Copy serviceToken, userId, and xiaomichatbot_ph cookie values',
    ],
    tokenKey: 'serviceToken',
    tokenLabel: 'Service Token',
    storageType: 'cookie',
    placeholder: 'Paste serviceToken, userId, xiaomichatbot_ph obtained from Mimo',
  },
}

export function getGuideByProvider(providerType: string): TokenExtractionGuide | undefined {
  return TOKEN_EXTRACTION_GUIDES[providerType]
}
