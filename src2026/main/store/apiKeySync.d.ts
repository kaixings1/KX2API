/**
 * store/apiKeySync.ts — Profile apiKey 同步到代理认证列表的共享工具
 *
 * 消除 engine-bridge.ts 和 chat-handlers.ts 中的重复同步逻辑
 */
import type { Profile } from '../profiles/manager';
export declare function syncProfileApiKey(profile: Profile): void;
