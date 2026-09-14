import type { BuiltinProviderConfig } from '../../store/types'

export const stepfunStudioConfig: BuiltinProviderConfig = {
  id: 'stepfun-studio',
  name: '阶跃Studio',
  type: 'builtin',
  authType: 'token',
  apiEndpoint: 'https://studio.stepfun.com',
  chatPath: '/api/agent/capy.agent.v1.AgentService/ChatStream',
  headers: {
    'Accept': '*/*',
    'Cache-Control': 'no-cache, no-transform',
    'Content-Type': 'application/connect+json',
    'Oasis-Platform': 'web',
    'Oasis-appID': '10300',
    'Canary': 'false',
    'Connect-Protocol-Version': '1',
    'Origin': 'https://studio.stepfun.com',
    'oasis-language': 'zh',
  },
  enabled: true,
  description: 'StepFun Studio (studio.stepfun.com) - 阶跃星辰 Studio 平台，提供 Step 系列模型',
  supportedModels: [
    // Step-1 series
    'step-1-8k',
    'step-1-32k',
    'step-1-128k',
    'step-1-256k',
    // Step-1o series (reasoning)
    'step-1o-mini',
    'step-1o-turbo',
    'step-1o-128k',
    // Step-2 series
    'step-2-mini',
    'step-2-turbo',
    'step-2-16k',
    // Step-3 series
    'step-3-mini-128k',
    'step-3-turbo-128k',
    'step-3-flash-128k',
    // Step-3.7 series
    'step-3.7-mini',
    'step-3.7-turbo',
    'step-3.7-max',
    'step-3.7-flash',
    // Step fun vision
    'step-fun-vision',
    // Step auto
    'step-auto',
  ],
  modelMappings: {
    'step-1-8k': 'step-1-8k',
    'step-1-32k': 'step-1-32k',
    'step-1-128k': 'step-1-128k',
    'step-1-256k': 'step-1-256k',
    'step-1o-mini': 'step-1o-mini',
    'step-1o-turbo': 'step-1o-turbo',
    'step-1o-128k': 'step-1o-128k',
    'step-2-mini': 'step-2-mini',
    'step-2-turbo': 'step-2-turbo',
    'step-2-16k': 'step-2-16k',
    'step-3-mini-128k': 'step-3-mini-128k',
    'step-3-turbo-128k': 'step-3-turbo-128k',
    'step-3-flash-128k': 'step-3-flash-128k',
    'step-3.7-mini': 'step-3.7-mini',
    'step-3.7-turbo': 'step-3.7-turbo',
    'step-3.7-max': 'step-3.7-max',
    'step-3.7-flash': 'step-3.7-flash',
    'step-fun-vision': 'step-fun-vision',
    'step-auto': 'step-auto',
  },
  credentialFields: [
    {
      name: 'token',
      label: 'Session Token',
      type: 'password',
      required: true,
      placeholder: '请输入阶跃Studio会话令牌（从浏览器 Cookie 中获取 Oasis-Token）',
      helpText: '登录 studio.stepfun.com 后，从浏览器 DevTools > Application > Cookies 中复制 Oasis-Token 值',
    },
    {
      name: 'web_id',
      label: 'Web ID',
      type: 'password',
      required: true,
      placeholder: '从浏览器 Cookie 中获取 web_id',
      helpText: '从浏览器 DevTools > Application > Cookies 中复制 web_id 值',
    },
  ],
  tokenCheckEndpoint: '/api/agent/capy.agent.v1.AgentService/GetChatConfig',
  tokenCheckMethod: 'POST',
}

export default stepfunStudioConfig
