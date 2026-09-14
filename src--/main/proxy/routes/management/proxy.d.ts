/**
 * Management API - Proxy Control Routes
 * Provides endpoints for proxy service control (start, stop, restart, status)
 */
declare const router: import("@koa/router").RouterWithMethods<string, import("koa").DefaultState, import("koa").DefaultContext>;
export default router;
