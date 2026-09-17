import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/perplexity.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// Account.credentials 是 Record<string, string>，取出的 cookies 静态类型是 string，
// 但运行时它可能是「JSON 字符串」或「已是对象」（凭据有时从 localStorage 原样带过来）。
// StoredCookies 是 {[name: string]: string}，故在此做一次宽松解析。
const re =
  /    \/\/ Store all cookies from credentials for Cloudflare-protected requests\r?\n    this\.allCookies = account\.credentials\.cookies \|\| \{\}/

if (!re.test(s)) {
  console.log('未命中 allCookies 赋值')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    // Store all cookies from credentials for Cloudflare-protected requests.',
    '    // credentials 的值类型是 string，但 cookies 可能是 JSON 字符串或已是对象，',
    '    // 两种都要能吃下，否则会把 string 当成 cookie 表用。',
    '    this.allCookies = parseStoredCookies(account.credentials.cookies)',
  ].join('\n'),
)

// 追加解析辅助函数（放在 StoredCookies 定义之后）
const anchor = 'const sessionCache = new Map<string, SessionData>()'
if (!s.includes(anchor)) {
  console.log('未命中 sessionCache 锚点')
  process.exit(1)
}

s = s.replace(
  anchor,
  [
    '/**',
    ' * 归一化凭据里的 cookies 字段。',
    ' * 兼容三种来源：未设置、JSON 字符串、已经是对象。',
    ' */',
    'function parseStoredCookies(raw: unknown): StoredCookies {',
    "  if (!raw) return {}",
    "  if (typeof raw === 'string') {",
    '    try {',
    '      const parsed: unknown = JSON.parse(raw)',
    '      return parseStoredCookies(parsed)',
    '    } catch {',
    '      return {}',
    '    }',
    '  }',
    "  if (typeof raw === 'object') {",
    '    const out: StoredCookies = {}',
    '    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {',
    "      if (typeof v === 'string') out[k] = v",
    '    }',
    '    return out',
    '  }',
    '  return {}',
    '}',
    '',
    anchor,
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
