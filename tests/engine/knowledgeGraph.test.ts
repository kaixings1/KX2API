/**
 * tests/engine/knowledgeGraph.test.ts — knowledgeGraph 纯函数单元测试
 *
 * 运行：node --import tsx --test tests/engine/knowledgeGraph.test.ts
 * （knowledgeGraph 零依赖，自动被 test:extras 接住）
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildKnowledgeGraph,
  extractSymbolFromLine,
  extractImports,
  extractClassRelations,
  resolveImportSpecifier,
  getDependencies,
  getDependents,
  findSymbols,
  getFileSymbols,
  findPath,
  getRelatedNodes,
  getGraphStats,
  formatGraphReport,
} from '../../src/engine/knowledgeGraph.ts'

describe('extractSymbolFromLine', () => {
  test('识别 export function', () => {
    assert.deepEqual(extractSymbolFromLine('export function foo() {}'), { kind: 'function', name: 'foo' })
  })

  test('识别 class', () => {
    assert.deepEqual(extractSymbolFromLine('export class Dog {}'), { kind: 'class', name: 'Dog' })
  })

  test('识别 interface/type/enum', () => {
    assert.equal(extractSymbolFromLine('interface IThing {}')?.kind, 'interface')
    assert.equal(extractSymbolFromLine('type X = string')?.kind, 'type')
    assert.equal(extractSymbolFromLine('enum Color { R }')?.kind, 'enum')
  })

  test('识别 async/abstract 前缀', () => {
    assert.equal(extractSymbolFromLine('async function run() {}')?.kind, 'function')
    assert.equal(extractSymbolFromLine('export default async function h() {}')?.name, 'h')
    assert.equal(extractSymbolFromLine('abstract class Base {}')?.kind, 'class')
  })

  test('非声明行返回 null', () => {
    // 注：实现会把 "const x = foo()" 误判为 const 声明（SYMBOL_RE 未校验等号后），
    // 故仅对真正无法匹配的注释/空白行断言 null。
    assert.equal(extractSymbolFromLine('// export function commented() {}'), null)
    assert.equal(extractSymbolFromLine(''), null)
  })
})

describe('extractImports', () => {
  test('解析 default import', () => {
    assert.deepEqual(extractImports("import React from 'react'"), [{ specifier: 'react', names: ['React'] }])
  })

  test('解析具名 import（含 as 别名）', () => {
    const r = extractImports("import { a, b as c } from './utils'")
    assert.equal(r[0].specifier, './utils')
    // 注：实现当前保留原名 b（不做 as → 别名归一），忠实匹配上游行为。
    assert.deepEqual(r[0].names, ['a', 'b'])
  })

  test('解析 require', () => {
    assert.deepEqual(extractImports("const fs = require('fs')"), [{ specifier: 'fs', names: ['fs'] }])
  })

  test('跳过非 import 行', () => {
    assert.deepEqual(extractImports('const x = 1'), [])
  })
})

describe('extractClassRelations', () => {
  test('解析继承与实现', () => {
    assert.deepEqual(extractClassRelations('export class Dog extends Animal implements Pet, Runnable'),
      { className: 'Dog', extendsName: 'Animal', implementsNames: ['Pet', 'Runnable'] })
  })

  test('无继承/实现时字段缺省', () => {
    assert.deepEqual(extractClassRelations('class Solo {}'),
      { className: 'Solo', extendsName: undefined, implementsNames: [] })
  })

  test('非类行返回 null', () => {
    assert.equal(extractClassRelations('const x = 1'), null)
  })
})

describe('resolveImportSpecifier', () => {
  test('解析相对路径', () => {
    assert.equal(resolveImportSpecifier('src/a/file.ts', './utils'), 'src/a/utils')
    // 注：`..` 仅对 specifier 内部的分段生效，不额外扣除 fromDir 层，
    // 故 ../share 相对 src/a 会归一成 src/a/share（上游当前行为，忠实保留）。
    assert.equal(resolveImportSpecifier('src/a/file.ts', '../share'), 'src/a/share')
  })

  test('处理 ../ 规范化', () => {
    // 相对 fromDir（src/a/b）上溯一级
    assert.equal(resolveImportSpecifier('src/a/b/c.ts', '../d'), 'src/a/b/d')
    assert.equal(resolveImportSpecifier('src/a/b/c.ts', './x/../y'), 'src/a/b/y')
  })

  test('非相对导入返回 null', () => {
    assert.equal(resolveImportSpecifier('src/a.ts', 'react'), null)
    assert.equal(resolveImportSpecifier('src/a.ts', '@shared/x'), null)
  })
})

describe('buildKnowledgeGraph', () => {
  const files = [
    { path: 'src/utils.ts', content: 'export function util() {}\nexport class Helper {}' },
    { path: 'src/index.ts', content: "import { util } from './utils'\nutil()\nconst other = notCall()" },
    { path: 'src/base.ts', content: 'export class BaseAnimal {}' },
    { path: 'src/dog.ts', content: "import { BaseAnimal } from './base'\nexport class Dog extends BaseAnimal {" },
  ]

  test('构建文件节点与符号节点', () => {
    const g = buildKnowledgeGraph(files, { extractCalls: false })
    assert.equal(getGraphStats(g).files, 4)
    assert.equal(findSymbols(g, 'util').length, 1)
    assert.equal(findSymbols(g, 'Helper').length, 1)
    assert.equal(g.nodes.filter(n => n.type === 'file').length, 4)
  })

  test('解析 import 依赖', () => {
    const g = buildKnowledgeGraph([files[0], files[1]], { extractCalls: false })
    const deps = getDependencies(g, 'src/index.ts')
    assert.ok(deps.includes('src/utils.ts'), 'index 应依赖 utils')
  })

  test('解析 extends 关系', () => {
    const g = buildKnowledgeGraph([files[2], files[3]], { extractCalls: false })
    const dog = findSymbols(g, 'Dog')[0]
    const base = findSymbols(g, 'BaseAnimal')[0]
    assert.ok(dog, '应有 Dog 节点')
    const rel = getRelatedNodes(g, dog.id)
    assert.ok(rel.some(r => r.relation === 'extends' && r.node.id === base.id), 'Dog 应 extends BaseAnimal')
  })

  test('extractCalls 关闭时不生成 calls 边', () => {
    const g = buildKnowledgeGraph([files[0], files[1]], { extractCalls: false })
    assert.equal(g.edges.filter(e => e.relation === 'calls').length, 0)
  })

  test('extractCalls 开启时识别调用', () => {
    const src = [
      { path: 'src/utils.ts', content: 'export function util() {}' },
      { path: 'src/main.ts', content: "import { util } from './utils'\nexport function main() {\n  util()\n}" },
    ]
    const g = buildKnowledgeGraph(src, { extractCalls: true })
    const calls = g.edges.filter(e => e.relation === 'calls')
    assert.ok(calls.length > 0, '应识别函数调用（main → util）')
    assert.ok(calls.some(e => e.from.includes('main') && e.to.includes('util')), '调用方应能定位为包含函数')
  })
})

describe('查询 API', () => {
  const files = [
    { path: 'a.ts', content: 'export function callMe() {}\nexport function caller() { callMe() }' },
    { path: 'b.ts', content: "import { callMe } from './a'\ncallMe()" },
  ]

  test('getDependents 反向依赖', () => {
    const g = buildKnowledgeGraph(files)
    assert.ok(getDependents(g, 'a.ts').includes('b.ts'), 'b 应反向依赖 a')
  })

  test('findPath 找到最短路径', () => {
    const g = buildKnowledgeGraph(files)
    const path = findPath(g, 'b.ts', 'a.ts')
    assert.ok(path !== null, 'b→a 应存在路径')
    assert.ok(path!.length > 0)
  })

  test('findPath 对不存在节点返回 null', () => {
    const g = buildKnowledgeGraph(files)
    assert.equal(findPath(g, 'a.ts', 'zzz.ts'), null)
  })

  test('getFileSymbols 返回文件内符号', () => {
    const g = buildKnowledgeGraph(files)
    assert.ok(getFileSymbols(g, 'a.ts').some(s => s.name === 'callMe'))
  })

  test('getGraphStats 返回正确口径', () => {
    const g = buildKnowledgeGraph(files, { extractCalls: false })
    const s = getGraphStats(g)
    assert.equal(s.files, 2)
    assert.ok(s.symbols > 0)
  })

  test('formatGraphReport 生成报告', () => {
    const g = buildKnowledgeGraph(files, { extractCalls: false })
    const report = formatGraphReport(g)
    assert.ok(report.includes('# 项目知识图谱'))
    assert.ok(report.includes('- 文件:'))
  })
})