/**
 * Proxy Service Module - Entry File
 * Export all proxy service related modules
 */

export * from './types'
// 注意：既要用在下面挂到 globalThis，就必须**先 import 引入本地绑定**。
// 只写 `export { X } from './server'` 是「重导出」——它把名字对外暴露，
// 但不会在当前模块作用域建立绑定，后续直接引用 X 会抛 ReferenceError。
import { ProxyServer, proxyServer } from './server'
export { ProxyServer, proxyServer } from './server'
export { ProxyStatusManager, proxyStatusManager } from './status'
export { LoadBalancer, loadBalancer } from './loadbalancer'
export { ModelMapper, modelMapper } from './modelMapper'
export { RequestForwarder, requestForwarder } from './forwarder'
export { StreamHandler, streamHandler } from './stream'
// ./routes 的默认导出是「路由数组」，具名导出是各个 router
export { default as routes } from './routes'

// Expose for standalone proxy test (standalone-proxy-test.js)
declare const globalThis: any
;(globalThis || global).ProxyServer = ProxyServer
;(globalThis || global).proxyServer = proxyServer
