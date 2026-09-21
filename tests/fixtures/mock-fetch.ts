/**
 * tests/fixtures/mock-fetch.ts — 全局 fetch / axios 拦截器（离线测试基础设施）
 *
 * 解决的问题：本项目有测试会**真的向外部发起网络请求**
 * （最典型的是 `tests/engine/legacy/modelscope-auth.test.ts`，带着硬编码真实 Key
 * 向 ModelScope 打 3 次请求）。这类测试有三个害处：
 *   1. 消耗真实额度；
 *   2. 网络不通时**静默通过**（用例不 assert，跑了就绿灯）——比失败更危险；
 *   3. 把真实凭证留在源码与 git 历史里。
 *
 * 用法（在测试文件顶部调用一次即可）：
 * ```ts
 * import { installMockFetch, restoreFetch } from '../fixtures/mock-fetch.ts'
 *
 * before(() => installMockFetch({ 'api-inference.modelscope.cn': { status: 200, body: {...} } }))
 * after(() => restoreFetch())
 * ```
 *
 * 设计取舍：
 * - **按 host 路由**而非全局返回同一个响应：同一测试里请求不同域名时行为可控。
 * - **未匹配的 host 直接抛错**，而不是放行真实请求 —— 否则"忘了配 mock"
 *   会退化成真实网络调用，正是本文件要根治的问题。
 * - 支持 `assert`/断言已发生的请求，便于验证"确实发出了预期请求"。
 */

type MockResponse = {
  status?: number
  body?: unknown
  /** 原始文本（优先级高于 body） */
  text?: string
  headers?: Record<string, string>
}

type RouteMap = Record<string, MockResponse | ((url: string, init?: RequestInit) => MockResponse)>

export interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

let originalFetch: typeof globalThis.fetch | null = null
const recorded: RecordedRequest[] = []

/** 取出 URL 的 host（兼容相对路径） */
function hostOf(url: string): string {
  try {
    return new URL(url, 'http://localhost').host
  } catch {
    return ''
  }
}

function headerToObject(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {}
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => { out[k.toLowerCase()] = v })
    return out
  }
  if (Array.isArray(h)) {
    const out: Record<string, string> = {}
    for (const [k, v] of h) out[k.toLowerCase()] = v
    return out
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v)
  return out
}

function makeResponse(r: MockResponse): Response {
  const status = r.status ?? 200
  const text = r.text !== undefined ? r.text : JSON.stringify(r.body ?? {})
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json', ...(r.headers || {}) },
  })
}

/**
 * 安装 fetch mock。返回一个「已记录请求」的读取器。
 */
export function installMockFetch(routes: RouteMap): { requests: RecordedRequest[] } {
  if (!originalFetch) originalFetch = globalThis.fetch
  recorded.length = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const host = hostOf(url)
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase()

    recorded.push({
      url,
      method,
      headers: headerToObject(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    })

    const route = routes[host]
    if (!route) {
      // 刻意抛错而不是放行：未配置的 host 若走真实网络，
      // 会让"离线测试"变成"依赖外部服务的脆弱测试"。
      throw new Error(
        `[mock-fetch] 未配置 host "${host}" 的响应（url=${url}）。` +
          `请在 installMockFetch({ '${host}': {...} }) 中补上，或确认真实请求是否必要。`,
      )
    }
    const r = typeof route === 'function' ? route(url, init) : route
    return makeResponse(r)
  }) as typeof globalThis.fetch

  return { requests: recorded }
}

/** 还原原始 fetch */
export function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = null
  }
  recorded.length = 0
}

/** 已记录的请求（无需持有 install 的返回值） */
export function recordedRequests(): RecordedRequest[] {
  return [...recorded]
}
