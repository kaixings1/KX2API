/**
 * tests/webSearch.test.ts — 网络搜索模块测试（离线，不打真实网络）
 *
 * 运行：node --import tsx --test tests/webSearch.test.ts
 *
 * 只测纯逻辑与 HTML 解析（用固定 HTML 片段），不发起真实请求，
 * 保证离线可跑、结果稳定。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  listEngines,
  formatSearchResults,
  type WebSearchResponse,
} from '../src/engine/websearch/index.ts'
import { decodeHtmlEntities, stripHtml, looksLikeBlockPage } from '../src/engine/websearch/htmlUtils.ts'

describe('htmlUtils', () => {
  test('decodeHtmlEntities 解命名实体', () => {
    assert.equal(decodeHtmlEntities('a &amp; b &lt;c&gt; &quot;d&quot;'), 'a & b <c> "d"')
  })

  test('decodeHtmlEntities 解十进制与十六进制数字实体', () => {
    assert.equal(decodeHtmlEntities('it&#39;s &#x27;ok&#x27;'), "it's 'ok'")
    // &#160; 是 U+00A0 不换行空格（非普通空格），此处忠实还原
    assert.equal(decodeHtmlEntities('x&#160;y'), 'x\u00a0y')
  })

  test('decodeHtmlEntities 遇到未知实体原样保留', () => {
    assert.equal(decodeHtmlEntities('&unknown; &amp;'), '&unknown; &')
  })

  test('stripHtml 先剥标签再解实体（避免解码出的 < 被当标签）', () => {
    // &lt;b&gt; 解码后是 <b>，若顺序反了会被当标签删掉
    assert.equal(stripHtml('<p>&lt;b&gt;hi&lt;/b&gt;</p>'), '<b>hi</b>')
  })

  test('stripHtml 压缩多余空白', () => {
    assert.equal(stripHtml('<div>  a\n\n  b  </div>'), 'a b')
  })

  test('looksLikeBlockPage 识别百度安全验证页', () => {
    const html = '<!DOCTYPE html><html><head><title>百度安全验证</title></head><body>' + 'x'.repeat(3000) + '</body></html>'
    assert.equal(looksLikeBlockPage(html), true)
  })

  test('looksLikeBlockPage 识别极短页面（不可能是结果页）', () => {
    assert.equal(looksLikeBlockPage('<html><body>短</body></html>'), true)
  })

  test('looksLikeBlockPage 识别 Cloudflare/captcha 类英文验证页', () => {
    const cf = '<html><head><title>Just a moment...</title></head><body>' + 'x'.repeat(3000) + '</body></html>'
    assert.equal(looksLikeBlockPage(cf), true)
    const cap = '<html><body>' + 'x'.repeat(2100) + 'verify you are human</body></html>'
    assert.equal(looksLikeBlockPage(cap), true)
  })

  test('looksLikeBlockPage 对正常结果页返回 false', () => {
    const normal = '<html><head><title>TypeScript 5.7 - 搜索</title></head><body>' +
      '<div class="result">实际搜索结果内容</div>'.repeat(80) + '</body></html>'
    assert.ok(normal.length > 2048)
    assert.equal(looksLikeBlockPage(normal), false)
  })
})

describe('listEngines', () => {
  test('返回三个内置引擎且全部免 Key', () => {
    const engines = listEngines()
    const names = engines.map((e) => e.name)
    assert.deepEqual(names, ['duckduckgo', 'baidu', 'bing'])
    assert.ok(engines.every((e) => e.needsKey === false), '三个引擎都应免 Key')
    assert.ok(engines.every((e) => e.available), '三个引擎默认都可用')
  })
})

describe('formatSearchResults', () => {
  const makeResp = (results: WebSearchResponse['results']): WebSearchResponse => ({
    query: '测试',
    engine: 'auto',
    results,
    durationMs: 12,
  })

  test('无结果时给出可读提示', () => {
    const out = formatSearchResults(makeResp([]))
    assert.ok(out.includes('未找到结果'))
    assert.ok(out.includes('测试'))
  })

  test('有结果时含标题/URL/引擎标记，且编号从 1 开始', () => {
    const out = formatSearchResults(
      makeResp([
        { title: '标题一', url: 'https://a.example', description: '摘要一', engine: 'duckduckgo' },
        { title: '标题二', url: 'https://b.example', description: '', engine: 'bing' },
      ]),
    )
    assert.ok(out.includes('1. 标题一'))
    assert.ok(out.includes('https://a.example'))
    assert.ok(out.includes('[duckduckgo]'))
    assert.ok(out.includes('2. 标题二'))
    // 空摘要不应产生多余空行
    assert.ok(!out.includes('\n   \n'), '空摘要不应留下空白行')
  })
})
