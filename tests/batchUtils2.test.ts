/**
 * tests/batchUtils2.test.ts — 第二批工具模块移植测试
 *
 * 覆盖：objectGroupBy / xml / mergeUtils / strictFormatter / intl /
 *       contentArray / taggedId / semanticBoolean / semanticNumber / jsonIO / html
 *
 * 运行：node --import tsx --test tests/batchUtils2.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { objectGroupBy } from '../src/utils/objectGroupBy.ts'
import { escapeXml, escapeXmlAttr } from '../src/utils/xml.ts'
import { mergeDictionaries, mergeParallelSessionStates } from '../src/utils/mergeUtils.ts'
import { StrictFormatter } from '../src/utils/strictFormatter.ts'
import { firstGrapheme, lastGrapheme, getSystemLocaleLanguage } from '../src/utils/intl.ts'
import { insertBlockAfterToolResults } from '../src/utils/contentArray.ts'
import { toTaggedId } from '../src/utils/taggedId.ts'
import { semanticBoolean } from '../src/utils/semanticBoolean.ts'
import { semanticNumber } from '../src/utils/semanticNumber.ts'
import { looksLikeHtml, slimdownHtml } from '../src/utils/html.ts'

describe('objectGroupBy', () => {
  test('按键分组', () => {
    const items = [
      { cat: 'a', v: 1 },
      { cat: 'b', v: 2 },
      { cat: 'a', v: 3 },
    ]
    const g = objectGroupBy(items, (i) => i.cat)
    assert.deepEqual(g.a, [{ cat: 'a', v: 1 }, { cat: 'a', v: 3 }])
    assert.deepEqual(g.b, [{ cat: 'b', v: 2 }])
  })

  test('返回零原型对象', () => {
    const g = objectGroupBy([1, 2, 3], (n) => n % 2)
    assert.equal(Object.getPrototypeOf(g), null)
    assert.equal(g[1]!.length, 2)
  })
})

describe('escapeXml', () => {
  test('转义文本内容特殊字符', () => {
    assert.equal(escapeXml('a&b<c>d'), 'a&amp;b&lt;c&gt;d')
  })

  test('转义属性值（含引号）', () => {
    assert.equal(escapeXmlAttr('a"b\'c'), 'a&quot;b&apos;c')
  })
})

describe('mergeDictionaries', () => {
  test('递归合并，b 覆盖 a', () => {
    const a = { x: { y: 1, z: 2 }, k: 'keep' }
    mergeDictionaries(a, { x: { y: 9 }, k: 'new' })
    assert.deepEqual(a, { x: { y: 9, z: 2 }, k: 'new' })
  })

  test('合并并行会话状态，只应用实际变更', () => {
    const original = { a: 1, b: 1, c: 'keep' }
    mergeParallelSessionStates(original, [{ a: 1, b: 2 }, { a: 1, b: 2, c: 'changed' }])
    assert.deepEqual(original, { a: 1, b: 2, c: 'changed' })
  })
})

describe('StrictFormatter', () => {
  test('具名变量替换', () => {
    const f = new StrictFormatter()
    assert.equal(f.format('Hello {name}!', { name: 'World' }), 'Hello World!')
  })

  test('缺失变量抛错', () => {
    const f = new StrictFormatter()
    assert.throws(() => f.format('{x} {y}', { x: 1 }), /Missing values/)
  })

  test('validateInputVariables 校验占位符', () => {
    const f = new StrictFormatter()
    assert.throws(() => f.validateInputVariables('{a} {b}', ['a']), /Missing variables/)
    f.validateInputVariables('{a} {b}', ['a', 'b']) // 不抛错
  })
})

describe('intl', () => {
  test('firstGrapheme 提取首个字素簇', () => {
    assert.equal(firstGrapheme('你好'), '你')
    assert.equal(firstGrapheme(''), '')
  })

  test('lastGrapheme 提取末个字素簇', () => {
    assert.equal(lastGrapheme('ab'), 'b')
  })

  test('系统语言子标签', () => {
    const lang = getSystemLocaleLanguage()
    assert.ok(lang === undefined || /^[a-z]{2,3}(-|$)/.test(lang!))
  })
})

describe('contentArray insertBlockAfterToolResults', () => {
  test('插入到最后一个 tool_result 之后', () => {
    const content = [
      { type: 'text', text: 'hi' },
      { type: 'tool_result', content: 'r1' },
      { type: 'tool_result', content: 'r2' },
    ]
    insertBlockAfterToolResults(content, { type: 'text', text: 'directive' })
    assert.equal(content[2].type, 'tool_result')
    assert.deepEqual(content[3], { type: 'text', text: 'directive' })
    // 若插入成为末元素则追加文本续写块
    assert.equal(content[4]?.type, 'text')
  })
})

describe('toTaggedId', () => {
  test('UUID 转 tagged ID', () => {
    const id = toTaggedId('user', '00000000-0000-0000-0000-000000000000')
    assert.ok(id.startsWith('user_01'))
    assert.equal(id.length, 'user_01'.length + 22)
  })

  test('非法 UUID 抛错', () => {
    assert.throws(() => toTaggedId('user', 'abc'))
  })
})

describe('semanticBoolean', () => {
  test('接受字符串 "false" → false', () => {
    const schema = semanticBoolean()
    assert.equal(schema.parse('false'), false)
    assert.equal(schema.parse('true'), true)
    assert.equal(schema.parse(true), true)
    assert.equal(schema.parse(false), false)
  })

  test('拒绝任意非布尔值', () => {
    const schema = semanticBoolean()
    assert.throws(() => schema.parse('yes'))
    assert.throws(() => schema.parse(1))
  })
})

describe('semanticNumber', () => {
  test('接受数字字符串', () => {
    const schema = semanticNumber()
    assert.equal(schema.parse('30'), 30)
    assert.equal(schema.parse('-5'), -5)
    assert.equal(schema.parse('3.14'), 3.14)
    assert.equal(schema.parse(42), 42)
  })

  test('拒绝空串等', () => {
    const schema = semanticNumber()
    assert.throws(() => schema.parse(''))
    assert.throws(() => schema.parse('abc'))
  })
})

describe('html', () => {
  test('looksLikeHtml 检测', () => {
    assert.ok(looksLikeHtml('<html><body>hi</body></html>'))
    assert.ok(!looksLikeHtml('just plain text'))
  })

  test('slimdownHtml 清理标记', () => {
    const cleaned = slimdownHtml('<html><body><svg>ignore</svg><p>hi</p><a href="http://x">link</a><img src="data:png"></body></html>')
    assert.ok(!cleaned.includes('<svg'))
    assert.ok(!cleaned.includes('<img'))
    assert.ok(cleaned.includes('<a href="http://x">'))
  })
})