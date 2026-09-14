/**
 * Management API Routes Index
 * Exports all management route modules
 */
import configRouter from './config';
import providersRouter from './providers';
import accountsRouter from './accounts';
import apiKeysRouter from './apiKeys';
import modelMappingsRouter from './modelMappings';
import sessionsRouter from './sessions';
import statisticsRouter from './statistics';
import proxyRouter from './proxy';
import toolCallingRouter from './toolCalling';
export { configRouter, providersRouter, accountsRouter, apiKeysRouter, modelMappingsRouter, sessionsRouter, statisticsRouter, proxyRouter, toolCallingRouter, };
declare const _default: import("@koa/router").RouterWithMethods<string, import("koa").DefaultState, import("koa").DefaultContext>[];
export default _default;
