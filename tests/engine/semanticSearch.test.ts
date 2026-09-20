/**
 * tests/engine/semanticSearch.test.ts — 语义搜索纯函数单元测试
 *
 * 运行：node --import tsx --test tests/engine/semanticSearch.test.ts
 * （semanticSearch 纯函数零外部依赖，node:test 直接可用，被 test:extras 接住）
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  tokenize,
  analyzeQuery,
  indexContent,
  buildIndex,
  searchIndex,
  searchSymbolsInIndex,
  extractSymbols,
  createSemanticIndexer,
} from '../../src/engine/semanticSearch.ts'

describe('tokenize 分词（中英文混合）', () => {
  test('英文分词+去掉停用词', () => {
    const t = tokenize('find the loader function')
    // find/the/function 均属停用词，只有 loader 是实质词被保留
    assert.deepEqual(t, ['loader'])
  })

  test('驼峰拆分为小写原始词', () => {
    const t = tokenize('getUserById')
    assert.ok(t.includes('getuserbyid'))
  })

  test('中文 unigram+bigram', () => {
    const t = tokenize('搜索配置信息')
    assert.ok(t.includes('搜索'), '中文 bigram 应生成')
    assert.ok(t.includes('配'), '中文单字应保留')
  })
})

describe('analyzeQuery 自然语言查询分析', () => {
  test('提取动作与目标', () => {
    const a = analyzeQuery('搜索 memoryRecall 这个文件')
    assert.ok(a.action.length > 0, '应识别意图动作')
    assert.ok(a.targets.length > 0, '应提取目标符号/文件名')
    assert.ok(a.targets.some(t => t.includes('memoryRecall')), '应提及 memoryRecall')
  })

  test('引号内目标', () => {
    const a = analyzeQuery('搜索 "tokenBudget"')
    assert.ok(a.targets.includes('tokenBudget'))
  })
})

describe('extractSymbols 符号提取', () => {
  test('提取 function/class/interface', () => {
    const content = [
      'export function helper() {}',
      'export class Service {}',
      'interface IThing {}',
      'const x = 1',
    ].join('\n')
    const syms = extractSymbols(content)
    assert.ok(syms.some(s => s.name === 'helper' && s.kind === 'function'))
    assert.ok(syms.some(s => s.name === 'Service' && s.kind === 'class'))
    assert.ok(syms.some(s => s.name === 'IThing' && s.kind === 'interface'))
    assert.ok(syms.some(s => s.name === 'x' && s.kind === 'const'))
  })
})

describe('indexContent / buildIndex', () => {
  test('indexContent 分块并提取符号', () => {
    const content = Array.from({ length: 40 }, (_, i) => `line ${i} loader value`).join('\n')
    const indexed = indexContent(content, 'src/a.ts')
    assert.ok(indexed.chunks.length > 1, '长文件应分多块')
    assert.ok(indexed.path === 'src/a.ts')
  })

  test('buildIndex 计算 docFreq', () => {
    const f1 = indexContent('export function loader() {}', 'a.ts')
    const f2 = indexContent('import loader from b', 'b.ts')
    const index = buildIndex([f1, f2])
    assert.ok(index.totalChunks > 0)
    assert.ok(index.docFreq.size > 0)
  })
})

describe('searchIndex 语义搜索（BM25）', () => {
  function makeIndex() {
    const files = [
      indexContent('export function readFile(path: string) { return fs.readFileSync(path) }', 'src/io/reader.ts'),
      indexContent('export function writeConfig(cfg: object) { save(cfg) }', 'src/io/config.ts'),
      indexContent('const ws = new WebSocket("wss://x")', 'src/net/ws.ts'),
    ]
    return buildIndex(files)
  }

  test('检索命中相关文件', () => {
    const index = makeIndex()
    const hits = searchIndex(index, 'readFile path', { maxResults: 5 })
    assert.ok(hits.length > 0, '应有命中')
    assert.ok(hits.some(h => h.filePath.includes('reader.ts')), 'reader.ts 应命中 readFile')
  })

  test('无匹配返回空', () => {
    const index = makeIndex()
    const hits = searchIndex(index, 'zzz-not-exist-term-xyz', { maxResults: 5 })
    assert.equal(hits.length, 0)
  })

  test('多源查询按分数排序', () => {
    const index = makeIndex()
    const hits = searchIndex(index, 'readFile', { maxResults: 10 })
    const scores = hits.map(h => h.score)
    assert.ok(scores.every((s, i) => i === 0 || scores[i - 1] >= s), '分数应降序排列')
  })
})

describe('searchSymbolsInIndex 符号检索', () => {
  test('按符号名精确/前缀匹配', () => {
    const index = buildIndex([
      indexContent('export function parseConfig() {}', 'a.ts'),
      indexContent('export function parseEnv() {}', 'b.ts'),
    ])
    const hits = searchSymbolsInIndex(index, 'parseConfig')
    assert.ok(hits.length > 0)
    assert.equal(hits[0].name, 'parseConfig')
  })
})

describe('SemanticIndexer 薄封装（临时目录）', () => {
  test('索引并搜索真实文件', async () => {
    // 用临时目录隔离，避免污染真实 .doge
    const os = await import('node:os')
    const path = await import('node:path')
    const fs = await import('node:fs')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-index-'))
    try {
      const srcDir = path.join(tmpDir, 'src').replace(/\\/g, '/')
      fs.mkdirSync(srcDir, { recursive: true })
      fs.writeFileSync(path.join(srcDir, 'render.ts'), 'export function renderPage() { return "<h1>" }')
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export function formatNumber(n: number) { return n.toFixed(2) }')

      const indexer = createSemanticIndexer(tmpDir)
      const res = await indexer.index()
      assert.ok(res.filesIndexed >= 2, '应索引到代码文件')

      const hits = indexer.search('renderPage')
      assert.ok(hits.some(h => h.filePath.includes('render.ts')), '应命中 render.ts')
      assert.ok(hits.some(h => h.filePath.includes('render.ts')), '应包含符号')

      const stats = indexer.getStats()
      assert.ok(stats.files >= 2)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})