/**
 * Proxy Service Module - Route Index
 * Export all routes
 */
import chatRouter from './chat';
import modelsRouter from './models';
import completionsRouter from './completions';
export { chatRouter, modelsRouter, completionsRouter, };
declare const _default: import("@koa/router").RouterWithMethods<string, import("koa").DefaultState, import("koa").DefaultContext>[];
export default _default;
