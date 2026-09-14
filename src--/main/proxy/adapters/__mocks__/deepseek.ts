export class DeepSeekAdapter {
  static isDeepSeekProvider(provider: any): boolean { return false }
  static clearSessionCache(accountId: string) {}
}
export class DeepSeekStreamHandler {}
export const deepSeekAdapter = { DeepSeekAdapter }
